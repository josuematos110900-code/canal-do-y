-- =====================================================================
-- Elite Shop — 004: Funções (helpers de papéis + RPCs seguras)
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
    v_code := 'ELT-' || to_char(now() at time zone 'Africa/Luanda', 'YYMMDD') || '-' || v_suffix;
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
