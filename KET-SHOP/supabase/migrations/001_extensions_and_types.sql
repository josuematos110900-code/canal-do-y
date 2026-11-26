-- =====================================================================
-- Elite Shop — 001: Extensões e tipos enumerados
-- Executar no SQL Editor do Supabase (ou via `supabase db push`).
-- =====================================================================

-- Verificação de segurança: o projecto tem de estar vazio ou já ter a Elite Shop.
-- Se outra aplicação já usa os mesmos nomes, a instalação pára aqui sem alterar nada.
do $$
declare
  v_conflicts text := '';
  v_label text;
  v_expected text;
begin
  -- Tipos enumerados com o mesmo nome mas valores diferentes dos da Elite Shop
  -- (tipos iguais, deixados por uma tentativa anterior, não são conflito)
  for v_label, v_expected in
    select * from (values
      ('order_status', 'pending_payment,proof_submitted,under_review,payment_approved,payment_rejected,processing,completed,cancelled'),
      ('app_role', 'admin,operator,customer'),
      ('payment_method_type', 'bank_transfer,multicaixa_express,paypay,reference'),
      ('proof_status', 'pending,approved,rejected'),
      ('notification_type', 'order_created,proof_received,payment_approved,payment_rejected,order_completed,order_status,general')
    ) as x(name, labels)
  loop
    if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
               where n.nspname = 'public' and t.typname = v_label)
       and coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder)
                       from pg_enum e join pg_type t on t.oid = e.enumtypid
                       join pg_namespace n on n.oid = t.typnamespace
                      where n.nspname = 'public' and t.typname = v_label), '') <> v_expected then
      v_conflicts := v_conflicts || ' tipo ' || v_label || ' (valores de outra aplicação);';
    end if;
  end loop;
  -- Tabelas da Elite Shop que já existem com outra estrutura
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles')
     and not exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = 'profiles' and column_name = 'last_player_id') then
    v_conflicts := v_conflicts || ' tabela profiles (de outra aplicação);';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'orders')
     and not exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = 'orders' and column_name = 'player_id') then
    v_conflicts := v_conflicts || ' tabela orders (de outra aplicação);';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications')
     and not exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = 'notifications' and column_name = 'order_id') then
    v_conflicts := v_conflicts || ' tabela notifications (de outra aplicação);';
  end if;
  if v_conflicts <> '' then
    raise exception 'Elite Shop: este projecto Supabase já pertence a outra aplicação. Conflitos:% Nada foi alterado. Crie um projecto NOVO e vazio (New project) e execute este ficheiro lá.', v_conflicts;
  end if;
end $$;

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
