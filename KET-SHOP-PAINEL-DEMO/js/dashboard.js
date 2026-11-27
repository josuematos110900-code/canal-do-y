(async function () {
  "use strict";
  let ctx;
  try { ctx = await KS.init("dashboard", "Dashboard"); } catch (e) { return; }
  const meta = ctx.user.user_metadata || {};
  KS.qs("#dash-hello").textContent = "Olá, " + (meta.full_name ? meta.full_name.split(" ")[0] : "equipa");

  async function loadStats() {
    const { data, error } = await KS.sb.rpc("admin_dashboard_stats");
    if (error) return KS.toast(KS.errMsg(error), "error");
    KS.qs("#st-review").textContent = KS.num(data.awaiting_review);
    KS.qs("#st-fulfil").textContent = KS.num(data.to_fulfil);
    KS.qs("#st-today").textContent = KS.num(data.orders_today);
    KS.qs("#st-total").textContent = KS.num(data.orders_total) + " no total";
    KS.qs("#st-rev-today").textContent = KS.kz(data.revenue_today);
    KS.qs("#st-rev-month").textContent = KS.kz(data.revenue_month);
    KS.qs("#st-customers").textContent = KS.num(data.customers_total);

    const days = data.last_7_days || [];
    const max = Math.max(1, ...days.map((d) => Number(d.revenue)));
    KS.qs("#dash-chart").innerHTML = days.map((d) => {
      const h = Math.round((Number(d.revenue) / max) * 140);
      const label = new Date(d.day + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit" });
      return `<div class="bar" title="${KS.esc(KS.kz(d.revenue))} · ${KS.esc(d.orders)} encomendas">
        <div class="val">${KS.esc(KS.num(d.revenue))}</div><div class="col" style="height:${h}px"></div>
        <div class="lbl">${KS.esc(label)}</div></div>`;
    }).join("");

    const by = data.by_status || {};
    const total = Object.values(by).reduce((a, b) => a + Number(b), 0) || 1;
    KS.qs("#dash-status").innerHTML = Object.keys(KS.STATUS).map((s) => {
      const c = Number(by[s] || 0);
      return `<div class="row"><a href="orders.html?filter=${s}" class="grow">${KS.statusPill(s)}</a>
        <div style="flex:2;height:8px;border-radius:6px;background:rgba(255,255,255,.07);overflow:hidden">
          <div style="height:100%;width:${(c / total) * 100}%;background:linear-gradient(90deg,#6a1bcf,#b44cff)"></div></div>
        <b style="min-width:36px;text-align:right">${c}</b></div>`;
    }).join("");
  }

  async function loadRecent() {
    const { data, error } = await KS.sb.from("orders")
      .select("id,order_code,status,player_id,total_kz,created_at,order_items(product_name),profiles!orders_user_id_fkey(full_name,email)")
      .order("created_at", { ascending: false }).limit(8);
    const body = KS.qs("#dash-recent");
    if (error) { body.innerHTML = `<tr><td colspan="7" class="empty">${KS.esc(KS.errMsg(error))}</td></tr>`; return; }
    if (!data.length) { body.innerHTML = '<tr><td colspan="7" class="empty">Ainda não há encomendas.</td></tr>'; return; }
    body.innerHTML = data.map((o) => `
      <tr class="clickable" data-id="${KS.esc(o.id)}">
        <td class="mono">${KS.esc(o.order_code)}</td>
        <td>${KS.esc(o.profiles ? o.profiles.full_name || o.profiles.email : "—")}</td>
        <td>${KS.esc((o.order_items[0] || {}).product_name || "")}</td>
        <td class="mono">${KS.esc(o.player_id)}</td>
        <td class="right nowrap">${KS.esc(KS.kz(o.total_kz))}</td>
        <td>${KS.statusPill(o.status)}</td>
        <td class="nowrap small">${KS.esc(KS.date(o.created_at))}</td></tr>`).join("");
    KS.qsa("tr[data-id]", body).forEach((tr) => { tr.onclick = () => (location.href = "orders.html?open=" + tr.dataset.id); });
  }

  await Promise.all([loadStats(), loadRecent()]);
  const refresh = KS.debounce(() => { loadStats(); loadRecent(); KS.refreshPendingBadge(); }, 600);
  KS.live("dashboard-live", ["orders"], refresh);
})();
