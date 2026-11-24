-- Unlock Menu · segurança no banco
-- 1) Ninguém (anon/authenticated) tem acesso a nada por padrão.
-- 2) RLS em TODAS as tabelas, isolando por tenant_id.
-- 3) Permissões por coluna bloqueiam "mass assignment" (ex.: dono mudar o próprio plano).
-- 4) Gatilhos conferem o PLANO no servidor (Reels, "Combina com", cores, limite de mesas...).

-- ---------------------------------------------------------------------------
-- Tirar todos os acessos padrão do Supabase
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer para não cair em recursão de RLS)
-- ---------------------------------------------------------------------------
create or replace function app.is_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = t and m.user_id = auth.uid() and m.ativo
  );
$$;

create or replace function app.has_role(t uuid, papeis public.papel_t[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = t and m.user_id = auth.uid() and m.ativo and m.papel = any (papeis)
  );
$$;

-- Estabelecimento liberado: pago/ativo ou em teste dentro dos 7 dias
create or replace function app.tenant_active(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenants x
    where x.id = t
      and (x.status = 'ativo' or (x.status = 'teste' and x.trial_ends_at is not null and x.trial_ends_at > now()))
  );
$$;

create or replace function app.has_feature(t uuid, f text)
returns boolean language sql stable security definer set search_path = public as $$
  select app.tenant_active(t) and exists (
    select 1 from public.tenants x
    join public.plan_features pf on pf.plano = x.plano
    where x.id = t and pf.feature = f
  );
$$;

-- Chamadas vindas do app logado (anon/authenticated) passam pelas travas.
-- service_role e o dono do banco (migrações, super-admin no servidor) não.
create or replace function app.is_client_role()
returns boolean language sql stable as $$
  select current_user in ('anon', 'authenticated');
$$;

grant execute on function app.is_member(uuid), app.has_role(uuid, public.papel_t[]),
  app.tenant_active(uuid), app.has_feature(uuid, text), app.is_client_role() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ligar RLS em tudo
-- ---------------------------------------------------------------------------
alter table public.plan_features enable row level security;
alter table public.plan_limits enable row level security;
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_admins enable row level security;
alter table public.tables enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.sessions enable row level security;
alter table public.calls enable row level security;
alter table public.events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.rate_limits enable row level security;
alter table public.audit_log enable row level security;
-- rate_limits, audit_log e platform_admins: sem nenhuma policy para clientes = acesso zero.

-- ---------------------------------------------------------------------------
-- Planos (leitura para a equipe logada)
-- ---------------------------------------------------------------------------
grant select on public.plan_features, public.plan_limits to authenticated;
create policy plan_features_read on public.plan_features for select to authenticated using (true);
create policy plan_limits_read on public.plan_limits for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
grant select on public.tenants to authenticated;
-- Só estas colunas podem ser alteradas pelo dono/gerente. plano, status, trial,
-- pago_ate, slug e dominio_custom ficam de fora: só o super-admin (servidor) muda.
grant update (nome, logo_url, capa_url, cor_primaria, cor_secundaria, instagram, whatsapp,
  endereco, horarios, google_review_url, modo_atendimento, alerta_minutos)
  on public.tenants to authenticated;

create policy tenants_select on public.tenants for select to authenticated
  using (app.is_member(id));
create policy tenants_update on public.tenants for update to authenticated
  using (app.has_role(id, '{dono,gerente}') and app.tenant_active(id))
  with check (app.has_role(id, '{dono,gerente}') and app.tenant_active(id));

create or replace function app.trg_tenants_plano()
returns trigger language plpgsql as $$
begin
  if not app.is_client_role() then return new; end if;
  if (new.cor_primaria is distinct from old.cor_primaria or new.cor_secundaria is distinct from old.cor_secundaria)
     and not app.has_feature(new.id, 'cores') then
    raise exception 'recurso_indisponivel_no_plano: cores' using errcode = '42501';
  end if;
  if new.google_review_url is distinct from old.google_review_url and new.google_review_url is not null
     and not app.has_feature(new.id, 'avaliacao_google') then
    raise exception 'recurso_indisponivel_no_plano: avaliacao_google' using errcode = '42501';
  end if;
  if new.modo_atendimento = 'chamar_pedir' and old.modo_atendimento is distinct from 'chamar_pedir'
     and not app.has_feature(new.id, 'pedidos') then
    raise exception 'recurso_indisponivel_no_plano: pedidos' using errcode = '42501';
  end if;
  if new.alerta_minutos is distinct from old.alerta_minutos and not app.has_feature(new.id, 'alerta_gerente') then
    raise exception 'recurso_indisponivel_no_plano: alerta_gerente' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger tenants_plano before update on public.tenants
  for each row execute function app.trg_tenants_plano();

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
-- pin_hash fica de fora: nunca sai do banco para o cliente
grant select (id, tenant_id, user_id, papel, nome, setores, ativo, created_at) on public.memberships to authenticated;
grant update (nome, papel, setores, ativo) on public.memberships to authenticated;

create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or app.has_role(tenant_id, '{dono,gerente}'));
-- só o dono mexe na equipe, e nunca na própria linha (não pode se rebaixar/desativar por engano)
create policy memberships_update on public.memberships for update to authenticated
  using (app.has_role(tenant_id, '{dono}') and user_id <> auth.uid() and app.tenant_active(tenant_id))
  with check (app.has_role(tenant_id, '{dono}') and user_id <> auth.uid());
