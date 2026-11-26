-- =====================================================================
-- Elite Shop — 005: Triggers (perfis, histórico, notificações, auditoria)
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
      body := format('A encomenda %s foi concluída: %s creditado no ID %s. Obrigado por comprar na Elite Shop!', p_order.order_code, v_product, p_order.player_id);
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
