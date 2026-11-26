/* Elite Shop — MODO DEMONSTRAÇÃO
   Substitui o Supabase por dados de exemplo guardados no navegador.
   Não envia nem recebe dados reais. Serve apenas para mostrar o painel. */
(function () {
  const now = Date.now(), H = 3600e3, D = 24 * H;
  const iso = (ms) => new Date(ms).toISOString();
  const users = [
    { id: "u1", full_name: "Ana Paula Mendes", email: "ana@exemplo.ao", phone: "+244923000111", last_player_id: "512348790" },
    { id: "u2", full_name: "Carlos Domingos", email: "carlos@exemplo.ao", phone: "+244912000222", last_player_id: "778812345" },
    { id: "u3", full_name: "Joana Kiala", email: "joana@exemplo.ao", phone: "+244934000333", last_player_id: "301245566" },
    { id: "u4", full_name: "Miguel Tchissola", email: "miguel@exemplo.ao", phone: "+244944000444", last_player_id: "889012345" },
  ].map((u, i) => Object.assign(u, { is_blocked: false, created_at: iso(now - (20 - i) * D) }));
  const prodList = [
    ["78 Diamantes", 65, 13, 700], ["120 Diamantes", 100, 20, 1050], ["372 Diamantes", 310, 62, 3200], ["624 Diamantes", 520, 104, 4800],
    ["1.272 Diamantes", 1060, 212, 10250], ["2.616 Diamantes", 2180, 436, 20050], ["6.720 Diamantes", 5600, 1120, 47800], ["26.880 Diamantes", 22400, 4480, 191100],
  ];
  const passList = [["Semanal Econômica", 350], ["Assinatura Semanal", 2050], ["Passe Booyah", 2600], ["Passe Booyah Premium Plus", 6900], ["Assinatura Mensal", 10250]];
  const cats = [{ id: "c1", slug: "diamantes", name: "Diamantes", game: "Free Fire", sort_order: 1, is_active: true, description: "Recarga de diamantes Free Fire." },
                { id: "c2", slug: "passes", name: "Passes e Assinaturas", game: "Free Fire", sort_order: 2, is_active: true, description: "Passes e assinaturas Free Fire." }];
  const products = prodList.map((p, i) => ({ id: "p" + i, category_id: "c1", name: p[0], sku: "FF-DIA-" + (p[1] + p[2]), base_amount: p[1], bonus_amount: p[2], total_amount: p[1] + p[2],
    unit_label: "diamantes", price_kz: p[3], is_active: true, is_on_demand: i === 7, is_featured: [1, 2, 4].includes(i), sort_order: i + 1, product_categories: { name: "Diamantes" } }))
    .concat(passList.map((p, i) => ({ id: "s" + i, category_id: "c2", name: p[0], sku: "FF-PASS-" + (i + 1), base_amount: null, bonus_amount: 0, total_amount: 0, unit_label: "passe",
      price_kz: p[1], is_active: true, is_on_demand: false, is_featured: i === 2, sort_order: i + 1, product_categories: { name: "Passes e Assinaturas" } })));
  const pm = { id: "m1", type: "bank_transfer", name: "Transferência bancária (IBAN)", account_holder: "[Nome do titular]", iban: "AO06 0000 0000 0000 0000 0000 0",
    instructions: "Transfira o valor exacto e use o código da encomenda como descritivo.", is_active: true, sort_order: 1 };
  const methods = [pm, { id: "m2", type: "multicaixa_express", name: "Multicaixa Express", phone_number: "+244 900 000 000", is_active: true, sort_order: 2 },
    { id: "m3", type: "paypay", name: "PayPay AO", is_active: false, sort_order: 3 }, { id: "m4", type: "reference", name: "Pagamento por referência", is_active: false, sort_order: 4 }];
  const statuses = ["proof_submitted", "proof_submitted", "under_review", "payment_approved", "processing", "completed", "completed", "completed", "payment_rejected", "pending_payment", "completed", "cancelled", "completed", "completed"];
  const pick = [1, 2, 0, 4, 2, 1, 10, 3, 2, 0, 5, 1, 9, 11];
  const orders = statuses.map((st, i) => {
    const p = products[pick[i]], u = users[i % 4];
    const code = "KET-2611" + String(26 - Math.floor(i / 3)).padStart(2, "0") + "-" + ["H7K2PQ", "B3MX9T", "Q8WZ2D", "N5RT7C", "A2CD4E", "F6GH8J", "K3LM5N", "P7QR9S", "T2UV4W", "X6YZ8A", "C3DE5F", "G7HJ9K", "L2MN4P", "R6ST8U"][i];
    return { id: "o" + i, order_code: code, status: st, user_id: u.id, game: "Free Fire", player_id: u.last_player_id, player_nickname: u.full_name.split(" ")[0] + "_FF",
      total_kz: p.price_kz, subtotal_kz: p.price_kz, created_at: iso(now - i * 7 * H), updated_at: iso(now - i * 6 * H), is_on_demand: p.is_on_demand,
      payment_method_snapshot: st === "pending_payment" ? null : (i % 2 ? methods[1] : pm), rejection_reason: st === "payment_rejected" ? "Valor transferido inferior ao total" : null,
      cancel_reason: st === "cancelled" ? "Cancelada pelo cliente" : null, payment_submitted_at: st === "pending_payment" ? null : iso(now - i * 7 * H + 600e3),
      approved_at: ["payment_approved", "processing", "completed"].includes(st) ? iso(now - i * 6 * H) : null,
      order_items: [{ product_name: p.name, quantity: 1, unit_price_kz: p.price_kz, line_total_kz: p.price_kz, total_amount: p.total_amount,
        product_snapshot: { base_amount: p.base_amount, bonus_amount: p.bonus_amount, total_amount: p.total_amount, unit_label: p.unit_label } }],
      profiles: Object.assign({}, u) };
  });
  const receipt = (code, val) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520"><rect width="360" height="520" fill="#f4f2f7"/><text x="30" y="60" font-family="monospace" font-size="22" font-weight="bold">COMPROVATIVO</text><text font-family="monospace" font-size="16" x="30" y="110">Transferência</text><text font-family="monospace" font-size="16" x="30" y="150">Valor: ${val} AOA</text><text font-family="monospace" font-size="16" x="30" y="190">Descritivo:</text><text font-family="monospace" font-size="16" x="30" y="215">${code}</text><text font-family="monospace" font-size="16" x="30" y="255">Estado: CONCLUÍDA</text><text font-family="monospace" font-size="13" x="30" y="490" fill="#999">EXEMPLO — DEMONSTRAÇÃO</text></svg>`);
  const proofs = orders.filter((o) => o.status !== "pending_payment" && o.status !== "cancelled").map((o, i) => ({ id: "pf" + i, order_id: o.id,
    storage_path: o.order_code, status: o.status === "payment_rejected" ? "rejected" : ["proof_submitted", "under_review"].includes(o.status) ? "pending" : "approved",
    mime_type: "image/jpeg", size_bytes: 380000 + i * 7000, created_at: o.payment_submitted_at, review_notes: o.rejection_reason }));
  const history = (o) => [{ new_status: "pending_payment", created_at: o.created_at, note: "Encomenda criada" }].concat(o.status === "pending_payment" ? [] :
    [{ new_status: "proof_submitted", created_at: o.payment_submitted_at, note: "Comprovativo enviado pelo cliente" }]).concat(
    ["proof_submitted", "pending_payment"].includes(o.status) ? [] : [{ new_status: o.status, created_at: o.updated_at, note: o.rejection_reason || o.cancel_reason, profiles: { full_name: "Equipa Elite Shop" } }]);
  const notifications = orders.slice(0, 8).map((o, i) => ({ id: "n" + i, type: ["order_created", "proof_received", "payment_approved", "order_completed"][i % 4],
    title: ["Encomenda recebida", "Comprovativo recebido", "Pagamento aprovado", "Encomenda concluída"][i % 4], is_read: i > 2, created_at: o.updated_at, profiles: o.profiles }))
    .concat([{ id: "ng", type: "general", title: "Promoção de fim-de-semana", is_read: false, created_at: iso(now - 2 * D), profiles: users[0] }]);
  const paid = ["payment_approved", "processing", "completed"];
  const PAID = orders.filter((o) => paid.includes(o.status));
  const customers = users.map((u) => { const mine = orders.filter((o) => o.user_id === u.id);
    return Object.assign({}, u, { roles: ["customer"], orders_count: mine.length, total_spent_kz: mine.filter((o) => paid.includes(o.status)).reduce((a, o) => a + o.total_kz, 0), last_order_at: mine[0] && mine[0].created_at }); })
    .concat([{ id: "adm", full_name: "Administrador Demo", email: "demo@eliteshop.ao", roles: ["admin", "customer"], orders_count: 0, total_spent_kz: 0, created_at: iso(now - 30 * D), is_blocked: false }]);
  const settings = [["store_name", "Elite Shop"], ["support_whatsapp", "244900000000"], ["support_email", "suporte@exemplo.ao"], ["support_hours", "Seg–Sáb, 08h–20h"],
    ["maintenance_mode", false], ["announcement", ""], ["min_android_version", 1], ["admin_order_alert_sound", true], ["terms_text", ""], ["privacy_text", ""]]
    .map(([key, value]) => ({ key, value, is_public: key !== "admin_order_alert_sound", updated_at: iso(now - D) }));
  const audit = orders.slice(0, 10).map((o, i) => ({ id: i, action: i % 3 ? "order.status_changed" : "update", entity: i % 3 ? "orders" : "products", entity_id: i % 3 ? o.id : "p1",
    created_at: o.updated_at, profiles: { full_name: "Administrador Demo" }, details: { order_code: o.order_code, new_status: o.status } }));
  const tables = { orders, products, product_categories: cats, payment_methods: methods, admin_customer_overview: customers, profiles: users,
    notifications, app_settings: settings, audit_logs: audit, payment_proofs: proofs, order_status_history: [] };

  function builder(table) {
    const f = { eq: {}, in: null, id: null };
    let single = false, countHead = false;
    const run = () => {
      let rows = (tables[table] || []).slice();
      if (f.in) rows = rows.filter((r) => f.in[1].includes(r[f.in[0]]));
      Object.keys(f.eq).forEach((k) => { rows = rows.filter((r) => String(r[k]) === String(f.eq[k])); });
      if (table === "order_status_history" && f.eq.order_id) rows = history(orders.find((o) => o.id === f.eq.order_id) || orders[0]);
      if (table === "payment_proofs" && f.eq.order_id) rows = proofs.filter((p) => p.order_id === f.eq.order_id);
      return rows;
    };
    const b = new Proxy({}, { get(t, k) {
      if (k === "then") return (ok) => { const rows = run(); ok({ data: single ? rows[0] || null : countHead ? null : rows, error: null, count: rows.length }); };
      if (k === "eq") return (col, val) => { f.eq[col] = val; return b; };
      if (k === "in") return (col, vals) => { f.in = [col, vals]; return b; };
      if (k === "select") return (s, o) => { if (o && o.head) countHead = true; return b; };
      if (k === "single" || k === "maybeSingle") return () => { single = true; return b; };
      if (["insert", "update", "upsert", "delete"].includes(k)) return () => { demoBlocked(); return b; };
      return () => b;
    } });
    return b;
  }
  function demoBlocked() {
    if (window.KS && window.KS.toast) window.KS.toast("Modo demonstração: as alterações não são guardadas.");
  }
  const rpcs = {
    my_roles: ["admin", "customer"],
    admin_dashboard_stats: () => {
      const day = (ms) => new Date(ms).toISOString().slice(0, 10);
      const last7 = [6, 5, 4, 3, 2, 1, 0].map((i) => { const d = day(now - i * D); const os = orders.filter((o) => day(Date.parse(o.created_at)) === d);
        return { day: d, orders: os.length, revenue: os.filter((o) => paid.includes(o.status)).reduce((a, o) => a + o.total_kz, 0) }; });
      const by = {}; orders.forEach((o) => (by[o.status] = (by[o.status] || 0) + 1));
      return { orders_total: orders.length, orders_today: orders.filter((o) => day(Date.parse(o.created_at)) === day(now)).length,
        awaiting_review: orders.filter((o) => ["proof_submitted", "under_review"].includes(o.status)).length,
        to_fulfil: orders.filter((o) => ["payment_approved", "processing"].includes(o.status)).length, customers_total: users.length,
        revenue_today: last7[6].revenue, revenue_month: PAID.reduce((a, o) => a + o.total_kz, 0), by_status: by, last_7_days: last7 };
    },
    admin_sales_report: (args) => {
      const byDay = {}, byProd = {}, byPm = {};
      orders.forEach((o) => { const d = o.created_at.slice(0, 10); byDay[d] = byDay[d] || { day: d, orders: 0, revenue: 0 }; byDay[d].orders++;
        if (!paid.includes(o.status)) return; byDay[d].revenue += o.total_kz;
        const n = o.order_items[0].product_name; byProd[n] = byProd[n] || { product: n, quantity: 0, revenue: 0 }; byProd[n].quantity++; byProd[n].revenue += o.total_kz;
        const m = (o.payment_method_snapshot || {}).name || "Não definido"; byPm[m] = byPm[m] || { method: m, orders: 0, revenue: 0 }; byPm[m].orders++; byPm[m].revenue += o.total_kz; });
      return { from: args.p_from, to: args.p_to, orders: orders.length, paid_orders: PAID.length, revenue: PAID.reduce((a, o) => a + o.total_kz, 0),
        cancelled: orders.filter((o) => o.status === "cancelled").length, rejected: orders.filter((o) => o.status === "payment_rejected").length,
        by_day: Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)), by_product: Object.values(byProd).sort((a, b) => b.revenue - a.revenue),
        by_payment_method: Object.values(byPm) };
    },
  };
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: "adm", email: "demo@eliteshop.ao", user_metadata: { full_name: "Administrador Demo" } } } } }),
            onAuthStateChange: () => {}, signOut: async () => ({}), signInWithPassword: async () => ({ error: null }), updateUser: async () => ({ error: null }) },
    rpc: async (n, args) => {
      if (n.startsWith("admin_update") || n.startsWith("admin_set") || n === "admin_send_notification") { demoBlocked(); return { data: null, error: { message: "DEMO: Modo demonstração — as alterações não são guardadas." } }; }
      const r = rpcs[n]; return { data: typeof r === "function" ? r(args || {}) : r !== undefined ? r : null, error: null };
    },
    from: (t) => builder(t),
    storage: { from: () => ({ createSignedUrls: async (paths) => ({ data: paths.map((p) => { const o = orders.find((x) => x.order_code === p) || orders[0];
      return { signedUrl: receipt(o.order_code, o.total_kz.toLocaleString("pt-PT")) }; }), error: null }) }) },
    channel: () => { const c = { on: () => c, subscribe: (cb) => { setTimeout(() => cb("SUBSCRIBED"), 50); return c; } }; return c; },
  }) };
})();
