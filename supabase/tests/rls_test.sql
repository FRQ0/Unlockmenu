-- Testes de segurança do banco: isolamento entre estabelecimentos (RLS),
-- mass assignment (permissões por coluna) e travas de plano no servidor.
\set QUIET on

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------
create function public.t_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
end $$;

-- executa SQL e exige um erro contendo o trecho esperado
create function public.t_expect_error(p_sql text, p_trecho text, p_nome text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_trecho in sqlerrm) > 0 then
      raise notice 'ok  %', p_nome;
      return;
    end if;
    raise exception 'FALHOU %: erro inesperado "%"', p_nome, sqlerrm;
  end;
  raise exception 'FALHOU %: deveria ter dado erro "%"', p_nome, p_trecho;
end $$;

create function public.t_expect_eq(p_sql text, p_esperado bigint, p_nome text) returns void language plpgsql as $$
declare v bigint;
begin
  execute p_sql into v;
  if v is distinct from p_esperado then
    raise exception 'FALHOU %: esperado %, veio %', p_nome, p_esperado, v;
  end if;
  raise notice 'ok  %', p_nome;
end $$;

-- executa e exige sucesso
create function public.t_ok(p_sql text, p_nome text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise notice 'ok  %', p_nome;
exception when others then
  raise exception 'FALHOU %: %', p_nome, sqlerrm;
end $$;

grant execute on function public.t_as(uuid), public.t_expect_error(text, text, text),
  public.t_expect_eq(text, bigint, text), public.t_ok(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Dados
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dono-a@x.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'garcom-a@x.com'),
  ('00000000-0000-0000-0000-00000000000b', 'dono-b@x.com'),
  ('00000000-0000-0000-0000-00000000000c', 'dono-c@x.com'),
  ('00000000-0000-0000-0000-00000000000d', 'dono-d@x.com');

insert into public.tenants (id, nome, slug, plano, status, trial_ends_at) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Restaurante A', 'rest-a', 'completo', 'ativo', null),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Padaria B', 'padaria-b', 'essencial', 'ativo', null),
  ('cccccccc-0000-0000-0000-000000000000', 'Bar C', 'bar-c', 'profissional', 'teste', now() - interval '1 day'),
  ('dddddddd-0000-0000-0000-000000000000', 'Pizzaria D', 'pizzaria-d', 'profissional', 'teste', now() + interval '6 days');

insert into public.memberships (tenant_id, user_id, papel, nome) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'dono', 'Ana Dona'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2', 'garcom', 'Gui Garçom'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'dono', 'Bia Dona'),
  ('cccccccc-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000c', 'dono', 'Caio Dono'),
  ('dddddddd-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000d', 'dono', 'Davi Dono');
select public.definir_pin(id, '1234') from public.memberships where nome = 'Gui Garçom';

