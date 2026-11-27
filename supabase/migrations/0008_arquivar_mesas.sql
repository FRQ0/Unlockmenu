-- Mesa com histórico (pedidos/pagamentos) não pode ser apagada sem perder as vendas do relatório:
-- nesse caso ela é ARQUIVADA (some do painel e do QR, mas as vendas continuam no relatório).
alter table public.tables add column arquivada boolean not null default false;

create or replace function app.trg_tables_limite()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_qtd int;
begin
  select l.max_mesas into v_max
  from public.tenants t join public.plan_limits l on l.plano = t.plano
  where t.id = new.tenant_id;
  if v_max is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.tenant_id::text));
  select count(*) into v_qtd from public.tables where tenant_id = new.tenant_id and not arquivada;
  if v_qtd >= v_max then
    raise exception 'limite_de_mesas_do_plano: %', v_max using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.remover_mesa(p_table uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.tables where id = p_table and not arquivada;
  if v_tenant is null then raise exception 'mesa_nao_encontrada' using errcode = 'P0002'; end if;
  if not app.has_role(v_tenant, '{dono,gerente}') or not app.tenant_active(v_tenant) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if exists (select 1 from public.orders where table_id = p_table)
     or exists (select 1 from public.pagamentos p join public.sessions s on s.id = p.session_id where s.table_id = p_table)
     or exists (select 1 from public.cobrancas c join public.sessions s on s.id = c.session_id where s.table_id = p_table) then
    update public.sessions set encerrada_em = now() where table_id = p_table and encerrada_em is null;
    update public.tables set arquivada = true, ativa = false where id = p_table;
    return 'arquivada';
  end if;
  delete from public.tables where id = p_table;
  return 'apagada';
end $$;
revoke all on function public.remover_mesa(uuid) from public, anon;
grant execute on function public.remover_mesa(uuid) to authenticated, service_role;
