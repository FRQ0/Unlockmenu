-- Unlock Menu · esquema principal
-- Multi-tenant: toda tabela de dados tem tenant_id e é isolada por RLS (ver 0002_rls.sql).

create extension if not exists pgcrypto;
create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.plano_t as enum ('essencial', 'profissional', 'completo');
create type public.tenant_status_t as enum ('teste', 'ativo', 'suspenso');
create type public.papel_t as enum ('dono', 'gerente', 'garcom', 'cozinha');
create type public.chamado_tipo_t as enum ('garcom', 'conta');
create type public.chamado_status_t as enum ('aberto', 'a_caminho', 'atendido', 'cancelado');
create type public.modo_atendimento_t as enum ('chamar', 'chamar_pedir');
create type public.evento_tipo_t as enum (
  'scan_mesa', 'view_cardapio', 'view_produto', 'play_reels', 'click_combina', 'click_avaliacao'
);

-- ---------------------------------------------------------------------------
-- Planos e recursos (a fonte da verdade no servidor; espelhada em src/lib/plans.ts
-- e conferida por teste automatizado)
-- ---------------------------------------------------------------------------
create table public.plan_features (
  plano public.plano_t not null,
  feature text not null,
  primary key (plano, feature)
);

create table public.plan_limits (
  plano public.plano_t primary key,
  max_mesas int,             -- null = ilimitado
  videos_inclusos int not null default 0
);

insert into public.plan_limits (plano, max_mesas, videos_inclusos) values
  ('essencial', 10, 0),
  ('profissional', 25, 0),
  ('completo', null, 5);

insert into public.plan_features (plano, feature) values
  -- Essencial
  ('essencial', 'chamar_garcom'),
  ('essencial', 'cardapio_foto'),
  ('essencial', 'logo'),
  -- Profissional
  ('profissional', 'chamar_garcom'),
  ('profissional', 'cardapio_foto'),
  ('profissional', 'logo'),
  ('profissional', 'cores'),
  ('profissional', 'reels'),
  ('profissional', 'painel_garcom_grade'),
  ('profissional', 'painel_garcom_som'),
  ('profissional', 'painel_dono_basico'),
  -- Completo
  ('completo', 'chamar_garcom'),
  ('completo', 'cardapio_foto'),
  ('completo', 'logo'),
  ('completo', 'cores'),
  ('completo', 'reels'),
  ('completo', 'painel_garcom_grade'),
  ('completo', 'painel_garcom_som'),
  ('completo', 'painel_garcom_setores'),
  ('completo', 'push'),
  ('completo', 'combina_com'),
  ('completo', 'pedidos'),
  ('completo', 'avaliacao_google'),
  ('completo', 'alerta_gerente'),
  ('completo', 'painel_dono_basico'),
  ('completo', 'painel_dono_completo'),
  ('completo', 'site_institucional'),
  ('completo', 'dominio_proprio');

-- ---------------------------------------------------------------------------
-- Estabelecimentos
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 80),
  slug text not null unique check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) between 3 and 40
    and slug not in ('app', 'api', 'login', 'admin-master', 'planos', 'demo', 'static', 'brand', 'sw', 'manifest', 'www', '_next')
  ),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  capa_url text check (capa_url is null or capa_url ~ '^https://'),
  cor_primaria text check (cor_primaria is null or cor_primaria ~ '^#[0-9a-fA-F]{6}$'),
  cor_secundaria text check (cor_secundaria is null or cor_secundaria ~ '^#[0-9a-fA-F]{6}$'),
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
  endereco text check (endereco is null or char_length(endereco) <= 200),
  horarios text check (horarios is null or char_length(horarios) <= 500),
  google_review_url text check (google_review_url is null or google_review_url ~ '^https://'),
  modo_atendimento public.modo_atendimento_t not null default 'chamar',
  alerta_minutos int not null default 5 check (alerta_minutos between 1 and 60),
  plano public.plano_t not null default 'essencial',
  status public.tenant_status_t not null default 'teste',
  trial_ends_at timestamptz,
  pago_ate date,
  dominio_custom text unique check (dominio_custom is null or dominio_custom ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  created_at timestamptz not null default now()
);

