-- =====================================================================
-- KET SHOP — 001: Extensões e tipos enumerados
-- Executar no SQL Editor do Supabase (ou via `supabase db push`).
-- =====================================================================

-- Verificação de segurança: o projecto tem de estar vazio ou já ter a KET SHOP.
-- Se outra aplicação já usa os mesmos nomes, a instalação pára aqui sem alterar nada.
do $$
declare
  v_conflicts text := '';
  v_label text;
begin
  -- Tipos enumerados com o mesmo nome mas valores diferentes
  if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
             where n.nspname = 'public' and t.typname = 'order_status')
     and not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                     join pg_namespace n on n.oid = t.typnamespace
                     where n.nspname = 'public' and t.typname = 'order_status' and e.enumlabel = 'pending_payment') then
    v_conflicts := v_conflicts || ' tipo order_status (de outra aplicação);';
  end if;
  foreach v_label in array array['app_role','payment_method_type','proof_status','notification_type'] loop
    if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
               where n.nspname = 'public' and t.typname = v_label)
       and not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                       where n.nspname = 'public' and t.typname = 'order_status'
                         and exists (select 1 from pg_enum e where e.enumtypid = t.oid and e.enumlabel = 'pending_payment')) then
      v_conflicts := v_conflicts || ' tipo ' || v_label || ';';
    end if;
  end loop;
  -- Tabelas da KET SHOP que já existem com outra estrutura
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
    raise exception 'KET SHOP: este projecto Supabase já pertence a outra aplicação. Conflitos:% Nada foi alterado. Crie um projecto NOVO e vazio (New project) e execute este ficheiro lá.', v_conflicts;
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
