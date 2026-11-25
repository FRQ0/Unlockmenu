-- Unlock Menu · comanda do garçom, cozinha e fechamento de conta (plano Completo: recurso "pedidos")
-- Regras de segurança:
--  * o preço SEMPRE vem do banco (o celular só manda produto e quantidade);
--  * só garçom/gerente/dono do próprio estabelecimento cria pedido e fecha conta;
--  * cozinha só muda o status (preparando/pronto); transições inválidas são recusadas.

alter table public.orders
  add column session_id uuid references public.sessions (id) on delete set null,
  add column criado_por uuid references auth.users (id) on delete set null,
  add column observacao text check (observacao is null or char_length(observacao) <= 200),
  add column pago_em timestamptz,
  add column atualizado_em timestamptz not null default now();
create index on public.orders (tenant_id, criado_em desc);
create index on public.orders (session_id);
create index on public.order_items (order_id);

alter table public.sessions add column total numeric(10, 2);

-- ---------------------------------------------------------------------------
-- Transições de status do pedido (quando vem do app)
-- ---------------------------------------------------------------------------
create or replace function app.trg_orders_transicao()
returns trigger language plpgsql as $$
begin
  if not app.is_client_role() then return new; end if;
  if old.status = new.status then return new; end if;
  if not (
       (old.status = 'novo' and new.status in ('preparando', 'pronto', 'cancelado'))
    or (old.status = 'preparando' and new.status in ('pronto', 'cancelado'))
    or (old.status = 'pronto' and new.status = 'entregue')
  ) then
    raise exception 'transicao_invalida: % -> %', old.status, new.status using errcode = '23514';
  end if;
  -- cancelar e entregar é coisa do salão, não da cozinha
  if new.status in ('cancelado', 'entregue') and not app.has_role(new.tenant_id, '{dono,gerente,garcom}') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if old.pago_em is not null then
    raise exception 'pedido_ja_fechado' using errcode = '23514';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger orders_transicao before update on public.orders
  for each row execute function app.trg_orders_transicao();

-- ---------------------------------------------------------------------------
-- Criar pedido (comanda do garçom)
-- p_itens: [{"product_id": "...", "quantidade": 2, "observacao": "sem cebola"}]
-- ---------------------------------------------------------------------------
create or replace function public.criar_pedido(p_table uuid, p_itens jsonb, p_observacao text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_sessao uuid;
  v_pedido uuid;
  v_qtd_itens int;
  v_validos int;
begin
  select tenant_id into v_tenant from public.tables where id = p_table and ativa;
  if v_tenant is null then raise exception 'mesa_nao_encontrada' using errcode = 'P0002'; end if;
  if not app.has_role(v_tenant, '{dono,gerente,garcom}') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if not app.has_feature(v_tenant, 'pedidos') then
    raise exception 'recurso_indisponivel_no_plano: pedidos' using errcode = '42501';
  end if;
  if p_observacao is not null and char_length(p_observacao) > 200 then
    raise exception 'pedido_invalido' using errcode = '23514';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then raise exception 'pedido_invalido' using errcode = '23514'; end if;
  v_qtd_itens := jsonb_array_length(p_itens);
  if v_qtd_itens < 1 or v_qtd_itens > 50 then raise exception 'pedido_invalido' using errcode = '23514'; end if;

  -- todos os produtos precisam ser deste estabelecimento e estar disponíveis
  select count(*) into v_validos
  from jsonb_to_recordset(p_itens) as i(product_id uuid, quantidade int, observacao text)
  join public.products p on p.id = i.product_id and p.tenant_id = v_tenant and p.disponivel
  where i.quantidade between 1 and 50 and (i.observacao is null or char_length(i.observacao) <= 200);
  if v_validos <> v_qtd_itens then raise exception 'item_invalido' using errcode = '23514'; end if;

  -- mesa passa a ficar ocupada (abre a sessão se não houver)
  select id into v_sessao from public.sessions where table_id = p_table and encerrada_em is null order by iniciada_em desc limit 1;
  if v_sessao is null then
    insert into public.sessions (tenant_id, table_id) values (v_tenant, p_table) returning id into v_sessao;
  else
    update public.sessions set ultima_atividade = now() where id = v_sessao;
  end if;

  insert into public.orders (tenant_id, table_id, session_id, criado_por, observacao)
  values (v_tenant, p_table, v_sessao, auth.uid(), nullif(trim(p_observacao), ''))
  returning id into v_pedido;

  insert into public.order_items (tenant_id, order_id, product_id, nome, preco, quantidade, observacao)
  select v_tenant, v_pedido, p.id, p.nome, p.preco, i.quantidade, nullif(trim(i.observacao), '')
  from jsonb_to_recordset(p_itens) as i(product_id uuid, quantidade int, observacao text)
  join public.products p on p.id = i.product_id;

  update public.orders o set total = (select coalesce(sum(preco * quantidade), 0) from public.order_items where order_id = v_pedido)
  where o.id = v_pedido;
  return v_pedido;
end $$;

-- ---------------------------------------------------------------------------
-- Fechar conta da mesa: soma os pedidos, marca como pago e libera a mesa
-- ---------------------------------------------------------------------------
create or replace function public.fechar_conta(p_table uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_sessao uuid;
  v_total numeric(10, 2);
begin
  select tenant_id into v_tenant from public.tables where id = p_table;
  if v_tenant is null then raise exception 'mesa_nao_encontrada' using errcode = 'P0002'; end if;
  if not app.has_role(v_tenant, '{dono,gerente,garcom}') or not app.tenant_active(v_tenant) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select id into v_sessao from public.sessions where table_id = p_table and encerrada_em is null order by iniciada_em desc limit 1;
  if v_sessao is null then return 0; end if;

  select coalesce(sum(total), 0) into v_total from public.orders
  where session_id = v_sessao and status <> 'cancelado';

  update public.orders set pago_em = now(), atualizado_em = now(),
    status = case when status in ('novo', 'preparando', 'pronto') then 'entregue' else status end
  where session_id = v_sessao and status <> 'cancelado' and pago_em is null;
  update public.sessions set total = v_total, encerrada_em = now() where id = v_sessao;
  update public.calls set status = 'atendido', atendido_em = now(), atendido_por = auth.uid(),
    aceito_em = coalesce(aceito_em, now()), aceito_por = coalesce(aceito_por, auth.uid())
  where table_id = p_table and status in ('aberto', 'a_caminho');
  return v_total;
end $$;

revoke all on function public.criar_pedido(uuid, jsonb, text), public.fechar_conta(uuid) from public, anon;
grant execute on function public.criar_pedido(uuid, jsonb, text), public.fechar_conta(uuid) to authenticated, service_role;

-- leitura do total da sessão para o painel (RLS já cobre sessions)
grant select (total) on public.sessions to authenticated;

-- tempo real para a cozinha e o garçom
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
alter table public.orders replica identity full;
