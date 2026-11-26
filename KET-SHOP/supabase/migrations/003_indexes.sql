-- =====================================================================
-- Elite Shop — 003: Índices
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
