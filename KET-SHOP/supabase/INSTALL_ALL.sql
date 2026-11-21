-- =====================================================================
-- KET SHOP — INSTALAÇÃO COMPLETA (gerado a partir dos ficheiros individuais)
-- Cole TODO este ficheiro no Supabase Dashboard -> SQL Editor -> Run.
-- É seguro executar novamente (idempotente).
-- Ordem: migrations -> policies -> storage -> seed
-- =====================================================================

-- >>>>>>>>>> migrations/001_extensions_and_types.sql
-- =====================================================================
-- KET SHOP — 001: Extensões e tipos enumerados
-- Executar no SQL Editor do Supabase (ou via `supabase db push`).
-- =====================================================================

-- Papéis de utilizador
do $$ begin
  create type public.app_role as enum ('admin', 'operator', 'customer');
exception when duplicate_object then null; end $$;

-- Estados das encomendas
do $$ begin
  create type public.order_status as enum (
    'pending_payment',   -- Pendente de pagamento
    'proof_submitted',   -- Comprovativo enviado
    'under_review',      -- Em verificação
    'payment_approved',  -- Pagamento aprovado
    'payment_rejected',  -- Pagamento rejeitado
    'processing',        -- Em processamento
    'completed',         -- Concluída
    'cancelled'          -- Cancelada
  );
exception when duplicate_object then null; end $$;

-- Tipos de método de pagamento
do $$ begin
  create type public.payment_method_type as enum (
    'bank_transfer',      -- Transferência bancária / IBAN
    'multicaixa_express', -- Multicaixa Express
    'paypay',             -- PayPay AO
    'reference'           -- Pagamento por referência
  );
exception when duplicate_object then null; end $$;

-- Estado de cada comprovativo
do $$ begin
  create type public.proof_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- Tipos de notificação
do $$ begin
  create type public.notification_type as enum (
    'order_created', 'proof_received', 'payment_approved',
    'payment_rejected', 'order_completed', 'order_status', 'general'
  );
exception when duplicate_object then null; end $$;

-- >>>>>>>>>> migrations/002_tables.sql
-- =====================================================================
-- KET SHOP — 002: Tabelas, chaves estrangeiras e constraints
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
  order_code               text not null unique check (order_code ~ '^KET-[0-9]{6}-[A-Z0-9]{6}$'),
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

-- >>>>>>>>>> migrations/003_indexes.sql
-- =====================================================================
-- KET SHOP — 003: Índices
-- =====================================================================
create index if not exists idx_user_roles_user            on public.user_roles (user_id);
create index if not exists idx_products_category_sort     on public.products (category_id, sort_order);
create index if not exists idx_products_active            on public.products (is_active) where is_active;
create index if not exists idx_categories_sort            on public.product_categories (sort_order);
create index if not exists idx_payment_methods_sort       on public.payment_methods (sort_order);
create index if not exists idx_orders_user_created        on public.orders (user_id, created_at desc);
create index if not exists idx_orders_status_created      on public.orders (status, created_at desc);
create index if not exists idx_orders_created             on public.orders (created_at desc);
create index if not exists idx_orders_payment_method      on public.orders (payment_method_id);
create index if not exists idx_order_items_order          on public.order_items (order_id);
create index if not exists idx_order_items_product        on public.order_items (product_id);
create index if not exists idx_payment_proofs_order       on public.payment_proofs (order_id, created_at desc);
create index if not exists idx_payment_proofs_user        on public.payment_proofs (user_id);
create index if not exists idx_notifications_user         on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_unread       on public.notifications (user_id) where not is_read;
create index if not exists idx_status_history_order       on public.order_status_history (order_id, created_at);
create index if not exists idx_audit_logs_created         on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_entity          on public.audit_logs (entity, entity_id);
create index if not exists idx_audit_logs_actor           on public.audit_logs (actor_id);

-- >>>>>>>>>> migrations/004_functions.sql
-- =====================================================================
-- KET SHOP — 004: Funções (helpers de papéis + RPCs seguras)
-- Todas as operações sensíveis passam por funções SECURITY DEFINER
-- que validam auth.uid() e o papel no servidor. A app e o painel só
-- usam a chave anon + JWT do utilizador.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de papéis
-- ---------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = p_role
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('admin'::public.app_role);
$$;

-- staff = admin OU operator
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('admin', 'operator')
  );
$$;

-- Devolve os papéis do utilizador autenticado (usado pelo painel)
create or replace function public.my_roles()
returns public.app_role[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(ur.role), '{}') from public.user_roles ur where ur.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
end $$;

create or replace function public.generate_order_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_suffix text;
  i int;
begin
  loop
    v_suffix := '';
    for i in 1..6 loop
      v_suffix := v_suffix || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    v_code := 'KET-' || to_char(now() at time zone 'Africa/Luanda', 'YYMMDD') || '-' || v_suffix;
    exit when not exists (select 1 from public.orders o where o.order_code = v_code);
  end loop;
  return v_code;
end $$;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select case jsonb_typeof(s.value) when 'boolean' then (s.value)::text::boolean else null end
                   from public.app_settings s where s.key = p_key), p_default);
$$;

