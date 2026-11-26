-- Unlock Menu · caixa com fichas e pagamentos (Pix, débito, crédito, dinheiro)
-- Regras de segurança:
--  * preço sempre do banco; ficha tem código aleatório e só vale UMA vez;
--  * pagamento só é registrado por quem atende (dono/gerente/garçom);
--  * conta só fecha quando o que foi pago cobre o total;
--  * cancelar venda: só dono/gerente.

insert into public.plan_features (plano, feature) values ('completo', 'fichas'), ('completo', 'pagamentos')
on conflict do nothing;

-- Chave Pix do estabelecimento (para gerar o QR com valor)
alter table public.tenants
  add column pix_chave text check (pix_chave is null or char_length(pix_chave) between 3 and 77),
  add column pix_nome text check (pix_nome is null or char_length(pix_nome) between 1 and 25),
  add column pix_cidade text check (pix_cidade is null or char_length(pix_cidade) between 1 and 15);
grant update (pix_chave, pix_nome, pix_cidade) on public.tenants to authenticated;

-- ---------------------------------------------------------------------------
-- Vendas do caixa e fichas
-- ---------------------------------------------------------------------------
create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  total numeric(10, 2) not null,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  cancelada_em timestamptz,
  unique (id, tenant_id)
);
create index on public.vendas (tenant_id, criado_em desc);

create table public.fichas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  venda_id uuid not null,
  codigo text not null check (codigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  product_id uuid references public.products (id) on delete set null,
  nome text not null,
  preco numeric(10, 2) not null,
  status text not null default 'valida' check (status in ('valida', 'usada', 'cancelada')),
  usada_em timestamptz,
  usada_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  foreign key (venda_id, tenant_id) references public.vendas (id, tenant_id) on delete cascade,
  unique (tenant_id, codigo)
);
create index on public.fichas (tenant_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Pagamentos (da conta da mesa ou da venda de fichas)
-- ---------------------------------------------------------------------------
create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  venda_id uuid references public.vendas (id) on delete cascade,
  metodo text not null check (metodo in ('pix', 'debito', 'credito', 'dinheiro')),
  valor numeric(10, 2) not null check (valor > 0 and valor < 100000),
  recebido numeric(10, 2) check (recebido is null or recebido >= valor),  -- dinheiro: para calcular troco
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado')),
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  check ((session_id is null) <> (venda_id is null))
);
create index on public.pagamentos (tenant_id, criado_em desc);
create index on public.pagamentos (session_id);

-- ---------------------------------------------------------------------------
-- RLS: leitura para a equipe (com o recurso); escrita só pelas funções abaixo
-- ---------------------------------------------------------------------------
alter table public.vendas enable row level security;
alter table public.fichas enable row level security;
alter table public.pagamentos enable row level security;
grant select on public.vendas, public.fichas, public.pagamentos to authenticated;
create policy vendas_select on public.vendas for select to authenticated
  using (app.is_member(tenant_id) and app.has_feature(tenant_id, 'fichas'));
create policy fichas_select on public.fichas for select to authenticated
  using (app.is_member(tenant_id) and app.has_feature(tenant_id, 'fichas'));
create policy pagamentos_select on public.pagamentos for select to authenticated
  using (app.has_role(tenant_id, '{dono,gerente,garcom}') and app.has_feature(tenant_id, 'pagamentos'));

-- código de ficha: 6 caracteres sem letras/números que confundem (sem 0, O, 1, I)
create or replace function app.novo_codigo_ficha()
returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;