-- insert/delete: só pelo servidor (criação de usuário exige a API admin do Supabase)

create policy platform_admins_self on public.platform_admins for select to authenticated
  using (user_id = auth.uid());
grant select on public.platform_admins to authenticated;

-- ---------------------------------------------------------------------------
-- tables (mesas)
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.tables to authenticated;
grant update (nome, area, ordem, ativa) on public.tables to authenticated;

create policy tables_select on public.tables for select to authenticated using (app.is_member(tenant_id));
create policy tables_insert on public.tables for insert to authenticated
  with check (app.has_role(tenant_id, '{dono,gerente}') and app.tenant_active(tenant_id));
create policy tables_update on public.tables for update to authenticated
  using (app.has_role(tenant_id, '{dono,gerente}') and app.tenant_active(tenant_id))
  with check (app.has_role(tenant_id, '{dono,gerente}'));
create policy tables_delete on public.tables for delete to authenticated
  using (app.has_role(tenant_id, '{dono,gerente}') and app.tenant_active(tenant_id));

-- limite de mesas por plano (vale para todo mundo, inclusive servidor)
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
  select count(*) into v_qtd from public.tables where tenant_id = new.tenant_id;
  if v_qtd >= v_max then
    raise exception 'limite_de_mesas_do_plano: %', v_max using errcode = '42501';
  end if;
  return new;
end $$;
create trigger tables_limite before insert on public.tables
  for each row execute function app.trg_tables_limite();

-- ---------------------------------------------------------------------------
-- categories / products
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.categories to authenticated;
grant update (nome, ordem, ativa) on public.categories to authenticated;
create policy categories_select on public.categories for select to authenticated using (app.is_member(tenant_id));
create policy categories_insert on public.categories for insert to authenticated
  with check (app.has_role(tenant_id, '{dono,gerente}') and app.tenant_active(tenant_id));
create policy categories_update on public.categories for update to authenticated
  using (app.has_role(tenant_id, '{dono,gerente}') and app.tenant_active(tenant_id))
  with check (app.has_role(tenant_id, '{dono,gerente}'));
create policy categories_delete on public.categories for delete to authenticated
  using (app.has_role(tenant_id, '{dono,gerente}') and app.tenant_active(tenant_id));

grant select, insert, delete on public.products to authenticated;
grant update (categoria_id, nome, descricao, preco, preco_antigo, foto_url, video_url, poster_url,
  destaque, disponivel, ordem, tags, combina_com) on public.products to authenticated;
create policy products_select on public.products for select to authenticated using (app.is_member(tenant_id));
create policy products_insert on public.products for insert to authenticated
  with check (app.has_role(tenant_id, '{dono,gerente}') and app.tenant_active(tenant_id));
create policy products_update on public.products for update to authenticated
  using (app.has_role(tenant_id, '{dono,gerente}') and app.tenant_active(tenant_id))
  with check (app.has_role(tenant_id, '{dono,gerente}'));
create policy products_delete on public.products for delete to authenticated
  using (app.has_role(tenant_id, '{dono,gerente}') and app.tenant_active(tenant_id));

-- Integridade (vale sempre): "Combina com" só aponta para itens do mesmo estabelecimento
create or replace function app.trg_products_integridade()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_fora int;
begin
  if coalesce(array_length(new.combina_com, 1), 0) > 0 then
    select count(*) into v_fora from unnest(new.combina_com) c(id)
    where c.id = new.id
       or not exists (select 1 from public.products p where p.id = c.id and p.tenant_id = new.tenant_id);
    if v_fora > 0 then
      raise exception 'combina_com_invalido' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- Plano (só para chamadas do app): Reels e "Combina com".