-- ---------------------------------------------------------------------
-- Criação automática de perfil quando um utilizador se regista
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_phone text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
begin
  if v_phone is not null and v_phone !~ '^\+?[0-9 ]{7,20}$' then
    v_phone := null;
  end if;
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    new.email,
    v_phone
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- CLIENTE: criar encomenda (preço lido do servidor — nunca do cliente)
-- ---------------------------------------------------------------------
create or replace function public.create_order(
  p_product_id uuid,
  p_player_id text,
  p_player_nickname text default null,
  p_customer_notes text default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_product public.products;
  v_cat public.product_categories;
  v_open int;
  v_order public.orders;
  v_player text := regexp_replace(coalesce(p_player_id, ''), '\s', '', 'g');
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: sessão inválida' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'PROFILE_NOT_FOUND: perfil inexistente'; end if;
  if v_profile.is_blocked then raise exception 'ACCOUNT_BLOCKED: conta bloqueada'; end if;

  if public.setting_bool('maintenance_mode', false) then
    raise exception 'MAINTENANCE: loja em manutenção';
  end if;

  if v_player !~ '^[0-9]{5,15}$' then
    raise exception 'INVALID_PLAYER_ID: o ID do jogador deve ter entre 5 e 15 dígitos';
  end if;

  select * into v_product from public.products where id = p_product_id and is_active;
  if not found then raise exception 'PRODUCT_UNAVAILABLE: produto indisponível'; end if;

  select * into v_cat from public.product_categories where id = v_product.category_id and is_active;
  if not found then raise exception 'PRODUCT_UNAVAILABLE: categoria indisponível'; end if;

  -- Anti-abuso: máximo de 5 encomendas por pagar em simultâneo
  select count(*) into v_open from public.orders
   where user_id = v_uid and status in ('pending_payment', 'payment_rejected');
  if v_open >= 5 then
    raise exception 'TOO_MANY_OPEN_ORDERS: tem demasiadas encomendas por pagar';
  end if;

  insert into public.orders (order_code, user_id, game, player_id, player_nickname,
                             subtotal_kz, total_kz, customer_notes, is_on_demand)
  values (public.generate_order_code(), v_uid, v_product.game, v_player,
          nullif(left(trim(coalesce(p_player_nickname, '')), 40), ''),
          v_product.price_kz, v_product.price_kz,
          nullif(left(trim(coalesce(p_customer_notes, '')), 500), ''),
          v_product.is_on_demand)
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, product_snapshot,
                                  quantity, unit_price_kz, total_amount, line_total_kz)
  values (v_order.id, v_product.id, v_product.name,
          jsonb_build_object('name', v_product.name, 'category', v_cat.name,
                             'base_amount', v_product.base_amount, 'bonus_amount', v_product.bonus_amount,
                             'total_amount', v_product.total_amount, 'unit_label', v_product.unit_label,
                             'price_kz', v_product.price_kz, 'is_on_demand', v_product.is_on_demand),
          1, v_product.price_kz, v_product.total_amount, v_product.price_kz);

  update public.profiles set last_player_id = v_player where id = v_uid;

  return v_order;
end $$;

-- ---------------------------------------------------------------------
-- CLIENTE: escolher o método de pagamento (guarda snapshot dos dados)
-- ---------------------------------------------------------------------
create or replace function public.set_order_payment_method(p_order_id uuid, p_payment_method_id uuid)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_pm public.payment_methods;
begin
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'ORDER_NOT_FOUND: encomenda não encontrada'; end if;
  if v_order.status not in ('pending_payment', 'payment_rejected') then
    raise exception 'INVALID_STATE: não é possível alterar o pagamento neste estado';
  end if;

  select * into v_pm from public.payment_methods where id = p_payment_method_id and is_active;
  if not found then raise exception 'PAYMENT_METHOD_UNAVAILABLE: método indisponível'; end if;

  update public.orders
     set payment_method_id = v_pm.id,
         payment_method_snapshot = jsonb_build_object(
           'id', v_pm.id, 'type', v_pm.type, 'name', v_pm.name,
           'instructions', v_pm.instructions, 'account_holder', v_pm.account_holder,
           'bank_name', v_pm.bank_name, 'iban', v_pm.iban, 'account_number', v_pm.account_number,
           'phone_number', v_pm.phone_number, 'entity', v_pm.entity, 'reference', v_pm.reference)
   where id = v_order.id
   returning * into v_order;
  return v_order;
end $$;

-- ---------------------------------------------------------------------
-- Verifica se o utilizador pode carregar comprovativo para a pasta
-- <uid>/<order_id>/ (usada pelas políticas do Storage)
-- ---------------------------------------------------------------------
create or replace function public.can_upload_proof(p_order_folder text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if p_order_folder is null
     or p_order_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1 from public.orders o
     where o.id = p_order_folder::uuid
       and o.user_id = auth.uid()
       and o.status in ('pending_payment', 'payment_rejected')
  );
end $$;

-- ---------------------------------------------------------------------
-- CLIENTE: registar comprovativo (depois do upload para o Storage)
-- ---------------------------------------------------------------------
create or replace function public.submit_payment_proof(
  p_order_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes integer
) returns public.payment_proofs
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_proof public.payment_proofs;
  v_prefix text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED: sessão inválida'; end if;

  select * into v_order from public.orders where id = p_order_id and user_id = v_uid for update;
  if not found then raise exception 'ORDER_NOT_FOUND: encomenda não encontrada'; end if;
  if v_order.status not in ('pending_payment', 'payment_rejected') then
    raise exception 'INVALID_STATE: esta encomenda não aceita comprovativos neste momento';
  end if;
  if v_order.payment_method_id is null then
    raise exception 'PAYMENT_METHOD_REQUIRED: escolha primeiro o método de pagamento';
  end if;

  v_prefix := v_uid::text || '/' || v_order.id::text || '/';
  if p_storage_path is null or left(p_storage_path, length(v_prefix)) <> v_prefix
     or p_storage_path ~ '\.\.' then
    raise exception 'INVALID_PATH: caminho de ficheiro inválido';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'INVALID_FILE_TYPE: apenas JPG, PNG ou WEBP';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 5242880 then
    raise exception 'FILE_TOO_LARGE: o ficheiro deve ter no máximo 5 MB';
  end if;

  if not exists (select 1 from storage.objects so
                  where so.bucket_id = 'payment-proofs' and so.name = p_storage_path) then
    raise exception 'FILE_NOT_FOUND: o ficheiro não foi encontrado no armazenamento';
  end if;

  insert into public.payment_proofs (order_id, user_id, storage_path, file_name, mime_type, size_bytes)
  values (v_order.id, v_uid, p_storage_path, left(p_file_name, 200), p_mime_type, p_size_bytes)
  returning * into v_proof;

  perform set_config('ketshop.status_note', 'Comprovativo enviado pelo cliente', true);
  update public.orders
     set status = 'proof_submitted', payment_submitted_at = now(), rejection_reason = null
   where id = v_order.id;

  return v_proof;