-- valida a lista de pagamentos [{metodo, valor, recebido?}] e devolve a soma
create or replace function app.somar_pagamentos(p jsonb)
returns numeric language plpgsql immutable as $$
declare v numeric := 0; r record;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) < 1 or jsonb_array_length(p) > 10 then
    raise exception 'pagamento_invalido' using errcode = '23514';
  end if;
  for r in select * from jsonb_to_recordset(p) as x(metodo text, valor numeric, recebido numeric) loop
    if r.metodo not in ('pix', 'debito', 'credito', 'dinheiro') or r.valor is null or r.valor <= 0 or r.valor >= 100000
       or (r.recebido is not null and (r.metodo <> 'dinheiro' or r.recebido < r.valor)) then
      raise exception 'pagamento_invalido' using errcode = '23514';
    end if;
    v := v + round(r.valor, 2);
  end loop;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Vender fichas no caixa
-- p_itens: [{"product_id": "...", "quantidade": 2}]   p_pagamentos: [{"metodo":"pix","valor":24}]
-- ---------------------------------------------------------------------------
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

  -- o estabelecimento vem dos produtos (todos do mesmo)
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

  -- uma ficha por unidade
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

-- ---------------------------------------------------------------------------
-- Validar (usar) ficha na entrega
-- ---------------------------------------------------------------------------
create or replace function public.usar_ficha(p_tenant uuid, p_codigo text)
returns table (resultado text, nome text, usada_em timestamptz)
language plpgsql security definer set search_path = public as $$
declare f public.fichas%rowtype; v_cod text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not app.is_member(p_tenant) then raise exception 'sem permissão' using errcode = '42501'; end if;
  if not app.has_feature(p_tenant, 'fichas') then raise exception 'recurso_indisponivel_no_plano: fichas' using errcode = '42501'; end if;
  select * into f from public.fichas where tenant_id = p_tenant and codigo = v_cod for update;
  if not found then return query select 'nao_encontrada'::text, null::text, null::timestamptz; return; end if;
  if f.status = 'usada' then return query select 'ja_usada'::text, f.nome, f.usada_em; return; end if;
  if f.status = 'cancelada' then return query select 'cancelada'::text, f.nome, null::timestamptz; return; end if;
  update public.fichas set status = 'usada', usada_em = now(), usada_por = auth.uid() where id = f.id;
  return query select 'ok'::text, f.nome, now();
end $$;

