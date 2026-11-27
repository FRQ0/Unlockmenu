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

-- ---------------------------------------------------------------------------
-- 6. Comanda do garçom, cozinha e fechamento de conta
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a3', 'cozinha-a@x.com');
insert into public.memberships (tenant_id, user_id, papel, nome) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a3', 'cozinha', 'Cida Cozinha');

set role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a2'); -- garçom A (Completo)
select public.t_ok($q$select public.criar_pedido('aaaaaaaa-3333-0000-0000-000000000002', '[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":3,"observacao":"bem gelada"}]', 'mesa da janela')$q$, 'garçom cria pedido');
select public.t_expect_eq($q$select (total * 100)::bigint from public.orders where table_id = 'aaaaaaaa-3333-0000-0000-000000000002'$q$, 4200, 'total calculado com o preço do banco (3 × 14,00)');
select public.t_expect_eq($q$select count(*) from public.sessions where table_id = 'aaaaaaaa-3333-0000-0000-000000000002' and encerrada_em is null$q$, 1, 'pedido abre a mesa');
select public.t_expect_error($q$select public.criar_pedido('aaaaaaaa-3333-0000-0000-000000000002', '[{"product_id":"bbbbbbbb-2222-0000-0000-000000000001","quantidade":1}]')$q$, 'item_invalido', 'não pede produto de outro estabelecimento');
select public.t_expect_error($q$select public.criar_pedido('aaaaaaaa-3333-0000-0000-000000000002', '[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":0}]')$q$, 'item_invalido', 'quantidade inválida recusada');
select public.t_expect_error($q$select public.criar_pedido('aaaaaaaa-3333-0000-0000-000000000002', '[]')$q$, 'pedido_invalido', 'pedido vazio recusado');
select public.t_expect_error($q$insert into public.orders (tenant_id, table_id, total) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-3333-0000-0000-000000000002', 0.01)$q$, 'permission denied', 'não cria pedido direto na tabela (preço manipulado)');
select public.t_expect_error($q$update public.orders set total = 0.01$q$, 'permission denied', 'não altera o total do pedido');
select public.t_expect_error($q$update public.order_items set preco = 0.01$q$, 'permission denied', 'não altera o preço do item');

reset role;
update public.products set disponivel = false where id = 'aaaaaaaa-2222-0000-0000-000000000001';
set role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select public.t_expect_error($q$select public.criar_pedido('aaaaaaaa-3333-0000-0000-000000000002', '[{"product_id":"aaaaaaaa-2222-0000-0000-000000000001","quantidade":1}]')$q$, 'item_invalido', 'não pede prato esgotado');

-- cozinha
select public.t_as('00000000-0000-0000-0000-0000000000a3');
select public.t_expect_eq('select count(*) from public.orders', 1, 'cozinha vê os pedidos');
select public.t_expect_error($q$select public.criar_pedido('aaaaaaaa-3333-0000-0000-000000000002', '[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":1}]')$q$, 'permissão', 'cozinha não cria pedido');
select public.t_ok($q$update public.orders set status = 'preparando'$q$, 'cozinha começa a preparar');
select public.t_expect_error($q$update public.orders set status = 'entregue'$q$, 'transicao_invalida', 'não pula de preparando para entregue');
select public.t_ok($q$update public.orders set status = 'pronto'$q$, 'cozinha marca pronto');
select public.t_expect_error($q$update public.orders set status = 'entregue'$q$, 'sem permissão', 'cozinha não marca entregue');
select public.t_expect_error($q$select public.fechar_conta('aaaaaaaa-3333-0000-0000-000000000002')$q$, 'permissão', 'cozinha não fecha conta');

-- outro estabelecimento não vê nem fecha
select public.t_as('00000000-0000-0000-0000-00000000000b');
select public.t_expect_eq('select count(*) from public.orders', 0, 'outro estabelecimento não vê pedidos');
select public.t_expect_error($q$select public.fechar_conta('aaaaaaaa-3333-0000-0000-000000000002')$q$, 'permissão', 'outro estabelecimento não fecha conta');
select public.t_expect_error($q$select public.criar_pedido('aaaaaaaa-3333-0000-0000-000000000002', '[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":1}]')$q$, 'permissão', 'outro estabelecimento não cria pedido');

-- plano sem o recurso
reset role;
insert into public.tables (id, tenant_id, nome) values ('dddddddd-3333-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000000', 'Mesa 01');
set role authenticated;
select public.t_as('00000000-0000-0000-0000-00000000000d');
select public.t_expect_error($q$select public.criar_pedido('dddddddd-3333-0000-0000-000000000001', (select jsonb_build_array(jsonb_build_object('product_id', id, 'quantidade', 1)) from public.products where nome = 'Pizza'))$q$, 'recurso_indisponivel_no_plano: pedidos', 'Profissional não usa comanda');

-- fechar a conta (precisa estar paga)
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select public.t_expect_error($q$select public.fechar_conta('aaaaaaaa-3333-0000-0000-000000000002')$q$, 'conta_nao_paga', 'não fecha conta sem pagamento');
select public.t_expect_error($q$select public.registrar_pagamento_mesa('aaaaaaaa-3333-0000-0000-000000000002', '[{"metodo":"pix","valor":50}]')$q$, 'pagamento_maior_que_total', 'Pix maior que a conta recusado');
select public.t_expect_eq($q$select (public.registrar_pagamento_mesa('aaaaaaaa-3333-0000-0000-000000000002', '[{"metodo":"pix","valor":20}]') * 100)::bigint$q$, 2200, 'dividir conta: falta 22,00');
select public.t_expect_eq($q$select (public.registrar_pagamento_mesa('aaaaaaaa-3333-0000-0000-000000000002', '[{"metodo":"dinheiro","valor":22,"recebido":50}]') * 100)::bigint$q$, 0, 'dinheiro com troco quita a conta');
select public.t_expect_eq($q$select (public.fechar_conta('aaaaaaaa-3333-0000-0000-000000000002') * 100)::bigint$q$, 4200, 'fechar conta devolve o total');
select public.t_expect_eq($q$select count(*) from public.sessions where table_id = 'aaaaaaaa-3333-0000-0000-000000000002' and encerrada_em is null$q$, 0, 'mesa liberada');
select public.t_expect_eq($q$select count(*) from public.orders where pago_em is not null and status = 'entregue'$q$, 1, 'pedido marcado como pago');
select public.t_expect_error($q$update public.orders set status = 'cancelado'$q$, 'transicao_invalida', 'pedido pago não muda mais');
reset role;

-- ---------------------------------------------------------------------------
-- 7. Fichas e pagamentos
-- ---------------------------------------------------------------------------
reset role;
update public.products set disponivel = true where id = 'aaaaaaaa-2222-0000-0000-000000000001';
set role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a2'); -- garçom A
select public.t_expect_error($q$select public.vender_fichas('[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":2}]', '[{"metodo":"pix","valor":10}]')$q$, 'pagamento_insuficiente', 'ficha não sai sem pagamento completo');
select public.t_expect_error($q$select public.vender_fichas('[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":1}]', '[{"metodo":"boleto","valor":14}]')$q$, 'pagamento_invalido', 'forma de pagamento inválida');
select public.t_expect_error($q$select public.vender_fichas('[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":1},{"product_id":"bbbbbbbb-2222-0000-0000-000000000001","quantidade":1}]', '[{"metodo":"pix","valor":20}]')$q$, 'item_invalido', 'não mistura produtos de outro estabelecimento');
select public.t_expect_eq($q$select count(*) from public.vender_fichas('[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":3}]', '[{"metodo":"credito","valor":42}]')$q$, 3, 'vende 3 fichas (uma por unidade)');
select public.t_expect_eq($q$select (sum(preco) * 100)::bigint from public.fichas$q$, 4200, 'preço das fichas vem do banco');
select public.t_expect_error($q$insert into public.fichas (tenant_id, venda_id, codigo, nome, preco) select tenant_id, venda_id, 'ABCDEF', 'X', 0 from public.fichas limit 1$q$, 'permission denied', 'não cria ficha direto (falsificação)');
select public.t_expect_error($q$update public.fichas set status = 'valida'$q$, 'permission denied', 'não "desusa" ficha');

-- cozinha valida
select public.t_as('00000000-0000-0000-0000-0000000000a3');
select public.t_expect_eq($q$select count(*) from public.usar_ficha('aaaaaaaa-0000-0000-0000-000000000000', (select codigo from public.fichas order by codigo limit 1)) where resultado = 'ok'$q$, 1, 'cozinha valida a ficha');
select public.t_expect_eq($q$select count(*) from public.usar_ficha('aaaaaaaa-0000-0000-0000-000000000000', (select lower(codigo) from public.fichas order by codigo limit 1)) where resultado = 'ja_usada'$q$, 1, 'ficha não vale duas vezes');
select public.t_expect_eq($q$select count(*) from public.usar_ficha('aaaaaaaa-0000-0000-0000-000000000000', 'ZZZZZZ') where resultado = 'nao_encontrada'$q$, 1, 'código inexistente');
select public.t_expect_error($q$select public.vender_fichas('[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":1}]', '[{"metodo":"pix","valor":14}]')$q$, 'permissão', 'cozinha não vende ficha');
select public.t_expect_eq('select count(*) from public.pagamentos', 0, 'cozinha não vê pagamentos');

-- outro estabelecimento não valida
select public.t_as('00000000-0000-0000-0000-00000000000b');
select public.t_expect_error($q$select public.usar_ficha('aaaaaaaa-0000-0000-0000-000000000000', 'ZZZZZZ')$q$, 'permissão', 'outro estabelecimento não valida ficha');
select public.t_expect_eq('select count(*) from public.fichas', 0, 'outro estabelecimento não vê fichas');

-- cancelar venda: garçom não, dono sim
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select public.t_expect_error($q$select public.cancelar_venda((select id from public.vendas limit 1))$q$, 'permissão', 'garçom não cancela venda');
select public.t_as('00000000-0000-0000-0000-00000000000a');
select public.t_ok($q$select public.cancelar_venda((select id from public.vendas limit 1))$q$, 'dono cancela venda');
select public.t_expect_eq($q$select count(*) from public.fichas where status = 'cancelada'$q$, 2, 'fichas não usadas ficam canceladas');
select public.t_expect_eq($q$select count(*) from public.fichas where status = 'usada'$q$, 1, 'ficha já usada continua usada');

-- plano sem o recurso
select public.t_as('00000000-0000-0000-0000-00000000000d');
select public.t_expect_error($q$select public.vender_fichas((select jsonb_build_array(jsonb_build_object('product_id', id, 'quantidade', 1)) from public.products where nome = 'Pizza'), '[{"metodo":"pix","valor":59}]')$q$, 'recurso_indisponivel_no_plano: fichas', 'Profissional não usa fichas');
reset role;

-- ---------------------------------------------------------------------------
-- 8. Cobranças InfinitePay
-- ---------------------------------------------------------------------------
set role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a2'); -- garçom A
select public.t_ok($q$select public.criar_pedido('aaaaaaaa-3333-0000-0000-000000000001', '[{"product_id":"aaaaaaaa-2222-0000-0000-000000000001","quantidade":1}]')$q$, 'pedido para cobrar');
select public.t_expect_error($q$select public.criar_cobranca('aaaaaaaa-0000-0000-0000-000000000000', 'mesa', 'link', 'aaaaaaaa-3333-0000-0000-000000000001', 500, null, 1)$q$, 'pagamento_maior_que_total', 'cobrança não passa da conta');
select public.t_expect_error($q$select public.criar_cobranca('bbbbbbbb-0000-0000-0000-000000000000', 'fichas', 'link', null, 10, null, 1)$q$, 'permissão', 'não cobra em nome de outro estabelecimento');
select public.t_expect_error($q$select public.criar_cobranca('aaaaaaaa-0000-0000-0000-000000000000', 'mesa', 'tap', 'aaaaaaaa-3333-0000-0000-000000000001', 10, 'debito', 3)$q$, 'cobranca_invalida', 'débito não parcela');
select public.t_expect_eq($q$select count(*) from public.criar_cobranca('aaaaaaaa-0000-0000-0000-000000000000', 'mesa', 'link', 'aaaaaaaa-3333-0000-0000-000000000001', 89.9, null, 1)$q$, 1, 'garçom cria cobrança da mesa');
select public.t_expect_error('select token from public.cobrancas', 'permission denied', 'token secreto da cobrança não é legível');
select public.t_expect_error($q$select public.confirmar_cobranca((select id from public.cobrancas limit 1), 'pix', 'x', null, null, null)$q$, 'permission denied', 'garçom não confirma cobrança sozinho');
reset role;
set role service_role;
select public.t_expect_eq($q$select count(*) from public.confirmar_cobranca((select id from public.cobrancas where origem = 'mesa' limit 1), 'pix', 'nsu-1', null, 'slug', null) where confirmar_cobranca = 'usada'$q$, 1, 'servidor confirma: vira pagamento da mesa');
select public.t_expect_eq($q$select count(*) from public.confirmar_cobranca((select id from public.cobrancas where origem = 'mesa' limit 1), 'pix', 'nsu-1', null, 'slug', null) where confirmar_cobranca = 'usada'$q$, 1, 'aviso repetido não duplica');
select public.t_expect_eq($q$select count(*) from public.pagamentos where cobranca_id is not null$q$, 1, 'um pagamento só por cobrança');
reset role;
set role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select public.t_expect_eq($q$select count(*) from public.criar_cobranca('aaaaaaaa-0000-0000-0000-000000000000', 'fichas', 'tap', null, 14, 'credito', 1)$q$, 1, 'cobrança de fichas');
select public.t_expect_error($q$select public.vender_fichas('[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":1}]', jsonb_build_array(jsonb_build_object('metodo','credito','valor',14,'cobranca_id',(select id from public.cobrancas where origem = 'fichas'))))$q$, 'cobranca_nao_paga', 'ficha não sai com cobrança não paga');
reset role;
set role service_role;
select public.confirmar_cobranca((select id from public.cobrancas where origem = 'fichas'), null, 'nsu-2', 'AUT1', null, null);
reset role;
set role authenticated;
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select public.t_expect_eq($q$select count(*) from public.vender_fichas('[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":1}]', jsonb_build_array(jsonb_build_object('metodo','credito','valor',14,'cobranca_id',(select id from public.cobrancas where origem = 'fichas'))))$q$, 1, 'ficha sai com cobrança paga');
select public.t_expect_error($q$select public.vender_fichas('[{"product_id":"aaaaaaaa-2222-0000-0000-000000000002","quantidade":1}]', jsonb_build_array(jsonb_build_object('metodo','credito','valor',14,'cobranca_id',(select id from public.cobrancas where origem = 'fichas'))))$q$, 'cobranca_nao_paga', 'cobrança paga não serve duas vezes');
reset role;

-- ---------------------------------------------------------------------------
-- 9. Remover mesa com histórico arquiva (não perde vendas)
-- ---------------------------------------------------------------------------
set role authenticated;
select public.t_as('00000000-0000-0000-0000-00000000000a');
select public.t_expect_eq($q$select count(*) from public.remover_mesa('aaaaaaaa-3333-0000-0000-000000000002') where remover_mesa = 'arquivada'$q$, 1, 'mesa com vendas é arquivada');
select public.t_expect_eq($q$select count(*) from public.orders where table_id = 'aaaaaaaa-3333-0000-0000-000000000002'$q$, 1, 'vendas da mesa arquivada continuam');
select public.t_ok($q$insert into public.tables (tenant_id, nome) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Mesa nova')$q$, 'cria mesa nova');
select public.t_expect_eq($q$select count(*) from public.remover_mesa((select id from public.tables where nome = 'Mesa nova')) where remover_mesa = 'apagada'$q$, 1, 'mesa sem histórico é apagada');
select public.t_as('00000000-0000-0000-0000-0000000000a2');
select public.t_expect_error($q$select public.remover_mesa('aaaaaaaa-3333-0000-0000-000000000001')$q$, 'permissão', 'garçom não remove mesa');
reset role;
