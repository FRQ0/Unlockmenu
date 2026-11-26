-- Unlock Menu · cobranças pela InfinitePay (cartão por aproximação no celular e link/QR)
-- Segurança:
--  * cobrança é criada só pelo servidor, com valor calculado no banco;
--  * o aviso (webhook) da InfinitePay não tem assinatura: exige token secreto da cobrança
--    E é conferido na API da InfinitePay (payment_check) antes de dar baixa;
--  * cobrança paga só pode ser usada uma vez (vira pagamento da mesa ou da venda de fichas).

-- InfiniteTag (nome de usuário no app InfinitePay, sem o $). Não é segredo.
alter table public.tenants
  add column infinitepay_handle text check (infinitepay_handle is null or infinitepay_handle ~ '^[a-z0-9_.-]{2,40}$');
grant update (infinitepay_handle) on public.tenants to authenticated;

create table public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  origem text not null check (origem in ('mesa', 'fichas')),
  session_id uuid references public.sessions (id) on delete set null,
  tipo text not null check (tipo in ('link', 'tap')),
  metodo text check (metodo in ('pix', 'debito', 'credito')),   -- conhecido ao pagar (ou escolhido no tap)
  parcelas int not null default 1 check (parcelas between 1 and 12),
  valor numeric(10, 2) not null check (valor >= 1 and valor < 100000),
  status text not null default 'pendente' check (status in ('pendente', 'paga', 'usada', 'cancelada')),
  token text not null default replace(gen_random_uuid()::text, '-', ''),
  link_url text,
  invoice_slug text,
  transaction_nsu text,
  aut text,
  receipt_url text,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  check (origem <> 'mesa' or session_id is not null)
);
create index on public.cobrancas (tenant_id, criado_em desc);

alter table public.cobrancas enable row level security;
-- a equipe vê o status (sem o token secreto)
grant select (id, tenant_id, origem, session_id, tipo, metodo, parcelas, valor, status, link_url, transaction_nsu, aut, receipt_url, criado_em, pago_em)
  on public.cobrancas to authenticated;
create policy cobrancas_select on public.cobrancas for select to authenticated
  using (app.has_role(tenant_id, '{dono,gerente,garcom}') and app.has_feature(tenant_id, 'pagamentos'));

alter table public.pagamentos add column cobranca_id uuid references public.cobrancas (id) on delete set null;
create unique index pagamentos_cobranca_unica on public.pagamentos (cobranca_id) where cobranca_id is not null;

-- ---------------------------------------------------------------------------
-- Criar cobrança (garçom/caixa). Mesa: valor = o que falta na conta. Fichas: valor do carrinho.
-- ---------------------------------------------------------------------------
create or replace function public.criar_cobranca(p_tenant uuid, p_origem text, p_tipo text, p_table uuid, p_valor numeric, p_metodo text, p_parcelas int)
returns table (id uuid, valor numeric, token text)
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_sessao uuid;
  v_total numeric;
  v_pago numeric;
  v_valor numeric(10, 2) := round(p_valor, 2);
begin
  if p_origem not in ('mesa', 'fichas') or p_tipo not in ('link', 'tap') then raise exception 'cobranca_invalida' using errcode = '23514'; end if;
  if p_tipo = 'tap' and p_metodo not in ('debito', 'credito') then raise exception 'cobranca_invalida' using errcode = '23514'; end if;
  if coalesce(p_parcelas, 1) not between 1 and 12 or (p_metodo = 'debito' and coalesce(p_parcelas, 1) <> 1) then raise exception 'cobranca_invalida' using errcode = '23514'; end if;

  if p_origem = 'mesa' then
    select t.tenant_id into v_tenant from public.tables t where t.id = p_table and t.tenant_id = p_tenant;
    if v_tenant is null then raise exception 'mesa_nao_encontrada' using errcode = 'P0002'; end if;
    select s.id into v_sessao from public.sessions s where s.table_id = p_table and s.encerrada_em is null order by s.iniciada_em desc limit 1;
    if v_sessao is null then raise exception 'mesa_sem_conta' using errcode = 'P0002'; end if;
    select coalesce(sum(o.total), 0) into v_total from public.orders o where o.session_id = v_sessao and o.status <> 'cancelado';
    select coalesce(sum(p.valor), 0) into v_pago from public.pagamentos p where p.session_id = v_sessao and p.status = 'confirmado';
    if v_valor > v_total - v_pago + 0.009 then raise exception 'pagamento_maior_que_total' using errcode = '23514'; end if;
  else
    v_tenant := p_tenant;
  end if;
  if v_tenant is null or not app.has_role(v_tenant, '{dono,gerente,garcom}') then raise exception 'sem permissão' using errcode = '42501'; end if;
  if not app.has_feature(v_tenant, 'pagamentos') then raise exception 'recurso_indisponivel_no_plano: pagamentos' using errcode = '42501'; end if;
  if v_valor < 1 then raise exception 'cobranca_invalida' using errcode = '23514'; end if;

  return query
    insert into public.cobrancas as c (tenant_id, origem, session_id, tipo, metodo, parcelas, valor, criado_por)
    values (v_tenant, p_origem, v_sessao, p_tipo, case when p_tipo = 'tap' then p_metodo end, coalesce(p_parcelas, 1), v_valor, auth.uid())
    returning c.id, c.valor, c.token;
