import { KS, FS } from "./core.js";
const { collection, getDocs, query, where, orderBy } = FS;

await KS.init("reports", "Relatórios");
let last = null;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const setRange = (r) => {
  const to = new Date(); let from = new Date();
  if (r === "month") from = new Date(to.getFullYear(), to.getMonth(), 1);
  else from.setDate(to.getDate() - (Number(r) - 1));
  KS.qs("#rep-from").value = iso(from); KS.qs("#rep-to").value = iso(to);
};
setRange("30");
KS.qsa("[data-range]").forEach((b) => (b.onclick = () => { setRange(b.dataset.range); run(); }));
KS.qs("#rep-run").onclick = run;
KS.qs("#rep-export").onclick = exportCsv;
const PAID = ["payment_approved", "processing", "completed"];

async function run() {
  const from = KS.qs("#rep-from").value, to = KS.qs("#rep-to").value;
  if (!from || !to || from > to) return KS.toast("Intervalo de datas inválido.", "error");
  if ((new Date(to) - new Date(from)) / 864e5 > 366) return KS.toast("Intervalo máximo de 366 dias.", "error");
  await KS.busy(KS.qs("#rep-run"), async () => {
    try {
      const snap = await getDocs(query(collection(KS.db, "orders"),
        where("created_at", ">=", new Date(from + "T00:00:00")), where("created_at", "<=", new Date(to + "T23:59:59")), orderBy("created_at")));
      const orders = KS.rows(snap);
      const d = { from, to, orders: orders.length, paid_orders: 0, revenue: 0, cancelled: 0, rejected: 0, by_day: {}, by_product: {}, by_payment_method: {} };
      orders.forEach((o) => {
        const day = iso(KS.toDate(o.created_at));
        const paid = PAID.includes(o.status);
        const day_ = (d.by_day[day] = d.by_day[day] || { day, orders: 0, revenue: 0 });
        day_.orders++;
        if (o.status === "cancelled") d.cancelled++;
        if (o.status === "payment_rejected") d.rejected++;
        if (!paid) return;
        d.paid_orders++; d.revenue += Number(o.total_kz); day_.revenue += Number(o.total_kz);
        const it = (o.order_items || [])[0] || {};
        const p = (d.by_product[it.product_name] = d.by_product[it.product_name] || { product: it.product_name, quantity: 0, revenue: 0 });
        p.quantity += it.quantity || 1; p.revenue += Number(o.total_kz);
        const mn = (o.payment_method_snapshot || {}).name || "Não definido";
        const m = (d.by_payment_method[mn] = d.by_payment_method[mn] || { method: mn, orders: 0, revenue: 0 });
        m.orders++; m.revenue += Number(o.total_kz);
      });
      d.by_day = Object.values(d.by_day).sort((a, b) => a.day.localeCompare(b.day));
      d.by_product = Object.values(d.by_product).sort((a, b) => b.revenue - a.revenue);
      d.by_payment_method = Object.values(d.by_payment_method).sort((a, b) => b.revenue - a.revenue);
      last = d; render(d);
      KS.qs("#rep-export").disabled = false;
    } catch (e) { KS.toast(KS.errMsg(e), "error"); }
  });
}

function render(d) {
  KS.qs("#rep-revenue").textContent = KS.kz(d.revenue);
  KS.qs("#rep-paid").textContent = KS.num(d.paid_orders);
  KS.qs("#rep-orders").textContent = KS.num(d.orders) + " encomendas criadas";
  KS.qs("#rep-avg").textContent = d.paid_orders ? KS.kz(d.revenue / d.paid_orders) : "—";
  KS.qs("#rep-lost").textContent = KS.num(d.rejected) + " / " + KS.num(d.cancelled);
  const max = Math.max(1, ...d.by_day.map((x) => x.revenue));
  KS.qs("#rep-chart").innerHTML = d.by_day.length ? d.by_day.map((x) => `
    <div class="bar" title="${KS.esc(x.day)} · ${KS.esc(KS.kz(x.revenue))} · ${x.orders} encomendas">
      <div class="col" style="height:${Math.round((x.revenue / max) * 150)}px"></div>
      <div class="lbl">${KS.esc(x.day.slice(8, 10) + "/" + x.day.slice(5, 7))}</div></div>`).join("")
    : '<div class="empty" style="width:100%">Sem encomendas no período.</div>';
  KS.qs("#rep-products").innerHTML = d.by_product.map((p) =>
    `<tr><td>${KS.esc(p.product)}</td><td class="right">${KS.esc(p.quantity)}</td><td class="right nowrap">${KS.esc(KS.kz(p.revenue))}</td></tr>`).join("") ||
    '<tr><td colspan="3" class="empty">Sem vendas.</td></tr>';
  KS.qs("#rep-methods").innerHTML = d.by_payment_method.map((p) =>
    `<tr><td>${KS.esc(p.method)}</td><td class="right">${KS.esc(p.orders)}</td><td class="right nowrap">${KS.esc(KS.kz(p.revenue))}</td></tr>`).join("") ||
    '<tr><td colspan="3" class="empty">Sem vendas.</td></tr>';
}

function exportCsv() {
  if (!last) return;
  const rows = [["Relatório KET SHOP", last.from + " a " + last.to], [],
    ["Receita (Kz)", last.revenue], ["Encomendas", last.orders], ["Pagas", last.paid_orders], ["Rejeitadas", last.rejected], ["Canceladas", last.cancelled], [],
    ["Dia", "Encomendas", "Receita (Kz)"]];
  last.by_day.forEach((x) => rows.push([x.day, x.orders, x.revenue]));
  rows.push([], ["Produto", "Quantidade", "Receita (Kz)"]);
  last.by_product.forEach((x) => rows.push([x.product, x.quantity, x.revenue]));
  rows.push([], ["Método", "Encomendas", "Receita (Kz)"]);
  last.by_payment_method.forEach((x) => rows.push([x.method, x.orders, x.revenue]));
  KS.downloadCSV(`relatorio-ketshop-${last.from}-${last.to}.csv`, rows);
}

run();
