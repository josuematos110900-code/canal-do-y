-- =====================================================================
-- Elite Shop — Dados iniciais (catálogo Free Fire, métodos e definições)
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
  ('store_name',            '"Elite Shop"',            'Nome da loja', true),
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