end $$;

-- ---------------------------------------------------------------------
-- CLIENTE: cancelar encomenda ainda não paga
-- ---------------------------------------------------------------------
create or replace function public.cancel_my_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'ORDER_NOT_FOUND: encomenda não encontrada'; end if;
  if v_order.status not in ('pending_payment', 'payment_rejected') then
    raise exception 'INVALID_STATE: esta encomenda já não pode ser cancelada pelo cliente';
  end if;
  perform set_config('ketshop.status_note', 'Cancelada pelo cliente', true);
  update public.orders
     set status = 'cancelled', cancelled_at = now(),
         cancel_reason = coalesce(nullif(left(trim(coalesce(p_reason, '')), 500), ''), 'Cancelada pelo cliente')
   where id = v_order.id returning * into v_order;
  return v_order;
end $$;

-- ---------------------------------------------------------------------
-- CLIENTE: notificações
-- ---------------------------------------------------------------------
create or replace function public.mark_notification_read(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.notifications set is_read = true, read_at = now()
   where id = p_id and user_id = auth.uid() and not is_read;
$$;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  update public.notifications set is_read = true, read_at = now()
   where user_id = auth.uid() and not is_read;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.unread_notifications_count()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.notifications where user_id = auth.uid() and not is_read;
$$;

-- ---------------------------------------------------------------------
-- CLIENTE: actualizar o próprio perfil (nome e telefone)
-- ---------------------------------------------------------------------
create or replace function public.update_my_profile(p_full_name text, p_phone text)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
  v_name text := left(trim(coalesce(p_full_name, '')), 120);
  v_phone text := nullif(regexp_replace(trim(coalesce(p_phone, '')), '\s+', ' ', 'g'), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED: sessão inválida'; end if;
  if char_length(v_name) < 2 then raise exception 'INVALID_INPUT: indique o nome completo'; end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9 ]{7,20}$' then
    raise exception 'INVALID_INPUT: número de telefone inválido';
  end if;
  update public.profiles set full_name = v_name, phone = v_phone
   where id = auth.uid() returning * into v_profile;
  return v_profile;
end $$;

-- ---------------------------------------------------------------------
-- ADMIN/OPERADOR: mudar estado da encomenda (com validação de transições)
-- ---------------------------------------------------------------------
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_new_status public.order_status,
  p_note text default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
  v_allowed public.order_status[];
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: acesso reservado à equipa' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND: encomenda não encontrada'; end if;

  v_allowed := case v_order.status
    when 'pending_payment'  then array['under_review', 'cancelled']::public.order_status[]
    when 'proof_submitted'  then array['under_review', 'payment_approved', 'payment_rejected', 'cancelled']::public.order_status[]
    when 'under_review'     then array['payment_approved', 'payment_rejected', 'cancelled']::public.order_status[]
    when 'payment_approved' then array['processing', 'completed', 'cancelled']::public.order_status[]
    when 'payment_rejected' then array['under_review', 'cancelled']::public.order_status[]
    when 'processing'       then array['completed', 'cancelled']::public.order_status[]
    else array[]::public.order_status[]
  end;

  if not (p_new_status = any (v_allowed)) then
    raise exception 'INVALID_TRANSITION: não é possível passar de % para %', v_order.status, p_new_status;
  end if;

  if p_new_status = 'payment_rejected' and v_note is null then
    raise exception 'REASON_REQUIRED: indique o motivo da rejeição';
  end if;
  if p_new_status = 'cancelled' and v_note is null then
    raise exception 'REASON_REQUIRED: indique o motivo do cancelamento';
  end if;

  perform set_config('ketshop.status_note', coalesce(v_note, ''), true);

  update public.orders set
    status           = p_new_status,
    processed_by     = auth.uid(),
    rejection_reason = case when p_new_status = 'payment_rejected' then v_note else rejection_reason end,
    cancel_reason    = case when p_new_status = 'cancelled' then v_note else cancel_reason end,
    approved_at      = case when p_new_status = 'payment_approved' then now() else approved_at end,
    completed_at     = case when p_new_status = 'completed' then now() else completed_at end,
    cancelled_at     = case when p_new_status = 'cancelled' then now() else cancelled_at end
  where id = v_order.id
  returning * into v_order;

  -- Actualiza o estado do comprovativo mais recente
  if p_new_status in ('payment_approved', 'payment_rejected') then
    update public.payment_proofs set
      status = case when p_new_status = 'payment_approved' then 'approved'::public.proof_status
                    else 'rejected'::public.proof_status end,
      reviewed_by = auth.uid(), reviewed_at = now(), review_notes = v_note
    where id = (select pp.id from public.payment_proofs pp
                 where pp.order_id = v_order.id and pp.status = 'pending'
                 order by pp.created_at desc limit 1);
  end if;

  perform public.write_audit('order.status_changed', 'orders', v_order.id::text,
    jsonb_build_object('order_code', v_order.order_code, 'new_status', p_new_status, 'note', v_note));

  return v_order;
end $$;

create or replace function public.admin_update_order_notes(p_order_id uuid, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN: acesso reservado à equipa' using errcode = '42501'; end if;
  update public.orders set admin_notes = nullif(left(trim(coalesce(p_notes, '')), 1000), '') where id = p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND: encomenda não encontrada'; end if;
  perform public.write_audit('order.notes_updated', 'orders', p_order_id::text, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- ADMIN/OPERADOR: enviar notificações (p_user_id nulo = todos os clientes)
-- ---------------------------------------------------------------------
create or replace function public.admin_send_notification(p_user_id uuid, p_title text, p_body text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN: acesso reservado à equipa' using errcode = '42501'; end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'INVALID_INPUT: título e mensagem são obrigatórios';
  end if;

  insert into public.notifications (user_id, type, title, body, created_by)
  select p.id, 'general', left(trim(p_title), 120), left(trim(p_body), 1000), auth.uid()
    from public.profiles p
   where (p_user_id is null and not p.is_blocked) or p.id = p_user_id;
  get diagnostics v_count = row_count;

  perform public.write_audit('notification.sent', 'notifications', coalesce(p_user_id::text, 'ALL'),
    jsonb_build_object('title', p_title, 'recipients', v_count));
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- ADMIN: gestão de papéis e bloqueio de contas
-- ---------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.app_role, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN: apenas administradores' using errcode = '42501'; end if;
  if p_user_id = auth.uid() and p_role = 'admin' and not p_enabled then
    raise exception 'SELF_LOCKOUT: não pode remover o seu próprio papel de administrador';
  end if;
  if p_enabled then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, p_role, auth.uid())
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
end $$;

create or replace function public.admin_set_user_blocked(p_user_id uuid, p_blocked boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN: apenas administradores' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'SELF_LOCKOUT: não pode bloquear a sua própria conta'; end if;
  update public.profiles
     set is_blocked = p_blocked,
         blocked_reason = case when p_blocked then nullif(left(trim(coalesce(p_reason, '')), 300), '') else null end
   where id = p_user_id;
  if not found then raise exception 'USER_NOT_FOUND: utilizador não encontrado'; end if;
  perform public.write_audit(case when p_blocked then 'user.blocked' else 'user.unblocked' end,
    'profiles', p_user_id::text, jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------------
-- ADMIN/OPERADOR: estatísticas e relatórios
-- Receita = encomendas com pagamento aprovado, em processamento ou concluídas
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Africa/Luanda')::date;
  v_result jsonb;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN: acesso reservado à equipa' using errcode = '42501'; end if;

  select jsonb_build_object(
    'orders_total',      (select count(*) from public.orders),
    'orders_today',      (select count(*) from public.orders where (created_at at time zone 'Africa/Luanda')::date = v_today),
    'awaiting_review',   (select count(*) from public.orders where status in ('proof_submitted', 'under_review')),
    'to_fulfil',         (select count(*) from public.orders where status in ('payment_approved', 'processing')),
    'customers_total',   (select count(*) from public.user_roles where role = 'customer'),
    'revenue_today',     (select coalesce(sum(total_kz), 0) from public.orders
                           where status in ('payment_approved', 'processing', 'completed')
                             and (coalesce(approved_at, created_at) at time zone 'Africa/Luanda')::date = v_today),
    'revenue_month',     (select coalesce(sum(total_kz), 0) from public.orders
                           where status in ('payment_approved', 'processing', 'completed')
                             and date_trunc('month', coalesce(approved_at, created_at) at time zone 'Africa/Luanda')
                                 = date_trunc('month', now() at time zone 'Africa/Luanda')),
    'by_status',         (select coalesce(jsonb_object_agg(status, c), '{}'::jsonb)
                            from (select status, count(*) c from public.orders group by status) s),
    'last_7_days',       (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'orders', coalesce(x.c, 0), 'revenue', coalesce(x.r, 0)) order by d), '[]'::jsonb)
                            from generate_series(v_today - 6, v_today, interval '1 day') d
                            left join (select (created_at at time zone 'Africa/Luanda')::date dd, count(*) c,
                                              sum(case when status in ('payment_approved','processing','completed') then total_kz else 0 end) r
                                         from public.orders group by 1) x on x.dd = d::date)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.admin_sales_report(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN: acesso reservado à equipa' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_from > p_to then raise exception 'INVALID_INPUT: intervalo de datas inválido'; end if;
  if p_to - p_from > 366 then raise exception 'INVALID_INPUT: intervalo máximo de 366 dias'; end if;

  with base as (
    select o.*, (o.created_at at time zone 'Africa/Luanda')::date as d,
           (o.status in ('payment_approved', 'processing', 'completed')) as paid
      from public.orders o
     where (o.created_at at time zone 'Africa/Luanda')::date between p_from and p_to
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'orders', (select count(*) from base),
    'paid_orders', (select count(*) from base where paid),
    'revenue', (select coalesce(sum(total_kz), 0) from base where paid),
    'cancelled', (select count(*) from base where status = 'cancelled'),
    'rejected', (select count(*) from base where status = 'payment_rejected'),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'orders', c, 'revenue', r) order by d), '[]'::jsonb)
                 from (select d, count(*) c, coalesce(sum(total_kz) filter (where paid), 0) r from base group by d) t),
    'by_product', (select coalesce(jsonb_agg(jsonb_build_object('product', product_name, 'quantity', q, 'revenue', r) order by r desc), '[]'::jsonb)
                     from (select oi.product_name, sum(oi.quantity) q, sum(oi.line_total_kz) r
                             from base b join public.order_items oi on oi.order_id = b.id
                            where b.paid group by oi.product_name) t),
    'by_payment_method', (select coalesce(jsonb_agg(jsonb_build_object('method', m, 'orders', c, 'revenue', r) order by r desc), '[]'::jsonb)
                            from (select coalesce(payment_method_snapshot ->> 'name', 'Não definido') m, count(*) c, sum(total_kz) r
                                    from base where paid group by 1) t)
  ) into v_result;
  return v_result;
