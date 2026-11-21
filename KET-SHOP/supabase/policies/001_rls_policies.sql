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
