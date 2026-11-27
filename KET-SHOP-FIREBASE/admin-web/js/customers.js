import { KS, FS } from "./core.js";
const { collection, getDocs, doc, query, where, orderBy, limit } = FS;

const ctx = await KS.init("customers", "Clientes");
let rows = [];

KS.qs("#cust-search").addEventListener("input", KS.debounce(render, 200));
KS.qs("#cust-filter").onchange = render;
KS.qs("#cust-export").onclick = () => {
  const out = [["Nome", "E-mail", "Telefone", "Papéis", "Encomendas", "Total gasto (Kz)", "Bloqueado", "Registo"]];
  filtered().forEach((c) => out.push([c.full_name, c.email, c.phone, c.roles.join(","), c.orders_count, c.total_spent_kz, c.is_blocked ? "sim" : "não", KS.day(c.created_at)]));
  KS.downloadCSV("clientes-ketshop.csv", out);
};

const PAID = ["payment_approved", "processing", "completed"];

async function load() {
  try {
    const [u, r, o] = await Promise.all([
      getDocs(query(collection(KS.db, "users"), limit(3000))),
      getDocs(collection(KS.db, "roles")),
      getDocs(query(collection(KS.db, "orders"), orderBy("created_at", "desc"), limit(3000))),
    ]);
    const roles = {};
    KS.rows(r).forEach((x) => (roles[x.id] = [x.admin ? "admin" : null, x.operator ? "operator" : null].filter(Boolean)));
    const agg = {};
    KS.rows(o).forEach((x) => {
      const a = (agg[x.user_id] = agg[x.user_id] || { count: 0, spent: 0, last: null });
      a.count++;
      if (PAID.includes(x.status)) a.spent += Number(x.total_kz);
      if (!a.last) a.last = x.created_at;
    });
    rows = KS.rows(u).map((c) => Object.assign(c, {
      roles: roles[c.id] || [], orders_count: (agg[c.id] || {}).count || 0,
      total_spent_kz: (agg[c.id] || {}).spent || 0, last_order_at: (agg[c.id] || {}).last || null,
    })).sort((a, b) => (KS.toDate(b.created_at) || 0) - (KS.toDate(a.created_at) || 0));
    render();
  } catch (e) {
    KS.qs("#cust-body").innerHTML = `<tr><td colspan="8" class="empty">${KS.esc(KS.errMsg(e))}</td></tr>`;
  }
}

function filtered() {
  const q = KS.qs("#cust-search").value.trim().toLowerCase();
  const f = KS.qs("#cust-filter").value;
  return rows.filter((c) => {
    if (f === "blocked" && !c.is_blocked) return false;
    if (f === "staff" && !c.roles.length) return false;
    return !q || [c.full_name, c.email, c.phone, c.last_player_id].some((v) => (v || "").toLowerCase().includes(q));
  });
}

const roleTags = (roles) => roles.map((r) => `<span class="tag role-${KS.esc(r)}">${r === "admin" ? "admin" : "operador"}</span>`).join("") || '<span class="tag">cliente</span>';

function render() {
  const list = filtered();
  const body = KS.qs("#cust-body");
  if (!list.length) { body.innerHTML = '<tr><td colspan="8" class="empty">Nenhum cliente encontrado.</td></tr>'; return; }
  body.innerHTML = list.map((c) => `<tr class="clickable" data-id="${KS.esc(c.id)}">
    <td><b>${KS.esc(c.full_name || "—")}</b><div class="small muted">desde ${KS.esc(KS.day(c.created_at))}</div></td>
    <td>${KS.esc(c.email || "")}<div class="small muted">${KS.esc(c.phone || "")}</div></td>
    <td>${roleTags(c.roles)}</td>
    <td class="right">${KS.esc(c.orders_count)}</td>
    <td class="right nowrap">${KS.esc(KS.kz(c.total_spent_kz))}</td>
    <td class="small nowrap">${KS.esc(KS.date(c.last_order_at) || "—")}</td>
    <td>${c.is_blocked ? '<span class="tag off">bloqueado</span>' : '<span class="tag on">activo</span>'}</td>
    <td class="right"><button class="btn btn-sm btn-outline">Abrir</button></td></tr>`).join("");
  KS.qsa("tr[data-id]", body).forEach((tr) => (tr.onclick = () => openCustomer(rows.find((x) => x.id === tr.dataset.id))));
}