end $$;

-- ---------------------------------------------------------------------
-- Vista de clientes para o painel (respeita RLS: security_invoker)
-- ---------------------------------------------------------------------
create or replace view public.admin_customer_overview
with (security_invoker = true) as
select p.id, p.full_name, p.email, p.phone, p.is_blocked, p.blocked_reason, p.last_player_id, p.created_at,
       coalesce((select array_agg(ur.role order by ur.role) from public.user_roles ur where ur.user_id = p.id), '{}') as roles,
       (select count(*) from public.orders o where o.user_id = p.id) as orders_count,
       (select coalesce(sum(o.total_kz), 0) from public.orders o
         where o.user_id = p.id and o.status in ('payment_approved', 'processing', 'completed')) as total_spent_kz,
       (select max(o.created_at) from public.orders o where o.user_id = p.id) as last_order_at
  from public.profiles p;

-- >>>>>>>>>> migrations/005_triggers.sql
-- =====================================================================
-- KET SHOP — 005: Triggers (perfis, histórico, notificações, auditoria)
-- =====================================================================

-- updated_at automático
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists trg_categories_updated on public.product_categories;
create trigger trg_categories_updated before update on public.product_categories
  for each row execute function public.set_updated_at();
drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();
drop trigger if exists trg_payment_methods_updated on public.payment_methods;
create trigger trg_payment_methods_updated before update on public.payment_methods
  for each row execute function public.set_updated_at();
drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

-- app_settings: updated_at + updated_by
create or replace function public.app_settings_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists trg_app_settings_touch on public.app_settings;
create trigger trg_app_settings_touch before insert or update on public.app_settings
  for each row execute function public.app_settings_touch();

-- Novo utilizador em auth.users => perfil + papel customer
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Protege colunas sensíveis do perfil contra alteração pelo próprio cliente
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.is_blocked     := old.is_blocked;
    new.blocked_reason := old.blocked_reason;
    new.email          := old.email;
    new.id             := old.id;
    new.created_at     := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Mantém o e-mail do perfil sincronizado com auth.users
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- ---------------------------------------------------------------------
-- Encomendas: histórico de estados + notificações automáticas
-- ---------------------------------------------------------------------
create or replace function public.order_notification_text(p_order public.orders, out title text, out body text, out ntype public.notification_type)
language plpgsql stable set search_path = '' as $$
declare v_product text;
begin
  select oi.product_name into v_product from public.order_items oi where oi.order_id = p_order.id limit 1;
  v_product := coalesce(v_product, 'o seu produto');
  case p_order.status
    when 'pending_payment' then
      ntype := 'order_created'; title := 'Encomenda recebida';
      body := format('A encomenda %s (%s) foi registada. Efectue o pagamento e envie o comprovativo na app.', p_order.order_code, v_product);
    when 'proof_submitted' then
      ntype := 'proof_received'; title := 'Comprovativo recebido';
      body := format('Recebemos o comprovativo da encomenda %s. A nossa equipa vai verificá-lo em breve.', p_order.order_code);
    when 'under_review' then
      ntype := 'order_status'; title := 'Pagamento em verificação';
      body := format('O pagamento da encomenda %s está a ser verificado.', p_order.order_code);
    when 'payment_approved' then
      ntype := 'payment_approved'; title := 'Pagamento aprovado';
      body := format('O pagamento da encomenda %s foi aprovado. Vamos processar o carregamento para o ID %s.', p_order.order_code, p_order.player_id);
    when 'payment_rejected' then
      ntype := 'payment_rejected'; title := 'Pagamento rejeitado';
      body := format('O comprovativo da encomenda %s foi rejeitado. Motivo: %s. Pode enviar um novo comprovativo.',
                     p_order.order_code, coalesce(p_order.rejection_reason, 'não indicado'));
    when 'processing' then
      ntype := 'order_status'; title := 'Encomenda em processamento';
      body := format('A encomenda %s está a ser processada.', p_order.order_code);
    when 'completed' then
      ntype := 'order_completed'; title := 'Encomenda concluída';
      body := format('A encomenda %s foi concluída: %s creditado no ID %s. Obrigado por comprar na KET SHOP!', p_order.order_code, v_product, p_order.player_id);
    when 'cancelled' then
      ntype := 'order_status'; title := 'Encomenda cancelada';
      body := format('A encomenda %s foi cancelada.%s', p_order.order_code,
                     coalesce(' Motivo: ' || p_order.cancel_reason || '.', ''));
  end case;
end $$;

