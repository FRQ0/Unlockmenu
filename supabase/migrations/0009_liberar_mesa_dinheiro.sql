-- 1) Liberar mesa quando o cliente vai embora sem consumir (fecha a presença e cancela chamados abertos).
--    Mesa com pedido ainda não pago não pode ser liberada assim: tem que fechar a conta.
-- 2) Dinheiro só é recebido por dono/gerente (o caixa). Garçom recebe Pix e cartão.

create or replace function public.liberar_mesa(p_table uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_sessao uuid;
begin
  select tenant_id into v_tenant from public.tables where id = p_table;
  if v_tenant is null then raise exception 'mesa_nao_encontrada' using errcode = 'P0002'; end if;
  if not app.has_role(v_tenant, '{dono,gerente,garcom}') or not app.tenant_active(v_tenant) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  select id into v_sessao from public.sessions where table_id = p_table and encerrada_em is null order by iniciada_em desc limit 1;
  if v_sessao is not null and exists (
    select 1 from public.orders where session_id = v_sessao and status <> 'cancelado' and pago_em is null and total > 0
  ) then
    raise exception 'mesa_com_conta_aberta' using errcode = '23514';
  end if;
  update public.sessions set encerrada_em = now() where table_id = p_table and encerrada_em is null;
  update public.calls set status = 'cancelado', cancelado_em = now() where table_id = p_table and status in ('aberto', 'a_caminho');
  return 'liberada';
end $$;
revoke all on function public.liberar_mesa(uuid) from public, anon;
grant execute on function public.liberar_mesa(uuid) to authenticated, service_role;

create or replace function app.trg_pagamento_dinheiro()
returns trigger language plpgsql as $$
begin
  if new.metodo = 'dinheiro' and auth.uid() is not null and not app.has_role(new.tenant_id, '{dono,gerente}') then
    raise exception 'dinheiro_so_caixa' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger pagamentos_dinheiro before insert on public.pagamentos
  for each row execute function app.trg_pagamento_dinheiro();
