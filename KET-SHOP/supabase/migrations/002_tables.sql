-- =====================================================================
-- Elite Shop — 002: Tabelas, chaves estrangeiras e constraints
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles: 1:1 com auth.users (criado automaticamente por trigger)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null default '' check (char_length(full_name) <= 120),
  email           text check (email is null or char_length(email) <= 254),
  phone           text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  avatar_url      text,
  last_player_id  text check (last_player_id is null or last_player_id ~ '^[0-9]{5,15}$'),
  is_blocked      boolean not null default false,
  blocked_reason  text check (blocked_reason is null or char_length(blocked_reason) <= 300),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- user_roles: papéis (admin / operator / customer)
-- ---------------------------------------------------------------------
create table if not exists public.user_roles (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.app_role not null,
  granted_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint user_roles_unique unique (user_id, role)
);

-- ---------------------------------------------------------------------
-- product_categories
-- ---------------------------------------------------------------------
create table if not exists public.product_categories (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name         text not null check (char_length(name) between 2 and 60),
  description  text check (description is null or char_length(description) <= 300),
  game         text not null default 'Free Fire',
  icon         text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- products: catálogo dinâmico (preços editáveis no painel)
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.product_categories(id) on delete restrict,
  sku           text unique check (sku is null or sku ~ '^[A-Z0-9-]{2,40}$'),
  name          text not null check (char_length(name) between 2 and 80),
  description   text check (description is null or char_length(description) <= 600),
  game          text not null default 'Free Fire',
  base_amount   integer check (base_amount is null or base_amount >= 0),
  bonus_amount  integer not null default 0 check (bonus_amount >= 0),
  total_amount  integer generated always as (coalesce(base_amount, 0) + bonus_amount) stored,
  unit_label    text not null default 'diamantes',
  price_kz      numeric(12,2) not null check (price_kz > 0),
  is_active     boolean not null default true,
  is_on_demand  boolean not null default false,  -- apenas por encomenda
  is_featured   boolean not null default false,
  image_url     text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- payment_methods: dados configurados no painel (nunca inventados)
-- ---------------------------------------------------------------------
create table if not exists public.payment_methods (
  id              uuid primary key default gen_random_uuid(),
  type            public.payment_method_type not null,
  name            text not null check (char_length(name) between 2 and 60),
  description     text check (description is null or char_length(description) <= 300),
  instructions    text check (instructions is null or char_length(instructions) <= 2000),
  account_holder  text,
  bank_name       text,
  iban            text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[0-9A-Z ]{10,40}$'),
  account_number  text,
  phone_number    text check (phone_number is null or phone_number ~ '^\+?[0-9 ]{7,20}$'),
  entity          text,
  reference       text,
  extra           jsonb not null default '{}'::jsonb,
  is_active       boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                       uuid primary key default gen_random_uuid(),
  order_code               text not null unique check (order_code ~ '^(ELT|KET)-[0-9]{6}-[A-Z0-9]{6}$'),
  user_id                  uuid references public.profiles(id) on delete set null,
  status                   public.order_status not null default 'pending_payment',
  game                     text not null default 'Free Fire',
  player_id                text not null check (player_id ~ '^[0-9]{5,15}$'),
  player_nickname          text check (player_nickname is null or char_length(player_nickname) <= 40),
  subtotal_kz              numeric(12,2) not null check (subtotal_kz > 0),
  total_kz                 numeric(12,2) not null check (total_kz > 0),
  payment_method_id        uuid references public.payment_methods(id) on delete set null,
  payment_method_snapshot  jsonb,
  customer_notes           text check (customer_notes is null or char_length(customer_notes) <= 500),
  admin_notes              text check (admin_notes is null or char_length(admin_notes) <= 1000),
  rejection_reason         text check (rejection_reason is null or char_length(rejection_reason) <= 500),
  cancel_reason            text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  is_on_demand             boolean not null default false,
  processed_by             uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  payment_submitted_at     timestamptz,
  approved_at              timestamptz,
  completed_at             timestamptz,
  cancelled_at             timestamptz
);

-- ---------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------
create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,
  product_name      text not null,
  product_snapshot  jsonb not null default '{}'::jsonb,
  quantity          integer not null default 1 check (quantity between 1 and 10),
  unit_price_kz     numeric(12,2) not null check (unit_price_kz > 0),
  total_amount      integer not null default 0 check (total_amount >= 0),
  line_total_kz     numeric(12,2) not null check (line_total_kz > 0),
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- payment_proofs: metadados dos comprovativos (ficheiro no Storage privado)
-- ---------------------------------------------------------------------
create table if not exists public.payment_proofs (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  storage_path  text not null unique,
  file_name     text check (file_name is null or char_length(file_name) <= 200),
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  status        public.proof_status not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  review_notes  text check (review_notes is null or char_length(review_notes) <= 500),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        public.notification_type not null default 'general',
  title       text not null check (char_length(title) between 1 and 120),
  body        text not null check (char_length(body) between 1 and 1000),
  order_id    uuid references public.orders(id) on delete set null,
  is_read     boolean not null default false,
  read_at     timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- app_settings: chave/valor (JSON). is_public = legível pela app
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key          text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value        jsonb not null default 'null'::jsonb,
  description  text,
  is_public    boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null
);

-- ---------------------------------------------------------------------
-- order_status_history
-- ---------------------------------------------------------------------
create table if not exists public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  old_status  public.order_status,
  new_status  public.order_status not null,
  note        text,
  changed_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
