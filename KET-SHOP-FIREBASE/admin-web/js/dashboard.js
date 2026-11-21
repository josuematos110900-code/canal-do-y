import { KS, FS } from "./core.js";
const { collection, query, where, orderBy, getDocs, getCountFromServer, limit } = FS;

let ctx;
try { ctx = await KS.init("dashboard", "Dashboard"); } catch (e) { throw e; }
const name = ctx.user.displayName || (await KS.user(ctx.user.uid) || {}).full_name || "";
KS.qs("#dash-hello").textContent = "Olá, " + (name ? name.split(" ")[0] : "equipa");

const PAID = ["payment_approved", "processing", "completed"];
const dayKey = (d) => d.toLocaleDateString("sv-SE", { timeZone: "Africa/Luanda" }); // AAAA-MM-DD

async function loadStats() {
  const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
  const since7 = new Date(); since7.setDate(since7.getDate() - 6); since7.setHours(0, 0, 0, 0);
  const from = since < since7 ? since : since7;
  const [recentSnap, review, fulfil, total, customers] = await Promise.all([
    getDocs(query(collection(KS.db, "orders"), where("created_at", ">=", from), orderBy("created_at", "desc"))),
    getCountFromServer(query(collection(KS.db, "orders"), where("status", "in", ["proof_submitted", "under_review"]))),
    getCountFromServer(query(collection(KS.db, "orders"), where("status", "in", ["payment_approved", "processing"]))),
    getCountFromServer(collection(KS.db, "orders")),
    getCountFromServer(collection(KS.db, "users")),
  ]);
  const orders = KS.rows(recentSnap);
  const today = dayKey(new Date());
  const month = today.slice(0, 7);
  let ordersToday = 0, revToday = 0, revMonth = 0;
  const byDay = {};
  const byStatus = {};
  orders.forEach((o) => {
    const d = KS.toDate(o.created_at) || new Date();
    const k = dayKey(d);
    const paid = PAID.includes(o.status);
    if (k === today) { ordersToday++; if (paid) revToday += Number(o.total_kz); }
    if (k.slice(0, 7) === month && paid) revMonth += Number(o.total_kz);
    byDay[k] = byDay[k] || { orders: 0, revenue: 0 };
    byDay[k].orders++; if (paid) byDay[k].revenue += Number(o.total_kz);
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });
  KS.qs("#st-review").textContent = KS.num(review.data().count);
  KS.qs("#st-fulfil").textContent = KS.num(fulfil.data().count);
  KS.qs("#st-today").textContent = KS.num(ordersToday);
  KS.qs("#st-total").textContent = KS.num(total.data().count) + " no total";
  KS.qs("#st-rev-today").textContent = KS.kz(revToday);
  KS.qs("#st-rev-month").textContent = KS.kz(revMonth);
  KS.qs("#st-customers").textContent = KS.num(customers.data().count);

  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ key: dayKey(d), date: d }); }
  const max = Math.max(1, ...days.map((d) => (byDay[d.key] || {}).revenue || 0));
  KS.qs("#dash-chart").innerHTML = days.map((d) => {
    const v = byDay[d.key] || { orders: 0, revenue: 0 };
    return `<div class="bar" title="${KS.esc(KS.kz(v.revenue))} · ${v.orders} encomendas">
      <div class="val">${KS.esc(KS.num(v.revenue))}</div><div class="col" style="height:${Math.round((v.revenue / max) * 140)}px"></div>
      <div class="lbl">${KS.esc(d.date.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit" }))}</div></div>`;
  }).join("");

  const tot = Object.values(byStatus).reduce((a, b) => a + b, 0) || 1;
  KS.qs("#dash-status").innerHTML = '<p class="small muted" style="margin:0">Encomendas desde ' + KS.esc(from.toLocaleDateString("pt-PT")) + "</p>" +
    Object.keys(KS.STATUS).map((s) => {
      const c = byStatus[s] || 0;
      return `<div class="row"><a href="orders.html?filter=${s}" class="grow">${KS.statusPill(s)}</a>
        <div style="flex:2;height:8px;border-radius:6px;background:rgba(255,255,255,.07);overflow:hidden">
          <div style="height:100%;width:${(c / tot) * 100}%;background:linear-gradient(90deg,#6a1bcf,#b44cff)"></div></div>
        <b style="min-width:36px;text-align:right">${c}</b></div>`;
    }).join("");
}

async function renderRecent(snap) {
  const body = KS.qs("#dash-recent");
  const data = KS.rows(snap);
  if (!data.length) { body.innerHTML = '<tr><td colspan="7" class="empty">Ainda não há encomendas.</td></tr>'; return; }
  const users = await Promise.all(data.map((o) => KS.user(o.user_id)));
  body.innerHTML = data.map((o, i) => `
    <tr class="clickable" data-id="${KS.esc(o.id)}">
      <td class="mono">${KS.esc(o.order_code)}</td>
      <td>${KS.esc(users[i] ? users[i].full_name || users[i].email : "—")}</td>
      <td>${KS.esc(((o.order_items || [])[0] || {}).product_name || "")}</td>
      <td class="mono">${KS.esc(o.player_id)}</td>
      <td class="right nowrap">${KS.esc(KS.kz(o.total_kz))}</td>
      <td>${KS.statusPill(o.status)}</td>
      <td class="nowrap small">${KS.esc(KS.date(o.created_at))}</td></tr>`).join("");
  KS.qsa("tr[data-id]", body).forEach((tr) => { tr.onclick = () => (location.href = "orders.html?open=" + encodeURIComponent(tr.dataset.id)); });
}

loadStats().catch((e) => KS.toast(KS.errMsg(e), "error"));
const refresh = KS.debounce(() => { loadStats().catch(() => {}); KS.refreshPendingBadge(); }, 800);
KS.live(query(collection(KS.db, "orders"), orderBy("created_at", "desc"), limit(8)), (changes, snap) => {
  renderRecent(snap);
  if (changes.length) refresh();
});