-- Função SEM security definer, para current_user ser quem chamou.
create or replace function app.trg_products_plano()
returns trigger language plpgsql as $$
begin
  if not app.is_client_role() then return new; end if;
  if new.video_url is not null and (tg_op = 'INSERT' or new.video_url is distinct from old.video_url)
     and not app.has_feature(new.tenant_id, 'reels') then
    raise exception 'recurso_indisponivel_no_plano: reels' using errcode = '42501';
  end if;
  if coalesce(array_length(new.combina_com, 1), 0) > 0
     and (tg_op = 'INSERT' or new.combina_com is distinct from old.combina_com)
     and not app.has_feature(new.tenant_id, 'combina_com') then
    raise exception 'recurso_indisponivel_no_plano: combina_com' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger products_plano before insert or update on public.products
  for each row execute function app.trg_products_plano();
create trigger products_integridade before insert or update on public.products
  for each row execute function app.trg_products_integridade();

-- ---------------------------------------------------------------------------
-- sessions / calls (chamados)
-- ---------------------------------------------------------------------------
grant select on public.sessions to authenticated;
grant update (encerrada_em) on public.sessions to authenticated;
create policy sessions_select on public.sessions for select to authenticated using (app.is_member(tenant_id));
create policy sessions_update on public.sessions for update to authenticated
  using (app.is_member(tenant_id) and app.tenant_active(tenant_id)) with check (app.is_member(tenant_id));

grant select on public.calls to authenticated;
grant update (status) on public.calls to authenticated;
create policy calls_select on public.calls for select to authenticated using (app.is_member(tenant_id));
create policy calls_update on public.calls for update to authenticated
  using (app.has_role(tenant_id, '{dono,gerente,garcom}') and app.tenant_active(tenant_id))
  with check (app.has_role(tenant_id, '{dono,gerente,garcom}'));
-- chamados são criados só pelo servidor, via public.criar_chamado()

-- Transições válidas + quem/quando preenchidos pelo banco (o cliente não escolhe)
create or replace function app.trg_calls_transicao()
returns trigger language plpgsql as $$
begin
  if not app.is_client_role() then return new; end if;
  if old.status = new.status then return new; end if;
  if old.status = 'aberto' and new.status = 'a_caminho' then
    new.aceito_em := now(); new.aceito_por := auth.uid();
  elsif old.status in ('aberto', 'a_caminho') and new.status = 'atendido' then
    new.atendido_em := now(); new.atendido_por := auth.uid();
    if new.aceito_em is null then new.aceito_em := now(); new.aceito_por := auth.uid(); end if;
  elsif old.status in ('aberto', 'a_caminho') and new.status = 'cancelado' then
    new.cancelado_em := now();
  else
    raise exception 'transicao_invalida: % -> %', old.status, new.status using errcode = '23514';
  end if;
  return new;
end $$;
create trigger calls_transicao before update on public.calls
  for each row execute function app.trg_calls_transicao();

-- conta atendida = mesa liberada
create or replace function app.trg_calls_fecha_sessao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'conta' and new.status = 'atendido' and old.status <> 'atendido' then
    update public.sessions set encerrada_em = now()
    where table_id = new.table_id and encerrada_em is null;
  end if;
  return new;
end $$;
create trigger calls_fecha_sessao after update on public.calls
  for each row execute function app.trg_calls_fecha_sessao();

-- ---------------------------------------------------------------------------
-- events (métricas): leitura só para quem tem painel do dono
-- ---------------------------------------------------------------------------
grant select on public.events to authenticated;
create policy events_select on public.events for select to authenticated
  using (app.has_role(tenant_id, '{dono,gerente}') and app.has_feature(tenant_id, 'painel_dono_basico'));

-- ---------------------------------------------------------------------------
-- push_subscriptions: cada um vê/apaga só as suas; criação pelo servidor (confere plano)
-- ---------------------------------------------------------------------------
grant select, delete on public.push_subscriptions to authenticated;
create policy push_own_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- orders (fase 2): só com o recurso "pedidos" do plano Completo
-- ---------------------------------------------------------------------------
grant select on public.orders, public.order_items to authenticated;
grant update (status) on public.orders to authenticated;
create policy orders_select on public.orders for select to authenticated
  using (app.is_member(tenant_id) and app.has_feature(tenant_id, 'pedidos'));
create policy orders_update on public.orders for update to authenticated
  using (app.is_member(tenant_id) and app.has_feature(tenant_id, 'pedidos'))
  with check (app.is_member(tenant_id));
create policy order_items_select on public.order_items for select to authenticated
  using (app.is_member(tenant_id) and app.has_feature(tenant_id, 'pedidos'));

-- ---------------------------------------------------------------------------
-- Tempo real (Supabase Realtime respeita o RLS acima)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.calls, public.sessions;
  end if;
end $$;
alter table public.calls replica identity full;
alter table public.sessions replica identity full;
