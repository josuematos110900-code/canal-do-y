/* KET SHOP — catálogo inicial Free Fire (carregado em Configurações → "Carregar catálogo inicial").
   Os preços aqui são apenas o ponto de partida: depois edite-os em "Produtos e preços".
   Métodos de pagamento são criados INACTIVOS e SEM dados bancários (preencher no painel). */
const g = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const SEED = {
  categories: [
    { id: "diamantes", name: "Diamantes", slug: "diamantes", description: "Recarga de diamantes Free Fire directamente no ID do jogador.", game: "Free Fire", icon: "diamond", sort_order: 1, is_active: true },
    { id: "passes", name: "Passes e Assinaturas", slug: "passes", description: "Passes Booyah e assinaturas semanais/mensais Free Fire.", game: "Free Fire", icon: "pass", sort_order: 2, is_active: true },
  ],
  products: [
    ["ff-dia-78", "FF-DIA-78", "78 Diamantes", 65, 13, 700, false, false, 1],
    ["ff-dia-120", "FF-DIA-120", "120 Diamantes", 100, 20, 1050, false, true, 2],
    ["ff-dia-372", "FF-DIA-372", "372 Diamantes", 310, 62, 3200, false, true, 3],
    ["ff-dia-624", "FF-DIA-624", "624 Diamantes", 520, 104, 4800, false, false, 4],
    ["ff-dia-1272", "FF-DIA-1272", "1.272 Diamantes", 1060, 212, 10250, false, true, 5],
    ["ff-dia-2616", "FF-DIA-2616", "2.616 Diamantes", 2180, 436, 20050, false, false, 6],
    ["ff-dia-6720", "FF-DIA-6720", "6.720 Diamantes", 5600, 1120, 47800, false, false, 7],
    ["ff-dia-26880", "FF-DIA-26880", "26.880 Diamantes", 22400, 4480, 191100, true, false, 8],
  ].map(([id, sku, name, base, bonus, price, onDemand, featured, sort]) => ({
    id, sku, name, category_id: "diamantes", game: "Free Fire", base_amount: base, bonus_amount: bonus, total_amount: base + bonus,
    unit_label: "diamantes", price_kz: price, is_active: true, is_on_demand: onDemand, is_featured: featured, sort_order: sort, image_url: null,
    description: `${g(base)} + ${g(bonus)} de bónus = ${g(base + bonus)} diamantes.` +
      (onDemand ? " Exclusivamente por encomenda: o prazo de entrega é confirmado pela equipa." : ""),
  })).concat([
    ["ff-pass-sem-eco", "FF-PASS-SEM-ECO", "Semanal Econômica", 350, false, 1, "Assinatura semanal económica Free Fire."],
    ["ff-pass-sem", "FF-PASS-SEM", "Assinatura Semanal", 2050, true, 2, "Assinatura semanal Free Fire."],
    ["ff-pass-booyah", "FF-PASS-BOOYAH", "Passe Booyah", 2600, true, 3, "Passe Booyah Free Fire."],
    ["ff-pass-booyah-p", "FF-PASS-BOOYAH-P", "Passe Booyah Premium Plus", 6900, false, 4, "Passe Booyah Premium Plus Free Fire."],
    ["ff-pass-mensal", "FF-PASS-MENSAL", "Assinatura Mensal", 10250, false, 5, "Assinatura mensal Free Fire."],
  ].map(([id, sku, name, price, featured, sort, description]) => ({
    id, sku, name, category_id: "passes", game: "Free Fire", base_amount: null, bonus_amount: 0, total_amount: 0, unit_label: "passe",
    price_kz: price, is_active: true, is_on_demand: false, is_featured: featured, sort_order: sort, image_url: null, description,
  }))),
  paymentMethods: [
    { id: "bank_transfer", type: "bank_transfer", name: "Transferência bancária (IBAN)", description: "Transferência ou depósito para a conta da loja.",
      instructions: "Faça a transferência do valor exacto para o IBAN indicado e use o código da encomenda como descritivo. Depois envie o comprovativo na app.", sort_order: 1 },
    { id: "multicaixa_express", type: "multicaixa_express", name: "Multicaixa Express", description: "Pagamento pela app Multicaixa Express.",
      instructions: "Envie o valor exacto para o número indicado pela app Multicaixa Express. Guarde o talão/captura e envie-o como comprovativo.", sort_order: 2 },
    { id: "paypay", type: "paypay", name: "PayPay AO", description: "Pagamento pela carteira PayPay AO.",
      instructions: "Pague o valor exacto ao número/conta PayPay indicada e envie a captura do pagamento como comprovativo.", sort_order: 3 },
    { id: "reference", type: "reference", name: "Pagamento por referência", description: "Pagamento por entidade e referência (ATM/Internet banking).",
      instructions: "Pague no ATM ou Internet banking usando a entidade e referência indicadas e envie o talão como comprovativo.", sort_order: 4 },
  ].map((m) => Object.assign({ account_holder: null, bank_name: null, iban: null, account_number: null, phone_number: null,
    entity: null, reference: null, is_active: false }, m)),
  settingsPublic: {
    store_name: "KET SHOP", support_whatsapp: "", support_email: "", support_phone: "", support_hours: "",
    maintenance_mode: false, maintenance_message: "A loja está temporariamente em manutenção. Volte mais tarde.",
    announcement: "", min_android_version: 1, proof_max_size_mb: 5, terms_text: "", privacy_text: "",
  },
  settingsPrivate: { admin_order_alert_sound: true },
};