create or replace function public.orders_after_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_note text := nullif(current_setting('ketshop.status_note', true), '');
  v_msg record;
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, old_status, new_status, note, changed_by)
    values (new.id, null, new.status, 'Encomenda criada', auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, old_status, new_status, note, changed_by)
    values (new.id, old.status, new.status, v_note, auth.uid());
  else
    return new;
  end if;

  if new.user_id is not null then
    select * into v_msg from public.order_notification_text(new);
    insert into public.notifications (user_id, type, title, body, order_id, created_by)
    values (new.user_id, v_msg.ntype, v_msg.title, v_msg.body, new.id, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_after_insert on public.orders;
create trigger trg_orders_after_insert after insert on public.orders
  for each row execute function public.orders_after_change();
drop trigger if exists trg_orders_after_update on public.orders;
create trigger trg_orders_after_update after update of status on public.orders
  for each row execute function public.orders_after_change();

-- ---------------------------------------------------------------------
-- Auditoria genérica de tabelas de configuração
-- ---------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  if tg_op = 'DELETE' then
    v_id := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key');
  else
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key');
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id,
          jsonb_strip_nulls(jsonb_build_object(
            'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
            'new', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end)));
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['products', 'product_categories', 'payment_methods', 'app_settings', 'user_roles'] loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$I', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- >>>>>>>>>> migrations/006_realtime_and_grants.sql
-- =====================================================================
-- KET SHOP — 006: Realtime e permissões de execução
-- =====================================================================

-- Realtime (postgres_changes respeita RLS: cada cliente só recebe o que pode ler)
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['orders', 'notifications', 'payment_proofs', 'order_status_history'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Funções: ninguém anónimo executa RPCs; apenas utilizadores autenticados.
-- (As funções verificam internamente o papel; isto é uma camada extra.)
revoke execute on all functions in schema public from public, anon;
grant execute on function public.has_role(public.app_role)                       to authenticated;
grant execute on function public.is_admin()                                       to authenticated;
grant execute on function public.is_staff()                                       to authenticated;
grant execute on function public.my_roles()                                       to authenticated;
grant execute on function public.create_order(uuid, text, text, text)             to authenticated;
grant execute on function public.set_order_payment_method(uuid, uuid)             to authenticated;
grant execute on function public.can_upload_proof(text)                           to authenticated;
grant execute on function public.submit_payment_proof(uuid, text, text, text, integer) to authenticated;
grant execute on function public.cancel_my_order(uuid, text)                      to authenticated;
grant execute on function public.mark_notification_read(uuid)                     to authenticated;
grant execute on function public.mark_all_notifications_read()                    to authenticated;
grant execute on function public.unread_notifications_count()                     to authenticated;
grant execute on function public.update_my_profile(text, text)                   to authenticated;
grant execute on function public.admin_update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.admin_update_order_notes(uuid, text)             to authenticated;
grant execute on function public.admin_send_notification(uuid, text, text)        to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.app_role, boolean) to authenticated;
grant execute on function public.admin_set_user_blocked(uuid, boolean, text)      to authenticated;
grant execute on function public.admin_dashboard_stats()                          to authenticated;
grant execute on function public.admin_sales_report(date, date)                   to authenticated;
-- setting_bool é usada pelas RLS/funções e lê apenas flags
grant execute on function public.setting_bool(text, boolean)                      to authenticated, anon;

-- Tabelas: escrita directa só onde as políticas RLS o permitem
grant select on public.admin_customer_overview to authenticated;
revoke all on public.admin_customer_overview from anon;

-- >>>>>>>>>> policies/001_rls_policies.sql
-- =====================================================================
-- KET SHOP — Políticas RLS (Row Level Security)
-- Regra geral:
--   * cliente   -> só lê/escreve os SEUS dados
--   * operator  -> gere encomendas, comprovativos, notificações
--   * admin     -> tudo, incluindo catálogo, pagamentos, definições e papéis
--   * Mudanças de estado e criação de encomendas só via RPC (004_functions.sql)
-- =====================================================================

alter table public.profiles             enable row level security;
alter table public.user_roles           enable row level security;
alter table public.product_categories   enable row level security;
alter table public.products             enable row level security;
alter table public.payment_methods      enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.payment_proofs       enable row level security;
alter table public.notifications        enable row level security;
alter table public.app_settings         enable row level security;
alter table public.order_status_history enable row level security;
alter table public.audit_logs           enable row level security;

-- Remove políticas antigas (permite reexecutar o ficheiro)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
            where schemaname = 'public'
              and tablename in ('profiles','user_roles','product_categories','products','payment_methods',
                                'orders','order_items','payment_proofs','notifications','app_settings',
                                'order_status_history','audit_logs')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ---------------- profiles ----------------
create policy profiles_select_own_or_staff on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_admin on public.profiles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
-- INSERT: apenas pelo trigger handle_new_user (security definer). DELETE: via auth (cascade).

-- ---------------- user_roles ----------------
create policy user_roles_select_own_or_staff on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));
-- Escrita apenas via public.admin_set_user_role()

-- ---------------- product_categories ----------------
create policy categories_select_active on public.product_categories
  for select to anon, authenticated using (is_active or (select public.is_staff()));
create policy categories_insert_admin on public.product_categories
  for insert to authenticated with check ((select public.is_admin()));
create policy categories_update_admin on public.product_categories
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy categories_delete_admin on public.product_categories
  for delete to authenticated using ((select public.is_admin()));

-- ---------------- products ----------------
create policy products_select_active on public.products
  for select to anon, authenticated using (is_active or (select public.is_staff()));
create policy products_insert_admin on public.products
  for insert to authenticated with check ((select public.is_admin()));
create policy products_update_admin on public.products
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy products_delete_admin on public.products
  for delete to authenticated using ((select public.is_admin()));

-- ---------------- payment_methods ----------------
-- Clientes autenticados vêem apenas métodos activos
create policy payment_methods_select on public.payment_methods
  for select to authenticated using (is_active or (select public.is_staff()));
