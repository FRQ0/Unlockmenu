-- Unlock Menu · funções chamadas SÓ pelo servidor (service_role)
-- O cliente final não tem login. Tudo que ele faz passa pela API do Next, que valida,
-- aplica rate limit e então chama estas funções. anon/authenticated não podem executá-las.

-- ---------------------------------------------------------------------------
-- Rate limit genérico (janela fixa). Retorna true se PODE seguir.
-- ---------------------------------------------------------------------------
create or replace function public.rate_limit_hit(p_chave text, p_max int, p_janela_seg int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as r (chave, janela_inicio, hits)
  values (p_chave, now(), 1)
  on conflict (chave) do update
    set hits = case when r.janela_inicio < now() - make_interval(secs => p_janela_seg) then 1 else r.hits + 1 end,
        janela_inicio = case when r.janela_inicio < now() - make_interval(secs => p_janela_seg) then now() else r.janela_inicio end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

-- limpa contadores velhos (chamado pelo cron)
create or replace function public.rate_limit_limpar()
returns void language sql security definer set search_path = public as $$
  delete from public.rate_limits where janela_inicio < now() - interval '1 day';
$$;

-- ---------------------------------------------------------------------------
-- Mesa: abre/renova a "presença confirmada"
-- ---------------------------------------------------------------------------
create or replace function public.registrar_presenca(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_mesa public.tables%rowtype;
  v_sessao uuid;
begin
  select * into v_mesa from public.tables where token_publico = p_token and ativa;
  if not found or not app.tenant_active(v_mesa.tenant_id) then return null; end if;

  select id into v_sessao from public.sessions
  where table_id = v_mesa.id and encerrada_em is null and ultima_atividade > now() - interval '3 hours'
  order by iniciada_em desc limit 1;

  if v_sessao is null then
    update public.sessions set encerrada_em = now() where table_id = v_mesa.id and encerrada_em is null;
    insert into public.sessions (tenant_id, table_id) values (v_mesa.tenant_id, v_mesa.id) returning id into v_sessao;
  else
    update public.sessions set ultima_atividade = now() where id = v_sessao;
  end if;
  return v_sessao;
end $$;

-- ---------------------------------------------------------------------------
-- Chamados do cliente
-- ---------------------------------------------------------------------------
create or replace function public.criar_chamado(p_token text, p_tipo public.chamado_tipo_t, p_ip_hash text)
returns table (id uuid, status public.chamado_status_t, tipo public.chamado_tipo_t, criado_em timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_mesa public.tables%rowtype;
  v_recentes int;
begin
  select * into v_mesa from public.tables t where t.token_publico = p_token and t.ativa;
  if not found then raise exception 'mesa_nao_encontrada' using errcode = 'P0002'; end if;
  if not app.has_feature(v_mesa.tenant_id, 'chamar_garcom') then
    raise exception 'estabelecimento_inativo' using errcode = '42501';
  end if;

  -- já existe um chamado aberto? devolve ele (1 por mesa por vez)
  return query
    select c.id, c.status, c.tipo, c.criado_em from public.calls c
    where c.table_id = v_mesa.id and c.status in ('aberto', 'a_caminho') limit 1;
  if found then return; end if;

  -- no máximo 3 chamados por mesa a cada 5 minutos
  select count(*) into v_recentes from public.calls c
  where c.table_id = v_mesa.id and c.criado_em > now() - interval '5 minutes';
  if v_recentes >= 3 then raise exception 'muitos_chamados' using errcode = 'P0001'; end if;

  -- e no máximo 6 por aparelho/IP no estabelecimento (evita alguém chamar de todas as mesas)
  if p_ip_hash is not null then
    select count(*) into v_recentes from public.calls c
    where c.tenant_id = v_mesa.tenant_id and c.ip_hash = p_ip_hash and c.criado_em > now() - interval '5 minutes';
    if v_recentes >= 6 then raise exception 'muitos_chamados' using errcode = 'P0001'; end if;
  end if;

  perform public.registrar_presenca(p_token);

  return query
    insert into public.calls as c (tenant_id, table_id, tipo, ip_hash)
    values (v_mesa.tenant_id, v_mesa.id, p_tipo, p_ip_hash)
    returning c.id, c.status, c.tipo, c.criado_em;
end $$;

-- status do chamado para a tela da mesa (só com o token da própria mesa)
create or replace function public.status_chamado(p_token text, p_call_id uuid)
returns table (status public.chamado_status_t, tipo public.chamado_tipo_t, garcom text)
language sql stable security definer set search_path = public as $$
  select c.status, c.tipo,
    -- só o primeiro nome do garçom, nada mais
    split_part(m.nome, ' ', 1)
  from public.calls c
  join public.tables t on t.id = c.table_id and t.token_publico = p_token
  left join public.memberships m on m.user_id = coalesce(c.aceito_por, c.atendido_por) and m.tenant_id = c.tenant_id
  where c.id = p_call_id;
$$;

create or replace function public.cancelar_chamado(p_token text, p_call_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.calls c set status = 'cancelado', cancelado_em = now()
  from public.tables t
  where c.id = p_call_id and t.id = c.table_id and t.token_publico = p_token
    and c.status in ('aberto', 'a_caminho');
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- Domínio próprio → slug (para o middleware). Só para planos com o recurso.
-- ---------------------------------------------------------------------------
create or replace function public.slug_por_dominio(p_host text)
returns text language sql stable security definer set search_path = public as $$
  select t.slug from public.tenants t
  where t.dominio_custom = lower(p_host) and app.has_feature(t.id, 'dominio_proprio');
$$;

-- ---------------------------------------------------------------------------
-- PIN do funcionário (bcrypt)
-- ---------------------------------------------------------------------------
create or replace function public.definir_pin(p_membership uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_pin is not null and p_pin !~ '^[0-9]{4,6}$' then raise exception 'pin_invalido'; end if;
  update public.memberships
    set pin_hash = case when p_pin is null then null else crypt(p_pin, gen_salt('bf', 10)) end
    where id = p_membership;
end $$;

create or replace function public.conferir_pin(p_slug text, p_pin text)
returns uuid language sql stable security definer set search_path = public, extensions as $$
  select m.user_id from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where t.slug = p_slug and m.ativo and m.pin_hash is not null and m.pin_hash = crypt(p_pin, m.pin_hash)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Chamados atrasados ainda não alertados (cron do alerta do gerente)
-- ---------------------------------------------------------------------------
create or replace function public.chamados_atrasados()
returns table (id uuid, tenant_id uuid, mesa text, tipo public.chamado_tipo_t, minutos int)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with alvo as (
    select c.id from public.calls c
    join public.tenants t on t.id = c.tenant_id
    where c.status = 'aberto' and c.alertado_em is null
      and c.criado_em < now() - make_interval(mins => t.alerta_minutos)
      and app.has_feature(t.id, 'alerta_gerente')
    for update of c skip locked
  )
  update public.calls c set alertado_em = now()
  from alvo, public.tables m
  where c.id = alvo.id and m.id = c.table_id
  returning c.id, c.tenant_id, m.nome, c.tipo, (extract(epoch from now() - c.criado_em) / 60)::int;
end $$;

-- ---------------------------------------------------------------------------
-- Só o servidor executa
-- ---------------------------------------------------------------------------
revoke all on function public.rate_limit_hit(text, int, int), public.rate_limit_limpar(),
  public.registrar_presenca(text), public.criar_chamado(text, public.chamado_tipo_t, text),
  public.status_chamado(text, uuid), public.cancelar_chamado(text, uuid), public.slug_por_dominio(text),
  public.definir_pin(uuid, text), public.conferir_pin(text, text), public.chamados_atrasados()
  from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int), public.rate_limit_limpar(),
  public.registrar_presenca(text), public.criar_chamado(text, public.chamado_tipo_t, text),
  public.status_chamado(text, uuid), public.cancelar_chamado(text, uuid), public.slug_por_dominio(text),
  public.definir_pin(uuid, text), public.conferir_pin(text, text), public.chamados_atrasados()
  to service_role;

-- o middleware (edge) usa a chave pública para descobrir o slug de um domínio próprio.
-- Retorna só o slug, que já é público.
grant execute on function public.slug_por_dominio(text) to anon;
