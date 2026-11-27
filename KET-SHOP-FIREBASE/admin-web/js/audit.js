import { KS, FS } from "./core.js";
const { collection, getDocs, query, orderBy, limit, startAfter } = FS;

await KS.init("audit", "Auditoria");
const PAGE = 50;
let cursor = null;
let rows = [];
const ENTITY_ALIASES = { product_categories: "categories", payment_methods: "paymentMethods", app_settings: "settings", user_roles: "roles", profiles: "users" };

KS.qs("#aud-entity").onchange = () => renderRows();
KS.qs("#aud-search").addEventListener("input", KS.debounce(() => renderRows(), 250));
KS.qs("#aud-refresh").onclick = () => reload();
KS.qs("#aud-more").onclick = () => fetchPage();

function reload() { cursor = null; rows = []; fetchPage(); }

async function fetchPage() {
  try {
    const cons = [orderBy("created_at", "desc"), limit(PAGE)];
    if (cursor) cons.push(startAfter(cursor));
    const snap = await getDocs(query(collection(KS.db, "auditLogs"), ...cons));
    cursor = snap.docs[snap.docs.length - 1] || cursor;
    rows = rows.concat(KS.rows(snap));
    KS.qs("#aud-more").classList.toggle("hidden", snap.size < PAGE);
    renderRows();
  } catch (e) { KS.qs("#aud-body").innerHTML = `<tr><td colspan="6" class="empty">${KS.esc(KS.errMsg(e))}</td></tr>`; }
}

function renderRows() {
  const sel = KS.qs("#aud-entity").value;
  const ent = ENTITY_ALIASES[sel] || sel;
  const s = KS.qs("#aud-search").value.trim().toLowerCase();
  const list = rows.filter((r) => (!ent || r.entity === ent) && (!s || (r.action || "").toLowerCase().includes(s)));
  const body = KS.qs("#aud-body");
  body.innerHTML = list.length ? list.map((r) => `<tr>
    <td class="small nowrap">${KS.esc(KS.date(r.created_at))}</td>
    <td class="small">${KS.esc(r.actor_email || r.actor_id || "sistema")}</td>
    <td><span class="tag">${KS.esc(r.action)}</span></td><td>${KS.esc(r.entity)}</td>
    <td class="small mono">${KS.esc((r.entity_id || "").slice(0, 36))}</td>
    <td class="right"><button class="btn btn-sm btn-ghost" data-id="${KS.esc(r.id)}">Detalhes</button></td></tr>`).join("") :
    '<tr><td colspan="6" class="empty">Sem registos.</td></tr>';
  KS.qsa("[data-id]", body).forEach((b) => (b.onclick = () => {
    const r = rows.find((x) => x.id === b.dataset.id);
    const pre = document.createElement("pre");
    pre.className = "json";
    pre.textContent = JSON.stringify(r.details, null, 2);
    KS.modal(r.action + " · " + r.entity, pre, { wide: true });
  }));
}
reload();
