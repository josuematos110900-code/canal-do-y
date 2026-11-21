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
