import { KS, FS, ST } from "./core.js";
const { collection, query, where, orderBy, limit, getDocs, getDoc, doc } = FS;

await KS.init("orders", "Encomendas");

const PAGE = 25;
const params = new URLSearchParams(location.search);
const state = { filter: params.get("filter") || "all", search: "", from: "", to: "", page: 0, rows: [], filtered: [], max: 300 };
let soundOn = true;
let openOrderId = null;
try {
  const p = await getDoc(doc(KS.db, "settings", "private"));
  if (p.exists() && p.data().admin_order_alert_sound === false) soundOn = false;
} catch (e) { /* usa o valor por omissão */ }

const FILTERS = {
  review: ["proof_submitted", "under_review"], fulfil: ["payment_approved", "processing"],
};

// ------------------------------------------------------------ Filtros
KS.qsa("#order-tabs .tab").forEach((t) => {
  t.classList.toggle("active", t.dataset.filter === state.filter);
  t.onclick = () => {
    KS.qsa("#order-tabs .tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    state.filter = t.dataset.filter; state.page = 0; load();
  };
});
KS.qs("#order-search").addEventListener("input", KS.debounce((e) => { state.search = e.target.value.trim().toLowerCase(); state.page = 0; applyFilter(); }, 250));
KS.qs("#order-from").onchange = (e) => { state.from = e.target.value; state.page = 0; load(); };
KS.qs("#order-to").onchange = (e) => { state.to = e.target.value; state.page = 0; load(); };
KS.qs("#order-refresh").onclick = () => load();
KS.qs("#orders-prev").onclick = () => { if (state.page > 0) { state.page--; render(); } };
KS.qs("#orders-next").onclick = () => { if ((state.page + 1) * PAGE < state.filtered.length) { state.page++; render(); } };
KS.qs("#order-export").onclick = exportCsv;

/**
 * Consultas escolhidas para não exigir índices compostos:
 *  - por estado: where(status in …) e ordenação no navegador;
 *  - todas/período: orderBy(created_at) (índice simples automático).
 */
function buildQuery() {
  const col = collection(KS.db, "orders");
  const statuses = FILTERS[state.filter] || (state.filter !== "all" ? [state.filter] : null);
  if (statuses && !state.from && !state.to) return query(col, where("status", "in", statuses), limit(1000));
  const cons = [];
  if (state.from) cons.push(where("created_at", ">=", new Date(state.from + "T00:00:00")));
  if (state.to) cons.push(where("created_at", "<=", new Date(state.to + "T23:59:59")));
  return query(col, ...cons, orderBy("created_at", "desc"), limit(state.max));
}

async function load(flashId) {
  const body = KS.qs("#orders-body");
  try {
    const snap = await getDocs(buildQuery());
    let rows = KS.rows(snap);
    const statuses = FILTERS[state.filter] || (state.filter !== "all" ? [state.filter] : null);
    if (statuses) rows = rows.filter((o) => statuses.includes(o.status));
    rows.sort((a, b) => (KS.toDate(b.created_at) || 0) - (KS.toDate(a.created_at) || 0));
    const users = await Promise.all(rows.map((o) => KS.user(o.user_id)));
    rows.forEach((o, i) => (o._user = users[i]));
    state.rows = rows;
    state.flash = flashId;
    applyFilter();
  } catch (e) {
    body.innerHTML = `<tr><td colspan="8" class="empty">${KS.esc(KS.errMsg(e))}</td></tr>`;
  }
}

function applyFilter() {
  const s = state.search;
  state.filtered = !s ? state.rows : state.rows.filter((o) =>
    [o.order_code, o.player_id, o.player_nickname, o._user && o._user.full_name, o._user && o._user.email]
      .some((v) => (v || "").toLowerCase().includes(s)));
  render();
}

function render() {
  const body = KS.qs("#orders-body");
  const total = state.filtered.length;
  const data = state.filtered.slice(state.page * PAGE, state.page * PAGE + PAGE);
  KS.qs("#orders-count").textContent = total ? `${state.page * PAGE + 1}–${Math.min(total, (state.page + 1) * PAGE)} de ${total}` : "";
  if (!data.length) { body.innerHTML = '<tr><td colspan="8" class="empty">Nenhuma encomenda encontrada.</td></tr>'; return; }
  body.innerHTML = data.map((o) => `
    <tr class="clickable ${o.id === state.flash ? "flash" : ""}" data-id="${KS.esc(o.id)}">
      <td class="mono nowrap">${KS.esc(o.order_code)}</td>
      <td>${KS.esc(o._user ? o._user.full_name || "—" : "Conta eliminada")}<div class="small muted">${KS.esc(o._user ? o._user.email : "")}</div></td>
      <td>${KS.esc(((o.order_items || [])[0] || {}).product_name || "")}</td>
      <td class="mono">${KS.esc(o.player_id)}${o.player_nickname ? `<div class="small muted">${KS.esc(o.player_nickname)}</div>` : ""}</td>
      <td class="small">${KS.esc(o.payment_method_snapshot ? o.payment_method_snapshot.name : "—")}</td>
      <td class="right nowrap">${KS.esc(KS.kz(o.total_kz))}</td>
      <td>${KS.statusPill(o.status)}</td>
      <td class="small nowrap">${KS.esc(KS.date(o.created_at))}</td></tr>`).join("");
  KS.qsa("tr[data-id]", body).forEach((tr) => { tr.onclick = () => openOrder(tr.dataset.id); });
}

function exportCsv() {
  const rows = [["Código", "Estado", "Cliente", "E-mail", "Produto", "ID jogador", "Nickname", "Método", "Total (Kz)", "Data"]];
  state.filtered.forEach((o) => rows.push([o.order_code, KS.STATUS[o.status], o._user ? o._user.full_name : "", o._user ? o._user.email : "",
    ((o.order_items || [])[0] || {}).product_name, o.player_id, o.player_nickname, o.payment_method_snapshot ? o.payment_method_snapshot.name : "",
    o.total_kz, KS.date(o.created_at)]));
  KS.downloadCSV("encomendas-ketshop.csv", rows);
}

// ------------------------------------------------------- Detalhe da encomenda
const ACTIONS = {
  under_review: { label: "Marcar em verificação", cls: "btn-outline" },
  payment_approved: { label: "Aprovar pagamento", cls: "btn-success" },
  payment_rejected: { label: "Rejeitar pagamento", cls: "btn-danger", reason: "Motivo da rejeição (o cliente vai ver este texto)" },
  processing: { label: "Em processamento", cls: "btn-outline" },
  completed: { label: "Marcar como concluída", cls: "btn-primary" },
  cancelled: { label: "Cancelar encomenda", cls: "btn-danger", reason: "Motivo do cancelamento (o cliente vai ver este texto)" },
};

let modal = null;
async function openOrder(id) {
  if (modal) modal.close(); // fecha antes: o onClose limpa openOrderId
  openOrderId = id;
  modal = KS.modal("Encomenda", '<div class="empty"><span class="spinner"></span></div>', { wide: true, onClose: () => { openOrderId = null; modal = null; } });
  let o, proofs, hist, cust;
  try {
    const s = await getDoc(doc(KS.db, "orders", id));
    if (!s.exists()) throw new Error("Encomenda não encontrada.");
    o = Object.assign({ id: s.id }, s.data());
    [proofs, hist, cust] = await Promise.all([
      getDocs(query(collection(KS.db, "orders", id, "proofs"), orderBy("created_at", "desc"))).then(KS.rows),
      getDocs(query(collection(KS.db, "orders", id, "history"), orderBy("created_at"))).then(KS.rows),
      KS.user(o.user_id),
    ]);
  } catch (e) {
    if (modal) modal.body.innerHTML = `<div class="alert error">${KS.esc(KS.errMsg(e))}</div>`;
    return;
  }
  if (!modal) return;
  const actors = await Promise.all(hist.map((h) => KS.user(h.changed_by)));
  modal.el.querySelector("h2").textContent = "Encomenda " + o.order_code;
  const item = (o.order_items || [])[0] || {};
  const snap = item.product_snapshot || {};
  const pm = o.payment_method_snapshot || {};
  cust = cust || {};
  const next = KS.TRANSITIONS[o.status] || [];

  modal.body.innerHTML = `
    <div class="row" style="margin-bottom:12px">${KS.statusPill(o.status)}
      ${o.is_on_demand ? '<span class="tag" style="color:#ffc857">POR ENCOMENDA</span>' : ""}
      <span class="muted small grow">Criada em ${KS.esc(KS.date(o.created_at))} · actualizada ${KS.esc(KS.date(o.updated_at))}</span></div>
    ${o.rejection_reason && o.status === "payment_rejected" ? `<div class="alert error">Motivo da rejeição: ${KS.esc(o.rejection_reason)}</div>` : ""}
    ${o.cancel_reason && o.status === "cancelled" ? `<div class="alert warning">Motivo do cancelamento: ${KS.esc(o.cancel_reason)}</div>` : ""}
    <div class="grid two" style="margin-top:12px">
      <div class="card"><h3 style="margin-bottom:10px">Produto e jogador</h3><dl class="kv">
        <dt>Produto</dt><dd>${KS.esc(item.product_name)}</dd>
        ${item.total_amount ? `<dt>Quantidade</dt><dd>${KS.esc(KS.num(snap.base_amount))} + ${KS.esc(KS.num(snap.bonus_amount))} = <b>${KS.esc(KS.num(item.total_amount))}</b> ${KS.esc(snap.unit_label || "")}</dd>` : ""}
        <dt>Jogo</dt><dd>${KS.esc(o.game)}</dd>
        <dt>ID do jogador</dt><dd><b class="mono" style="font-size:16px">${KS.esc(o.player_id)}</b>
          <button class="btn btn-sm btn-ghost" id="copy-player">Copiar</button></dd>
        <dt>Nickname</dt><dd>${KS.esc(o.player_nickname || "—")}</dd>
        <dt>Observações</dt><dd>${KS.esc(o.customer_notes || "—")}</dd>
        <dt>Total</dt><dd><b>${KS.esc(KS.kz(o.total_kz))}</b></dd></dl></div>
      <div class="card"><h3 style="margin-bottom:10px">Cliente e pagamento</h3><dl class="kv">
        <dt>Cliente</dt><dd>${KS.esc(cust.full_name || "Conta eliminada")} ${cust.is_blocked ? '<span class="tag off">bloqueado</span>' : ""}</dd>
        <dt>E-mail</dt><dd>${KS.esc(cust.email || "—")}</dd>
        <dt>Telefone</dt><dd>${KS.esc(cust.phone || "—")}</dd>
        <dt>Método</dt><dd>${KS.esc(pm.name || "Ainda não escolhido")}</dd>
        ${pm.iban ? `<dt>IBAN</dt><dd class="mono">${KS.esc(pm.iban)}</dd>` : ""}
        ${pm.phone_number ? `<dt>Número</dt><dd class="mono">${KS.esc(pm.phone_number)}</dd>` : ""}
        ${pm.entity ? `<dt>Entidade / Ref.</dt><dd class="mono">${KS.esc(pm.entity)} / ${KS.esc(pm.reference || "")}</dd>` : ""}
        <dt>Pagamento enviado</dt><dd>${KS.esc(KS.date(o.payment_submitted_at) || "—")}</dd>
        <dt>Aprovado</dt><dd>${KS.esc(KS.date(o.approved_at) || "—")}</dd></dl></div>
    </div>
    <div class="card" style="margin-top:16px"><h3 style="margin-bottom:10px">Comprovativos (${proofs.length})</h3>
      <div class="proof-grid" id="proof-grid">${proofs.length ? "" : '<div class="muted">Ainda não foi enviado nenhum comprovativo.</div>'}</div></div>
    <div class="card" style="margin-top:16px"><h3 style="margin-bottom:10px">Acções</h3>
      <div class="row" id="order-actions">${next.length ? next.map((s) =>
        `<button class="btn ${ACTIONS[s].cls}" data-status="${s}">${ACTIONS[s].label}</button>`).join("") :
        '<span class="muted">Encomenda finalizada — sem acções disponíveis.</span>'}</div>
      <label for="admin-notes">Notas internas (não visíveis ao cliente)</label>
      <textarea id="admin-notes" maxlength="1000">${KS.esc(o.admin_notes || "")}</textarea>
      <div class="form-actions"><button class="btn btn-outline btn-sm" id="save-notes">Guardar notas</button></div></div>
    <div class="card" style="margin-top:16px"><h3 style="margin-bottom:10px">Histórico de estados</h3>
      <ul class="timeline">${hist.map((h, i) => `<li><b>${KS.esc(KS.STATUS[h.new_status])}</b>
        <span class="muted small"> · ${KS.esc(KS.date(h.created_at))}${actors[i] ? " · " + KS.esc(actors[i].full_name || actors[i].email) : ""}</span>
        ${h.note ? `<div class="small">${KS.esc(h.note)}</div>` : ""}</li>`).join("")}</ul></div>`;

  KS.qs("#copy-player", modal.body).onclick = () => navigator.clipboard.writeText(o.player_id).then(() => KS.toast("ID copiado."));
  KS.qs("#save-notes", modal.body).onclick = (e) => KS.busy(e.currentTarget, async () => {
    try {
      const b = KS.batch();
      b.update(doc(KS.db, "orders", o.id), { admin_notes: KS.qs("#admin-notes", modal.body).value.trim() || null,
        processed_by: KS.uid(), updated_at: KS.now() });
      KS.audit(b, "order.notes_updated", "orders", o.id, {});
      await b.commit();
      KS.toast("Notas guardadas.", "success");
    } catch (err) { KS.toast(KS.errMsg(err), "error"); }
  });
  KS.qsa("#order-actions [data-status]", modal.body).forEach((b) => { b.onclick = () => changeStatus(o, proofs, b.dataset.status, b); });
  renderProofs(proofs);
}

async function renderProofs(proofs) {
  if (!proofs.length || !modal) return;
  const grid = KS.qs("#proof-grid", modal.body);
  const urls = await Promise.all(proofs.map((p) => ST.getDownloadURL(ST.ref(KS.storage, p.storage_path)).catch(() => "")));
  const st = { pending: "Em análise", approved: "Aprovado", rejected: "Rejeitado" };
  grid.innerHTML = proofs.map((p, i) => `<div class="proof-thumb" data-i="${i}">
      ${urls[i] ? `<img src="${KS.esc(urls[i])}" alt="Comprovativo" loading="lazy">` : '<div class="empty">Ficheiro indisponível</div>'}
      <div class="meta"><b>${KS.esc(st[p.status] || p.status)}</b> · ${KS.esc(KS.date(p.created_at))}<br>
      ${KS.esc(p.mime_type)} · ${KS.esc((p.size_bytes / 1024).toFixed(0))} KB
      ${p.review_notes ? `<br><i>${KS.esc(p.review_notes)}</i>` : ""}</div></div>`).join("");
  KS.qsa(".proof-thumb", grid).forEach((el) => {
    el.onclick = () => {
      const url = urls[Number(el.dataset.i)];
      if (!url) return;
      KS.modal("Comprovativo", `<img class="proof-full" src="${KS.esc(url)}" alt="Comprovativo">
        <div class="form-actions"><a class="btn btn-outline" href="${KS.esc(url)}" target="_blank" rel="noopener noreferrer">Abrir original</a></div>`, { wide: true });
    };
  });
}

const CUSTOMER_MSG = {
  under_review: ["order_status", "Pagamento em verificação", (o) => `O pagamento da encomenda ${o.order_code} está a ser verificado.`],
  payment_approved: ["payment_approved", "Pagamento aprovado", (o) => `O pagamento da encomenda ${o.order_code} foi aprovado. Vamos processar o carregamento para o ID ${o.player_id}.`],
  payment_rejected: ["payment_rejected", "Pagamento rejeitado", (o, n) => `O comprovativo da encomenda ${o.order_code} foi rejeitado. Motivo: ${n}. Pode enviar um novo comprovativo.`],
  processing: ["order_status", "Encomenda em processamento", (o) => `A encomenda ${o.order_code} está a ser processada.`],
  completed: ["order_completed", "Encomenda concluída", (o) => `A encomenda ${o.order_code} foi concluída: ${((o.order_items || [])[0] || {}).product_name || "produto"} creditado no ID ${o.player_id}. Obrigado por comprar na KET SHOP!`],
  cancelled: ["order_status", "Encomenda cancelada", (o, n) => `A encomenda ${o.order_code} foi cancelada. Motivo: ${n}.`],
};

/** Mudança de estado num único commit: encomenda + comprovativo + histórico + notificação + auditoria. */
async function changeStatus(o, proofs, status, btn) {
  const a = ACTIONS[status];
  let note = null;
  if (a.reason) {
    note = await KS.prompt(a.label, a.reason, { required: true, danger: true, okLabel: a.label });
    if (note === null) return;
  } else {
    const msg = status === "payment_approved"
      ? `Confirma que recebeu ${KS.kz(o.total_kz)} referente à encomenda ${o.order_code}?`
      : status === "completed" ? `Confirma que o produto foi creditado no ID ${o.player_id}?`
        : `Alterar o estado para "${KS.STATUS[status]}"?`;
    if (!(await KS.confirm(a.label, msg, a.label))) return;
  }
  await KS.busy(btn, async () => {
    try {
      const fresh = await getDoc(doc(KS.db, "orders", o.id));
      if (fresh.data().status !== o.status) throw new Error("A encomenda mudou entretanto. Reabra-a para ver o estado actual.");
      const b = KS.batch();
      const upd = { status, processed_by: KS.uid(), updated_at: KS.now() };
      if (status === "payment_rejected") upd.rejection_reason = note;
      if (status === "cancelled") { upd.cancel_reason = note; upd.cancelled_at = KS.now(); }
      if (status === "payment_approved") upd.approved_at = KS.now();
      if (status === "completed") upd.completed_at = KS.now();
      b.update(doc(KS.db, "orders", o.id), upd);
      const pending = proofs.find((p) => p.status === "pending");
      if (pending && (status === "payment_approved" || status === "payment_rejected")) {
        b.update(doc(KS.db, "orders", o.id, "proofs", pending.id), { status: status === "payment_approved" ? "approved" : "rejected",
          reviewed_by: KS.uid(), reviewed_at: KS.now(), review_notes: note });
      }
      b.set(KS.newRef(`orders/${o.id}/history`), { old_status: o.status, new_status: status, note, changed_by: KS.uid(), created_at: KS.now() });
      const m = CUSTOMER_MSG[status];
      if (o.user_id && m) {
        b.set(KS.newRef("notifications"), { user_id: o.user_id, type: m[0], title: m[1], body: m[2](o, note), order_id: o.id,
          is_read: false, created_by: KS.uid(), created_at: KS.now() });
      }
      KS.audit(b, "order.status_changed", "orders", o.id, { order_code: o.order_code, from: o.status, to: status, note });
      await b.commit();
      KS.toast(`Estado actualizado: ${KS.STATUS[status]}. O cliente foi notificado.`, "success");
      KS.refreshPendingBadge();
      openOrder(o.id);
    } catch (err) {
      KS.toast(KS.errMsg(err), "error");
    }
  });
}

// ------------------------------------------------------------ Tempo real
KS.live(query(collection(KS.db, "orders"), orderBy("updated_at", "desc"), limit(20)), (changes) => {
  if (!changes.length) return;
  let flash = null;
  changes.forEach((c) => {
    const d = c.doc.data();
    flash = c.doc.id;
    if (soundOn && (c.type === "added" || (c.type === "modified" && d.status === "proof_submitted"))) {
      KS.beep();
      KS.toast(c.type === "added" && d.status === "pending_payment" ? "Nova encomenda recebida: " + d.order_code
        : "Actualização na encomenda " + d.order_code + ": " + (KS.STATUS[d.status] || d.status));
    }
  });
  load(flash);
  KS.refreshPendingBadge();
  if (openOrderId && changes.some((c) => c.doc.id === openOrderId) && !document.querySelector(".modal-backdrop + .modal-backdrop")) openOrder(openOrderId);
});

await load();
if (params.get("open")) openOrder(params.get("open"));