end $$;

-- ---------------------------------------------------------------------------
-- Confirmar cobrança paga (só o servidor: webhook conferido, ou retorno do tap confirmado pela equipe)
-- Mesa: vira pagamento da conta na hora. Fichas: fica "paga" até a venda usar.
-- ---------------------------------------------------------------------------
create or replace function public.confirmar_cobranca(p_id uuid, p_metodo text, p_transaction_nsu text, p_aut text, p_slug text, p_receipt text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.cobrancas%rowtype;
begin
  select * into c from public.cobrancas where id = p_id for update;
  if not found then return 'nao_encontrada'; end if;
  if c.status <> 'pendente' then return c.status; end if;
  update public.cobrancas set
    status = case when c.origem = 'mesa' then 'usada' else 'paga' end,
    metodo = coalesce(case when p_metodo in ('pix', 'debito', 'credito') then p_metodo end, c.metodo, 'credito'),
    transaction_nsu = left(p_transaction_nsu, 80), aut = left(p_aut, 40), invoice_slug = left(p_slug, 80), receipt_url = left(p_receipt, 500),
    pago_em = now()
  where id = p_id;
  if c.origem = 'mesa' then
    insert into public.pagamentos (tenant_id, session_id, metodo, valor, criado_por, cobranca_id)
    select c.tenant_id, c.session_id, x.metodo, c.valor, c.criado_por, c.id from public.cobrancas x where x.id = p_id;
  end if;
  return case when c.origem = 'mesa' then 'usada' else 'paga' end;
end $$;

create or replace function public.salvar_link_cobranca(p_id uuid, p_url text, p_slug text)
returns void language sql security definer set search_path = public as $$
  update public.cobrancas set link_url = left(p_url, 500), invoice_slug = left(p_slug, 80) where id = p_id and status = 'pendente';
$$;

create or replace function public.cancelar_cobranca(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.cobrancas where id = p_id and status = 'pendente';
  if v_tenant is null then return; end if;
  if not app.has_role(v_tenant, '{dono,gerente,garcom}') then raise exception 'sem permissão' using errcode = '42501'; end if;
  update public.cobrancas set status = 'cancelada' where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- Venda de fichas aceita cobrança paga: [{"metodo":"credito","valor":42,"cobranca_id":"..."}]
-- ---------------------------------------------------------------------------
create or replace function app.usar_cobrancas_da_venda(p_tenant uuid, p_venda uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r record; c public.cobrancas%rowtype;
begin
  for r in select * from jsonb_to_recordset(p) as x(metodo text, valor numeric, cobranca_id uuid) where x.cobranca_id is not null loop
    select * into c from public.cobrancas where id = r.cobranca_id for update;
    if not found or c.tenant_id <> p_tenant or c.origem <> 'fichas' or c.status <> 'paga' or abs(c.valor - r.valor) > 0.009 then
      raise exception 'cobranca_nao_paga' using errcode = '23514';
    end if;
    update public.cobrancas set status = 'usada' where id = c.id;
    update public.pagamentos set cobranca_id = c.id, metodo = coalesce(c.metodo, metodo)
    where id = (select id from public.pagamentos where venda_id = p_venda and cobranca_id is null and abs(valor - c.valor) < 0.01 limit 1);
  end loop;
end $$;

-- vender_fichas: agora entende cobranca_id (o restante é igual à 0006)
create or replace function public.vender_fichas(p_itens jsonb, p_pagamentos jsonb)
returns table (venda_id uuid, total numeric, codigo text, nome text, preco numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_venda uuid;
  v_total numeric(10, 2);
  v_pago numeric;
  v_qtd int;
  v_validos int;
  r record;
  i int;
  v_cod text;
begin
  if jsonb_typeof(p_itens) <> 'array' then raise exception 'pedido_invalido' using errcode = '23514'; end if;
  v_qtd := jsonb_array_length(p_itens);
  if v_qtd < 1 or v_qtd > 50 then raise exception 'pedido_invalido' using errcode = '23514'; end if;

  select min(p.tenant_id::text)::uuid, count(distinct p.tenant_id), count(*) into v_tenant, i, v_validos
  from jsonb_to_recordset(p_itens) as x(product_id uuid, quantidade int)
  join public.products p on p.id = x.product_id and p.disponivel
  where x.quantidade between 1 and 50;
  if v_validos <> v_qtd or i <> 1 then raise exception 'item_invalido' using errcode = '23514'; end if;
  if not app.has_role(v_tenant, '{dono,gerente,garcom}') then raise exception 'sem permissão' using errcode = '42501'; end if;
  if not app.has_feature(v_tenant, 'fichas') then raise exception 'recurso_indisponivel_no_plano: fichas' using errcode = '42501'; end if;

  select sum(p.preco * x.quantidade) into v_total
  from jsonb_to_recordset(p_itens) as x(product_id uuid, quantidade int)
  join public.products p on p.id = x.product_id;
  if (select sum((x->>'quantidade')::int) from jsonb_array_elements(p_itens) x) > 200 then
    raise exception 'pedido_invalido' using errcode = '23514';
  end if;

  v_pago := app.somar_pagamentos(p_pagamentos);
  if v_pago < v_total then raise exception 'pagamento_insuficiente' using errcode = '23514'; end if;
  if v_pago > v_total + 0.009 and not exists (select 1 from jsonb_to_recordset(p_pagamentos) x(metodo text) where x.metodo = 'dinheiro') then
    raise exception 'pagamento_maior_que_total' using errcode = '23514';
  end if;

  insert into public.vendas (tenant_id, total, criado_por) values (v_tenant, v_total, auth.uid()) returning id into v_venda;

  insert into public.pagamentos (tenant_id, venda_id, metodo, valor, recebido, criado_por)
  select v_tenant, v_venda, x.metodo, round(x.valor, 2), x.recebido, auth.uid()
  from jsonb_to_recordset(p_pagamentos) as x(metodo text, valor numeric, recebido numeric);
  perform app.usar_cobrancas_da_venda(v_tenant, v_venda, p_pagamentos);

  for r in
    select p.id, p.nome, p.preco, x.quantidade
    from jsonb_to_recordset(p_itens) as x(product_id uuid, quantidade int)
    join public.products p on p.id = x.product_id
  loop
    for i in 1..r.quantidade loop
      loop
        v_cod := app.novo_codigo_ficha();
        exit when not exists (select 1 from public.fichas f where f.tenant_id = v_tenant and f.codigo = v_cod);
      end loop;
      insert into public.fichas (tenant_id, venda_id, codigo, product_id, nome, preco) values (v_tenant, v_venda, v_cod, r.id, r.nome, r.preco);
    end loop;
  end loop;

  return query select v_venda, v_total, f.codigo, f.nome, f.preco from public.fichas f where f.venda_id = v_venda order by f.nome, f.codigo;
end $$;

revoke all on function public.criar_cobranca(uuid, text, text, uuid, numeric, text, int), public.confirmar_cobranca(uuid, text, text, text, text, text),
  public.salvar_link_cobranca(uuid, text, text), public.cancelar_cobranca(uuid), app.usar_cobrancas_da_venda(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.criar_cobranca(uuid, text, text, uuid, numeric, text, int), public.cancelar_cobranca(uuid) to authenticated, service_role;
grant execute on function public.confirmar_cobranca(uuid, text, text, text, text, text), public.salvar_link_cobranca(uuid, text, text) to service_role;
grant execute on function app.usar_cobrancas_da_venda(uuid, uuid, jsonb) to service_role;