-- ---------------------------------------------------------------------------
-- Cancelar venda (estorno): só dono/gerente; fichas já usadas continuam usadas
-- ---------------------------------------------------------------------------
create or replace function public.cancelar_venda(p_venda uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.vendas where id = p_venda and cancelada_em is null;
  if v_tenant is null then raise exception 'venda_nao_encontrada' using errcode = 'P0002'; end if;
  if not app.has_role(v_tenant, '{dono,gerente}') then raise exception 'sem permissão' using errcode = '42501'; end if;
  update public.vendas set cancelada_em = now() where id = p_venda;
  update public.fichas set status = 'cancelada' where venda_id = p_venda and status = 'valida';
  update public.pagamentos set status = 'cancelado' where venda_id = p_venda;
end $$;

-- ---------------------------------------------------------------------------
-- Pagamento da conta da mesa (pode dividir: várias chamadas)
-- ---------------------------------------------------------------------------
create or replace function public.registrar_pagamento_mesa(p_table uuid, p_pagamentos jsonb)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_sessao uuid; v_total numeric; v_pago numeric;
begin
  select tenant_id into v_tenant from public.tables where id = p_table;
  if v_tenant is null then raise exception 'mesa_nao_encontrada' using errcode = 'P0002'; end if;
  if not app.has_role(v_tenant, '{dono,gerente,garcom}') then raise exception 'sem permissão' using errcode = '42501'; end if;
  if not app.has_feature(v_tenant, 'pagamentos') then raise exception 'recurso_indisponivel_no_plano: pagamentos' using errcode = '42501'; end if;
  select id into v_sessao from public.sessions where table_id = p_table and encerrada_em is null order by iniciada_em desc limit 1;
  if v_sessao is null then raise exception 'mesa_sem_conta' using errcode = 'P0002'; end if;
  perform app.somar_pagamentos(p_pagamentos);
  select coalesce(sum(o.total), 0) into v_total from public.orders o where o.session_id = v_sessao and o.status <> 'cancelado';
  select coalesce(sum(valor), 0) into v_pago from public.pagamentos where session_id = v_sessao and status = 'confirmado';
  if v_pago + app.somar_pagamentos(p_pagamentos) > v_total + 0.009
     and not exists (select 1 from jsonb_to_recordset(p_pagamentos) x(metodo text) where x.metodo = 'dinheiro') then
    raise exception 'pagamento_maior_que_total' using errcode = '23514';
  end if;
  insert into public.pagamentos (tenant_id, session_id, metodo, valor, recebido, criado_por)
  select v_tenant, v_sessao, x.metodo, round(x.valor, 2), x.recebido, auth.uid()
  from jsonb_to_recordset(p_pagamentos) as x(metodo text, valor numeric, recebido numeric);
  return greatest(v_total - v_pago - app.somar_pagamentos(p_pagamentos), 0);
end $$;

create or replace function public.estornar_pagamento(p_pagamento uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_sessao uuid;
begin
  select p.tenant_id, p.session_id into v_tenant, v_sessao from public.pagamentos p
  join public.sessions s on s.id = p.session_id and s.encerrada_em is null
  where p.id = p_pagamento and p.status = 'confirmado';
  if v_tenant is null then raise exception 'pagamento_nao_encontrado' using errcode = 'P0002'; end if;
  if not app.has_role(v_tenant, '{dono,gerente,garcom}') then raise exception 'sem permissão' using errcode = '42501'; end if;
  update public.pagamentos set status = 'cancelado' where id = p_pagamento;
end $$;

-- fechar conta agora exige que o pago cubra o total (quando o plano tem pagamentos)
create or replace function public.fechar_conta(p_table uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_sessao uuid;
  v_total numeric(10, 2);
  v_pago numeric(10, 2);
begin
  select tenant_id into v_tenant from public.tables where id = p_table;
  if v_tenant is null then raise exception 'mesa_nao_encontrada' using errcode = 'P0002'; end if;
  if not app.has_role(v_tenant, '{dono,gerente,garcom}') or not app.tenant_active(v_tenant) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select id into v_sessao from public.sessions where table_id = p_table and encerrada_em is null order by iniciada_em desc limit 1;
  if v_sessao is null then return 0; end if;

  select coalesce(sum(total), 0) into v_total from public.orders where session_id = v_sessao and status <> 'cancelado';
  if app.has_feature(v_tenant, 'pagamentos') then
    select coalesce(sum(valor), 0) into v_pago from public.pagamentos where session_id = v_sessao and status = 'confirmado';
    if v_pago + 0.009 < v_total then raise exception 'conta_nao_paga' using errcode = '23514'; end if;
  end if;

  update public.orders set pago_em = now(), atualizado_em = now(),
    status = case when status in ('novo', 'preparando', 'pronto') then 'entregue' else status end
  where session_id = v_sessao and status <> 'cancelado' and pago_em is null;
  update public.sessions set total = v_total, encerrada_em = now() where id = v_sessao;
  update public.calls set status = 'atendido', atendido_em = now(), atendido_por = auth.uid(),
    aceito_em = coalesce(aceito_em, now()), aceito_por = coalesce(aceito_por, auth.uid())
  where table_id = p_table and status in ('aberto', 'a_caminho');
  return v_total;
end $$;

revoke all on function public.vender_fichas(jsonb, jsonb), public.usar_ficha(uuid, text), public.cancelar_venda(uuid),
  public.registrar_pagamento_mesa(uuid, jsonb), public.estornar_pagamento(uuid) from public, anon;
grant execute on function public.vender_fichas(jsonb, jsonb), public.usar_ficha(uuid, text), public.cancelar_venda(uuid),
  public.registrar_pagamento_mesa(uuid, jsonb), public.estornar_pagamento(uuid) to authenticated, service_role;
grant execute on function app.novo_codigo_ficha(), app.somar_pagamentos(jsonb) to authenticated, service_role;