create policy payment_methods_insert_admin on public.payment_methods
  for insert to authenticated with check ((select public.is_admin()));
create policy payment_methods_update_admin on public.payment_methods
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy payment_methods_delete_admin on public.payment_methods
  for delete to authenticated using ((select public.is_admin()));

-- ---------------- orders ----------------
create policy orders_select_own_or_staff on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));
-- INSERT/UPDATE apenas através das RPCs create_order, set_order_payment_method,
-- submit_payment_proof, cancel_my_order, admin_update_order_status.

-- ---------------- order_items ----------------
create policy order_items_select on public.order_items
  for select to authenticated using (
    (select public.is_staff())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- ---------------- payment_proofs ----------------
create policy payment_proofs_select on public.payment_proofs
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));
-- INSERT apenas via submit_payment_proof(); UPDATE via admin_update_order_status()

-- ---------------- notifications ----------------
create policy notifications_select_own_or_staff on public.notifications
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
-- INSERT via triggers / admin_send_notification(); leitura marcada via mark_*_read()

-- ---------------- app_settings ----------------
create policy app_settings_select on public.app_settings
  for select to anon, authenticated using (is_public or (select public.is_staff()));
create policy app_settings_insert_admin on public.app_settings
  for insert to authenticated with check ((select public.is_admin()));
create policy app_settings_update_admin on public.app_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy app_settings_delete_admin on public.app_settings
  for delete to authenticated using ((select public.is_admin()));

-- ---------------- order_status_history ----------------
create policy status_history_select on public.order_status_history
  for select to authenticated using (
    (select public.is_staff())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- ---------------- audit_logs ----------------
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Privilégios de tabela (defesa em profundidade, além do RLS)
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.orders, public.order_items, public.payment_proofs,
  public.order_status_history, public.audit_logs, public.user_roles from anon, authenticated;
revoke insert, update, delete on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
revoke all on public.audit_logs from anon;
revoke insert, update, delete on public.profiles, public.products, public.product_categories,
  public.payment_methods, public.app_settings from anon;
revoke select on public.payment_methods, public.profiles, public.orders, public.order_items,
  public.payment_proofs, public.notifications, public.order_status_history, public.user_roles from anon;
-- O cliente só pode alterar estas colunas do seu perfil:
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, last_player_id) on public.profiles to authenticated;
grant select on public.profiles, public.user_roles, public.products, public.product_categories, public.payment_methods,
  public.orders, public.order_items, public.payment_proofs, public.notifications, public.app_settings,
  public.order_status_history, public.audit_logs to authenticated;
grant insert, update, delete on public.products, public.product_categories, public.payment_methods,
  public.app_settings to authenticated;
grant delete on public.notifications to authenticated;
grant select on public.products, public.product_categories, public.app_settings to anon;

-- >>>>>>>>>> storage/001_storage_bucket_and_policies.sql
-- =====================================================================
-- KET SHOP — Storage privado para comprovativos
-- Caminho obrigatório:  payment-proofs/<user_id>/<order_id>/<ficheiro>.<jpg|jpeg|png|webp>
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ketshop proofs insert own" on storage.objects;
drop policy if exists "ketshop proofs select own or staff" on storage.objects;
drop policy if exists "ketshop proofs delete admin" on storage.objects;

-- Cliente só pode carregar para a sua pasta e para uma encomenda sua que aceite comprovativo
create policy "ketshop proofs insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_upload_proof((storage.foldername(name))[2])
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
    and array_length(storage.foldername(name), 1) = 2
  );

-- Leitura: o próprio cliente ou a equipa (admin/operator)
create policy "ketshop proofs select own or staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff()))
  );

-- Apenas administradores podem apagar ficheiros. Não existe política de UPDATE:
-- um comprovativo enviado não pode ser substituído/sobrescrito.
create policy "ketshop proofs delete admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs' and (select public.is_admin()));

-- >>>>>>>>>> seed/001_seed_catalog_and_settings.sql
-- =====================================================================
-- KET SHOP — Dados iniciais (catálogo Free Fire, métodos e definições)
-- Pode ser reexecutado: usa ON CONFLICT pelos campos únicos.
-- Os preços aqui são apenas o ponto de partida: a app lê SEMPRE da base
-- de dados e o administrador altera-os no painel sem novo APK.
-- =====================================================================

insert into public.product_categories (slug, name, description, game, icon, sort_order, is_active) values
  ('diamantes', 'Diamantes', 'Recarga de diamantes Free Fire directamente no ID do jogador.', 'Free Fire', 'diamond', 1, true),
  ('passes',    'Passes e Assinaturas', 'Passes Booyah e assinaturas semanais/mensais Free Fire.', 'Free Fire', 'pass', 2, true)
on conflict (slug) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

