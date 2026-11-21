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
