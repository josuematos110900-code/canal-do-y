-- =====================================================================
-- Elite Shop — 007: mudança de nome (antes "KET SHOP")
-- Para quem JÁ instalou a base de dados: execute só este ficheiro no SQL Editor.
-- Novas encomendas passam a ter o código ELT-AAMMDD-XXXXXX.
-- As encomendas antigas (KET-...) continuam válidas.
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_order_code_check') then
    alter table public.orders drop constraint orders_order_code_check;
  end if;
  alter table public.orders add constraint orders_order_code_check
    check (order_code ~ '^(ELT|KET)-[0-9]{6}-[A-Z0-9]{6}$');
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

update public.app_settings set value = '"Elite Shop"'::jsonb
 where key = 'store_name' and value = '"KET SHOP"'::jsonb;