-- Diamantes (base + bónus = total)
insert into public.products (category_id, sku, name, description, base_amount, bonus_amount, unit_label, price_kz, is_on_demand, is_featured, sort_order)
select c.id, v.sku, v.name, v.descr, v.base, v.bonus, 'diamantes', v.price, v.on_demand, v.featured, v.sort
from public.product_categories c,
 (values
   ('FF-DIA-78',    '78 Diamantes',     '65 + 13 de bónus = 78 diamantes.',            65,    13,  700.00,    false, false, 1),
   ('FF-DIA-120',   '120 Diamantes',    '100 + 20 de bónus = 120 diamantes.',          100,   20,  1050.00,   false, true,  2),
   ('FF-DIA-372',   '372 Diamantes',    '310 + 62 de bónus = 372 diamantes.',          310,   62,  3200.00,   false, true,  3),
   ('FF-DIA-624',   '624 Diamantes',    '520 + 104 de bónus = 624 diamantes.',         520,   104, 4800.00,   false, false, 4),
   ('FF-DIA-1272',  '1.272 Diamantes',  '1.060 + 212 de bónus = 1.272 diamantes.',     1060,  212, 10250.00,  false, true,  5),
   ('FF-DIA-2616',  '2.616 Diamantes',  '2.180 + 436 de bónus = 2.616 diamantes.',     2180,  436, 20050.00,  false, false, 6),
   ('FF-DIA-6720',  '6.720 Diamantes',  '5.600 + 1.120 de bónus = 6.720 diamantes.',   5600,  1120, 47800.00, false, false, 7),
   ('FF-DIA-26880', '26.880 Diamantes', '22.400 + 4.480 de bónus = 26.880 diamantes. Exclusivamente por encomenda: o prazo de entrega é confirmado pela equipa.', 22400, 4480, 191100.00, true, false, 8)
 ) as v(sku, name, descr, base, bonus, price, on_demand, featured, sort)
where c.slug = 'diamantes'
on conflict (sku) do update set
  name = excluded.name, description = excluded.description, base_amount = excluded.base_amount,
  bonus_amount = excluded.bonus_amount, price_kz = excluded.price_kz, is_on_demand = excluded.is_on_demand,
  sort_order = excluded.sort_order;

-- Passes e assinaturas
insert into public.products (category_id, sku, name, description, base_amount, bonus_amount, unit_label, price_kz, is_on_demand, is_featured, sort_order)
select c.id, v.sku, v.name, v.descr, null, 0, 'passe', v.price, false, v.featured, v.sort
from public.product_categories c,
 (values
   ('FF-PASS-SEM-ECO', 'Semanal Econômica',          'Assinatura semanal económica Free Fire.', 350.00,   false, 1),
   ('FF-PASS-SEM',     'Assinatura Semanal',         'Assinatura semanal Free Fire.',            2050.00,  true,  2),
   ('FF-PASS-BOOYAH',  'Passe Booyah',               'Passe Booyah Free Fire.',                  2600.00,  true,  3),
   ('FF-PASS-BOOYAH-P','Passe Booyah Premium Plus',  'Passe Booyah Premium Plus Free Fire.',     6900.00,  false, 4),
   ('FF-PASS-MENSAL',  'Assinatura Mensal',          'Assinatura mensal Free Fire.',             10250.00, false, 5)
 ) as v(sku, name, descr, price, featured, sort)
where c.slug = 'passes'
on conflict (sku) do update set
  name = excluded.name, description = excluded.description, price_kz = excluded.price_kz, sort_order = excluded.sort_order;

-- Métodos de pagamento: criados INACTIVOS e SEM dados bancários.
-- O administrador preenche IBAN, telefone, entidade/referência no painel e activa-os.
insert into public.payment_methods (type, name, description, instructions, is_active, sort_order)
select v.type::public.payment_method_type, v.name, v.descr, v.instr, false, v.sort
from (values
  ('bank_transfer', 'Transferência bancária (IBAN)', 'Transferência ou depósito para a conta da loja.',
   'Faça a transferência do valor exacto para o IBAN indicado e use o código da encomenda como descritivo. Depois envie o comprovativo na app.', 1),
  ('multicaixa_express', 'Multicaixa Express', 'Pagamento pela app Multicaixa Express.',
   'Envie o valor exacto para o número indicado pela app Multicaixa Express. Guarde o talão/captura e envie-o como comprovativo.', 2),
  ('paypay', 'PayPay AO', 'Pagamento pela carteira PayPay AO.',
   'Pague o valor exacto ao número/conta PayPay indicada e envie a captura do pagamento como comprovativo.', 3),
  ('reference', 'Pagamento por referência', 'Pagamento por entidade e referência (ATM/Internet banking).',
   'Pague no ATM ou Internet banking usando a entidade e referência indicadas e envie o talão como comprovativo.', 4)
) as v(type, name, descr, instr, sort)
where not exists (select 1 from public.payment_methods pm where pm.type = v.type::public.payment_method_type);

-- Definições (valores de contacto vazios: preencher no painel)
insert into public.app_settings (key, value, description, is_public) values
  ('store_name',            '"KET SHOP"',            'Nome da loja', true),
  ('support_whatsapp',      '""',                    'Número WhatsApp de suporte (formato internacional, ex.: 244XXXXXXXXX)', true),
  ('support_email',         '""',                    'E-mail de suporte', true),
  ('support_phone',         '""',                    'Telefone de suporte', true),
  ('support_hours',         '""',                    'Horário de atendimento', true),
  ('maintenance_mode',      'false',                 'Bloqueia novas encomendas quando true', true),
  ('maintenance_message',   '"A loja está temporariamente em manutenção. Volte mais tarde."', 'Mensagem de manutenção', true),
  ('announcement',          '""',                    'Aviso mostrado no topo da Home (vazio = sem aviso)', true),
  ('min_android_version',   '1',                     'versionCode mínimo suportado da app Android', true),
  ('proof_max_size_mb',     '5',                     'Tamanho máximo do comprovativo (MB). O limite técnico do bucket é 5 MB.', true),
  ('terms_text',            '""',                    'Termos e Condições (texto). Vazio = a app usa o texto incluído no APK.', true),
  ('privacy_text',          '""',                    'Política de Privacidade (texto). Vazio = a app usa o texto incluído no APK.', true),
  ('admin_order_alert_sound','true',                 'Som de alerta no painel quando chega uma encomenda', false)
on conflict (key) do nothing;