insert into public.categories (id, tenant_id, nome) values
  ('aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Pratos'),
  ('bbbbbbbb-1111-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'Pães');
insert into public.products (id, tenant_id, categoria_id, nome, preco) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', 'Picanha', 89.9),
  ('aaaaaaaa-2222-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-1111-0000-0000-000000000000', 'Cerveja', 14),
  ('bbbbbbbb-2222-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-1111-0000-0000-000000000000', 'Pão de queijo', 6),
  ('cccccccc-2222-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000000', null, 'Chopp', 12);
insert into public.tables (id, tenant_id, nome, token_publico) values
  ('aaaaaaaa-3333-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Mesa 01', 'token-mesa-a1'),
  ('aaaaaaaa-3333-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'Mesa 02', 'token-mesa-a2'),
  ('cccccccc-3333-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000000', 'Mesa 01', 'token-mesa-c1');
insert into public.events (tenant_id, tipo) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'scan_mesa'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'scan_mesa');

-- ---------------------------------------------------------------------------
-- 1. Visitante anônimo não acessa nada
-- ---------------------------------------------------------------------------
set role anon;
select public.t_expect_error('select * from public.tenants', 'permission denied', 'anon não lê tenants');
select public.t_expect_error('select * from public.products', 'permission denied', 'anon não lê produtos');
select public.t_expect_error('select * from public.calls', 'permission denied', 'anon não lê chamados');
select public.t_expect_error($q$insert into public.calls (tenant_id, table_id, tipo) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-3333-0000-0000-000000000001', 'garcom')$q$, 'permission denied', 'anon não cria chamado direto');
select public.t_expect_error($q$select public.criar_chamado('token-mesa-a1', 'garcom', null)$q$, 'permission denied', 'anon não executa criar_chamado');
reset role;

-- ---------------------------------------------------------------------------
-- 2. Isolamento entre estabelecimentos
-- ---------------------------------------------------------------------------
set role authenticated;
select public.t_as('00000000-0000-0000-0000-00000000000a');
select public.t_expect_eq('select count(*) from public.tenants', 1, 'dono A vê só o próprio tenant');
select public.t_expect_eq($q$select count(*) from public.products where tenant_id <> 'aaaaaaaa-0000-0000-0000-000000000000'$q$, 0, 'dono A não vê produtos de outros');
select public.t_expect_eq('select count(*) from public.products', 2, 'dono A vê os 2 produtos dele');
select public.t_expect_error($q$insert into public.products (tenant_id, nome, preco) values ('bbbbbbbb-0000-0000-0000-000000000000', 'Invasor', 1)$q$, 'row-level security', 'dono A não insere produto no tenant B');
select public.t_expect_eq($q$with u as (update public.products set preco = 0 where tenant_id = 'bbbbbbbb-0000-0000-0000-000000000000' returning 1) select count(*) from u$q$, 0, 'dono A não altera produto de B');
select public.t_expect_eq($q$with u as (delete from public.products where tenant_id = 'bbbbbbbb-0000-0000-0000-000000000000' returning 1) select count(*) from u$q$, 0, 'dono A não apaga produto de B');
select public.t_expect_error($q$insert into public.products (tenant_id, categoria_id, nome, preco) values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-1111-0000-0000-000000000000', 'Cat de outro', 1)$q$, 'foreign key', 'produto não usa categoria de outro tenant');

-- ---------------------------------------------------------------------------
-- 3. Mass assignment: colunas protegidas
-- ---------------------------------------------------------------------------
select public.t_expect_error($q$update public.tenants set plano = 'completo' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$q$, 'permission denied', 'dono não muda o próprio plano');
select public.t_expect_error($q$update public.tenants set status = 'ativo' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$q$, 'permission denied', 'dono não muda o próprio status');
select public.t_expect_error($q$update public.tenants set trial_ends_at = now() + interval '1 year' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$q$, 'permission denied', 'dono não estende o próprio teste');
select public.t_expect_error($q$update public.products set tenant_id = 'bbbbbbbb-0000-0000-0000-000000000000' where id = 'aaaaaaaa-2222-0000-0000-000000000001'$q$, 'permission denied', 'produto não troca de tenant');
select public.t_expect_eq($q$with u as (update public.memberships set papel = 'garcom' where user_id = '00000000-0000-0000-0000-00000000000a' returning 1) select count(*) from u$q$, 0, 'dono não altera a própria membership');
select public.t_expect_error('select pin_hash from public.memberships', 'permission denied', 'hash do PIN não é legível');
select public.t_ok($q$update public.tenants set nome = 'Restaurante A+', cor_primaria = '#B65A52' where id = 'aaaaaaaa-0000-0000-0000-000000000000'$q$, 'dono A (completo) altera nome e cor');

-- ---------------------------------------------------------------------------
-- 4. Travas de plano no banco
-- ---------------------------------------------------------------------------
select public.t_ok($q$update public.products set video_url = 'https://x.supabase.co/v.mp4', combina_com = '{aaaaaaaa-2222-0000-0000-000000000002}' where id = 'aaaaaaaa-2222-0000-0000-000000000001'$q$, 'completo pode Reels e Combina com');
select public.t_expect_error($q$update public.products set combina_com = '{bbbbbbbb-2222-0000-0000-000000000001}' where id = 'aaaaaaaa-2222-0000-0000-000000000001'$q$, 'combina_com_invalido', 'Combina com não aponta para outro tenant');
select public.t_expect_error($q$update public.products set combina_com = '{aaaaaaaa-2222-0000-0000-000000000001}' where id = 'aaaaaaaa-2222-0000-0000-000000000001'$q$, 'combina_com_invalido', 'Combina com não aponta para si mesmo');

select public.t_as('00000000-0000-0000-0000-00000000000b');
select public.t_expect_error($q$update public.products set video_url = 'https://x.supabase.co/v.mp4' where id = 'bbbbbbbb-2222-0000-0000-000000000001'$q$, 'recurso_indisponivel_no_plano: reels', 'essencial não grava Reels');
select public.t_expect_error($q$insert into public.products (tenant_id, nome, preco, video_url) values ('bbbbbbbb-0000-0000-0000-000000000000', 'X', 1, 'https://x.supabase.co/v.mp4')$q$, 'recurso_indisponivel_no_plano: reels', 'essencial não cria produto com Reels');
select public.t_expect_error($q$update public.tenants set cor_primaria = '#000000' where id = 'bbbbbbbb-0000-0000-0000-000000000000'$q$, 'recurso_indisponivel_no_plano: cores', 'essencial não muda cores');
select public.t_ok($q$update public.tenants set logo_url = 'https://x.supabase.co/logo.webp' where id = 'bbbbbbbb-0000-0000-0000-000000000000'$q$, 'essencial pode trocar o logo');
select public.t_expect_error($q$update public.tenants set modo_atendimento = 'chamar_pedir' where id = 'bbbbbbbb-0000-0000-0000-000000000000'$q$, 'recurso_indisponivel_no_plano: pedidos', 'essencial não liga pedido pelo celular');
select public.t_expect_error($q$update public.tenants set google_review_url = 'https://g.page/r/x' where id = 'bbbbbbbb-0000-0000-0000-000000000000'$q$, 'recurso_indisponivel_no_plano: avaliacao_google', 'essencial não usa avaliação Google');
select public.t_expect_eq('select count(*) from public.events', 0, 'essencial não lê métricas (painel do dono)');
-- limite de 10 mesas
select public.t_ok($q$insert into public.tables (tenant_id, nome) select 'bbbbbbbb-0000-0000-0000-000000000000', 'Mesa ' || g from generate_series(1, 10) g$q$, 'essencial cria 10 mesas');
select public.t_expect_error($q$insert into public.tables (tenant_id, nome) values ('bbbbbbbb-0000-0000-0000-000000000000', 'Mesa 11')$q$, 'limite_de_mesas_do_plano', 'essencial não passa de 10 mesas');

-- profissional em teste válido: Reels sim, Combina com não
select public.t_as('00000000-0000-0000-0000-00000000000d');
select public.t_ok($q$insert into public.products (tenant_id, nome, preco, video_url) values ('dddddddd-0000-0000-0000-000000000000', 'Pizza', 59, 'https://x.supabase.co/p.mp4')$q$, 'profissional (teste no prazo) grava Reels');
select public.t_expect_error($q$update public.products set combina_com = (select array_agg(id) from public.products where nome = 'Pizza') where nome = 'Pizza'$q$, 'combina_com', 'profissional não usa Combina com');

-- teste vencido (8º dia): tudo travado
select public.t_as('00000000-0000-0000-0000-00000000000c');
select public.t_expect_eq($q$with u as (update public.products set preco = 1 where tenant_id = 'cccccccc-0000-0000-0000-000000000000' returning 1) select count(*) from u$q$, 0, 'teste vencido não edita cardápio');
select public.t_expect_error($q$insert into public.categories (tenant_id, nome) values ('cccccccc-0000-0000-0000-000000000000', 'Nova')$q$, 'row-level security', 'teste vencido não cria categoria');

-- ---------------------------------------------------------------------------
-- 5. Garçom: atende chamado, não mexe no cardápio
-- ---------------------------------------------------------------------------
reset role;
set role service_role;
select public.t_expect_eq($q$select count(*) from public.criar_chamado('token-mesa-a1', 'garcom', 'ip1')$q$, 1, 'servidor cria chamado');
select public.t_expect_eq($q$select count(*) from public.calls where table_id = 'aaaaaaaa-3333-0000-0000-000000000001' and status = 'aberto'$q$, 1, 'só 1 chamado aberto');
select public.t_expect_eq($q$select count(*) from public.criar_chamado('token-mesa-a1', 'conta', 'ip1') c join public.calls x on x.id = c.id where x.tipo = 'garcom'$q$, 1, 'segundo toque devolve o mesmo chamado');
select public.t_expect_error($q$select public.criar_chamado('token-mesa-c1', 'garcom', 'ip1')$q$, 'estabelecimento_inativo', 'teste vencido não recebe chamado');
select public.t_expect_error($q$select public.criar_chamado('token-inexistente', 'garcom', 'ip1')$q$, 'mesa_nao_encontrada', 'token inválido');
select public.t_expect_eq($q$select count(*) from public.status_chamado('token-mesa-a2', (select id from public.calls where table_id = 'aaaaaaaa-3333-0000-0000-000000000001' limit 1))$q$, 0, 'outra mesa não vê o chamado');
reset role;

set role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select public.t_expect_error($q$insert into public.products (tenant_id, nome, preco) values ('aaaaaaaa-0000-0000-0000-000000000000', 'X', 1)$q$, 'row-level security', 'garçom não cria produto');
select public.t_expect_error($q$update public.calls set tenant_id = 'bbbbbbbb-0000-0000-0000-000000000000'$q$, 'permission denied', 'garçom não troca tenant do chamado');
select public.t_expect_error($q$update public.calls set aceito_por = '00000000-0000-0000-0000-00000000000a'$q$, 'permission denied', 'garçom não falsifica quem aceitou');
select public.t_expect_error($q$select public.criar_chamado('token-mesa-a1', 'garcom', null)$q$, 'permission denied', 'logado não executa criar_chamado');
select public.t_ok($q$update public.calls set status = 'a_caminho' where status = 'aberto'$q$, 'garçom aceita chamado');
select public.t_expect_eq($q$select count(*) from public.calls where aceito_por = '00000000-0000-0000-0000-0000000000a2' and aceito_em is not null$q$, 1, 'banco grava quem aceitou');
select public.t_expect_error($q$update public.calls set status = 'aberto'$q$, 'transicao_invalida', 'não volta chamado para aberto');
select public.t_expect_error('select * from public.rate_limits', 'permission denied', 'rate_limits fechado');
select public.t_expect_error('select * from public.audit_log', 'permission denied', 'audit_log fechado');
reset role;

-- rate limit genérico
set role service_role;
select public.t_expect_eq($q$select count(*) filter (where ok) from (select public.rate_limit_hit('login:teste', 5, 900) ok from generate_series(1, 8)) s$q$, 5, 'rate limit corta após 5 tentativas');
select public.t_expect_eq($q$select count(*) from public.conferir_pin('rest-a', '1234')$q$, 1, 'PIN correto confere');
select public.t_expect_eq($q$select count(*) from public.conferir_pin('rest-a', '0000') where conferir_pin is not null$q$, 0, 'PIN errado não confere');
select public.t_expect_eq($q$select count(*) from public.memberships where pin_hash like '$2%'$q$, 1, 'PIN guardado com bcrypt');
reset role;