-- Equipe: liga usuários (auth.users) a estabelecimentos com um papel
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel public.papel_t not null,
  nome text not null check (char_length(nome) between 1 and 60),
  setores text[] not null default '{}',
  pin_hash text,           -- bcrypt (pgcrypto). Nunca guardamos o PIN puro.
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index on public.memberships (user_id);

-- Super-admins do SaaS (dono da Unlock). Exigem 2FA (aal2).
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Mesas, cardápio
-- ---------------------------------------------------------------------------
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 30),
  -- token impossível de adivinhar (122 bits aleatórios), vai no QR/NFC
  token_publico text not null unique default replace(gen_random_uuid()::text, '-', ''),
  area text check (area is null or char_length(area) <= 30),
  ordem int not null default 0,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create index on public.tables (tenant_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  ordem int not null default 0,
  ativa boolean not null default true,
  unique (id, tenant_id)
);
create index on public.categories (tenant_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  categoria_id uuid,
  nome text not null check (char_length(nome) between 1 and 80),
  descricao text check (descricao is null or char_length(descricao) <= 500),
  preco numeric(10, 2) not null check (preco >= 0 and preco < 100000),
  preco_antigo numeric(10, 2) check (preco_antigo is null or (preco_antigo >= 0 and preco_antigo < 100000)),
  foto_url text check (foto_url is null or foto_url ~ '^https://'),
  video_url text check (video_url is null or video_url ~ '^https://'),
  poster_url text check (poster_url is null or poster_url ~ '^https://'),
  destaque boolean not null default false,
  disponivel boolean not null default true,
  ordem int not null default 0,
  tags text[] not null default '{}' check (tags <@ array['vegano', 'vegetariano', 'sem_gluten', 'sem_lactose', 'picante']::text[]),
  combina_com uuid[] not null default '{}' check (coalesce(array_length(combina_com, 1), 0) <= 2),
  created_at timestamptz not null default now(),
  -- integridade entre tenants: a categoria tem que ser do MESMO estabelecimento
  foreign key (categoria_id, tenant_id) references public.categories (id, tenant_id) on delete set null (categoria_id)
);
create index on public.products (tenant_id, categoria_id);

-- ---------------------------------------------------------------------------
-- Atendimento
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  table_id uuid not null,
  iniciada_em timestamptz not null default now(),
  ultima_atividade timestamptz not null default now(),
  encerrada_em timestamptz,
  foreign key (table_id, tenant_id) references public.tables (id, tenant_id) on delete cascade
);
create index on public.sessions (tenant_id, table_id) where encerrada_em is null;

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  table_id uuid not null,
  tipo public.chamado_tipo_t not null,
  status public.chamado_status_t not null default 'aberto',
  criado_em timestamptz not null default now(),
  aceito_em timestamptz,
  aceito_por uuid references auth.users (id) on delete set null,
  atendido_em timestamptz,
  atendido_por uuid references auth.users (id) on delete set null,
  cancelado_em timestamptz,
  alertado_em timestamptz,
  ip_hash text,
  foreign key (table_id, tenant_id) references public.tables (id, tenant_id) on delete cascade
);
create index on public.calls (tenant_id, criado_em desc);
-- anti-spam: só 1 chamado em aberto por mesa
create unique index calls_um_aberto_por_mesa on public.calls (table_id) where status in ('aberto', 'a_caminho');

create table public.events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tipo public.evento_tipo_t not null,
  product_id uuid references public.products (id) on delete set null,
  table_id uuid references public.tables (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on public.events (tenant_id, criado_em desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Fase 2 (pedido pelo celular). Esquema e segurança já prontos; telas na fase 2.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  table_id uuid not null,
  status text not null default 'novo' check (status in ('novo', 'preparando', 'pronto', 'entregue', 'cancelado')),
  total numeric(10, 2) not null default 0,
  criado_em timestamptz not null default now(),
  foreign key (table_id, tenant_id) references public.tables (id, tenant_id) on delete cascade,
  unique (id, tenant_id)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  order_id uuid not null,
  product_id uuid references public.products (id) on delete set null,
  nome text not null,
  preco numeric(10, 2) not null,
  quantidade int not null check (quantidade between 1 and 50),
  observacao text check (observacao is null or char_length(observacao) <= 200),
  foreign key (order_id, tenant_id) references public.orders (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Infra de segurança
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  chave text primary key,
  janela_inicio timestamptz not null,
  hits int not null
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  tenant_id uuid,
  acao text not null,
  detalhes jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