async function openCustomer(c) {
  const isSelf = c.id === ctx.user.uid;
  const m = KS.modal(c.full_name || c.email, '<div class="empty"><span class="spinner"></span></div>', { wide: true });
  let orders = [];
  try {
    orders = KS.rows(await getDocs(query(collection(KS.db, "orders"), where("user_id", "==", c.id))))
      .sort((a, b) => (KS.toDate(b.created_at) || 0) - (KS.toDate(a.created_at) || 0)).slice(0, 20);
  } catch (e) { /* lista vazia */ }
  m.body.innerHTML = `
    <dl class="kv"><dt>E-mail</dt><dd>${KS.esc(c.email)}</dd><dt>Telefone</dt><dd>${KS.esc(c.phone || "—")}</dd>
      <dt>UID</dt><dd class="mono small">${KS.esc(c.id)}</dd>
      <dt>Último ID de jogador</dt><dd class="mono">${KS.esc(c.last_player_id || "—")}</dd>
      <dt>Encomendas</dt><dd>${KS.esc(c.orders_count)} · ${KS.esc(KS.kz(c.total_spent_kz))} pagos</dd>
      <dt>Estado</dt><dd>${c.is_blocked ? `<span class="tag off">bloqueado</span> ${KS.esc(c.blocked_reason || "")}` : '<span class="tag on">activo</span>'}</dd></dl>
    ${KS.isAdmin ? `<div class="card" style="margin-top:14px"><h3>Papéis e acesso</h3>
      <label class="check"><input type="checkbox" id="r-operator" ${c.roles.includes("operator") ? "checked" : ""}> Operador (gere encomendas, comprovativos e notificações)</label>
      <label class="check"><input type="checkbox" id="r-admin" ${c.roles.includes("admin") ? "checked" : ""} ${isSelf ? "disabled" : ""}> Administrador (acesso total)</label>
      <div class="form-actions">
        ${isSelf ? "" : `<button class="btn ${c.is_blocked ? "btn-success" : "btn-danger"}" id="c-block">${c.is_blocked ? "Desbloquear conta" : "Bloquear conta"}</button>`}
        <a class="btn btn-outline" href="notifications.html?user=${encodeURIComponent(c.id)}">Enviar notificação</a></div></div>` :
      `<div class="form-actions"><a class="btn btn-outline" href="notifications.html?user=${encodeURIComponent(c.id)}">Enviar notificação</a></div>`}
    <h3 style="margin:16px 0 8px">Últimas encomendas</h3>
    <div class="table-wrap"><table style="min-width:480px"><thead><tr><th>Código</th><th>Produto</th><th class="right">Total</th><th>Estado</th><th>Data</th></tr></thead><tbody>
    ${orders.map((o) => `<tr class="clickable" data-open="${KS.esc(o.id)}">
      <td class="mono">${KS.esc(o.order_code)}</td><td>${KS.esc(((o.order_items || [])[0] || {}).product_name || "")}</td>
      <td class="right nowrap">${KS.esc(KS.kz(o.total_kz))}</td><td>${KS.statusPill(o.status)}</td><td class="small">${KS.esc(KS.date(o.created_at))}</td></tr>`).join("") ||
      '<tr><td colspan="5" class="empty">Sem encomendas.</td></tr>'}</tbody></table></div>`;
  KS.qsa("[data-open]", m.body).forEach((tr) => (tr.onclick = () => (location.href = "orders.html?open=" + encodeURIComponent(tr.dataset.open))));

  if (!KS.isAdmin) return;
  const saveRoles = async () => {
    const admin = KS.qs("#r-admin", m.body).checked, operator = KS.qs("#r-operator", m.body).checked;
    const b = KS.batch();
    if (!admin && !operator && !isSelf) b.delete(doc(KS.db, "roles", c.id));
    else b.set(doc(KS.db, "roles", c.id), { admin, operator, email: c.email || null, updated_at: KS.now(), updated_by: KS.uid() });
    KS.audit(b, "user.roles_changed", "roles", c.id, { admin, operator });
    await b.commit();
  };
  ["operator", "admin"].forEach((role) => {
    const cb = KS.qs("#r-" + role, m.body);
    if (!cb) return;
    cb.onchange = async () => {
      try { await saveRoles(); KS.toast("Papel actualizado.", "success"); load(); }
      catch (e) { cb.checked = !cb.checked; KS.toast(KS.errMsg(e), "error"); }
    };
  });
  const blockBtn = KS.qs("#c-block", m.body);
  if (blockBtn) blockBtn.onclick = async () => {
    let reason = null;
    if (!c.is_blocked) {
      reason = await KS.prompt("Bloquear conta", "Motivo (opcional, mostrado ao cliente ao iniciar sessão)", { danger: true, okLabel: "Bloquear" });
      if (reason === null) return;
    }
    try {
      const b = KS.batch();
      b.update(doc(KS.db, "users", c.id), { is_blocked: !c.is_blocked, blocked_reason: c.is_blocked ? null : (reason || null), updated_at: KS.now() });
      KS.audit(b, c.is_blocked ? "user.unblocked" : "user.blocked", "users", c.id, { reason });
      await b.commit();
      KS.toast(c.is_blocked ? "Conta desbloqueada." : "Conta bloqueada.", "success");
      m.close(); load();
    } catch (e) { KS.toast(KS.errMsg(e), "error"); }
  };
}

load();
