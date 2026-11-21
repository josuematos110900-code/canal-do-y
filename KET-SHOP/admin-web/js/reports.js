(async function () {
  "use strict";
  try { await KS.init("reports", "Relatórios"); } catch (e) { return; }
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

  async function run() {
    const from = KS.qs("#rep-from").value, to = KS.qs("#rep-to").value;
    if (!from || !to || from > to) return KS.toast("Intervalo de datas inválido.", "error");
    await KS.busy(KS.qs("#rep-run"), async () => {
      const { data, error } = await KS.sb.rpc("admin_sales_report", { p_from: from, p_to: to });
      if (error) return KS.toast(KS.errMsg(error), "error");
      last = data; render(data);
      KS.qs("#rep-export").disabled = false;
    });
  }

  function render(d) {
    KS.qs("#rep-revenue").textContent = KS.kz(d.revenue);
    KS.qs("#rep-paid").textContent = KS.num(d.paid_orders);
    KS.qs("#rep-orders").textContent = KS.num(d.orders) + " encomendas criadas";
    KS.qs("#rep-avg").textContent = d.paid_orders ? KS.kz(Number(d.revenue) / d.paid_orders) : "—";
    KS.qs("#rep-lost").textContent = KS.num(d.rejected) + " / " + KS.num(d.cancelled);
    const days = d.by_day || [];
    const max = Math.max(1, ...days.map((x) => Number(x.revenue)));
    KS.qs("#rep-chart").innerHTML = days.length ? days.map((x) => `
      <div class="bar" title="${KS.esc(x.day)} · ${KS.esc(KS.kz(x.revenue))} · ${KS.esc(x.orders)} encomendas">
        <div class="col" style="height:${Math.round((Number(x.revenue) / max) * 150)}px"></div>
        <div class="lbl">${KS.esc(new Date(x.day + "T12:00:00").toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }))}</div></div>`).join("")
      : '<div class="empty" style="width:100%">Sem encomendas no período.</div>';
    KS.qs("#rep-products").innerHTML = (d.by_product || []).map((p) =>
      `<tr><td>${KS.esc(p.product)}</td><td class="right">${KS.esc(p.quantity)}</td><td class="right nowrap">${KS.esc(KS.kz(p.revenue))}</td></tr>`).join("") ||
      '<tr><td colspan="3" class="empty">Sem vendas.</td></tr>';
    KS.qs("#rep-methods").innerHTML = (d.by_payment_method || []).map((p) =>
      `<tr><td>${KS.esc(p.method)}</td><td class="right">${KS.esc(p.orders)}</td><td class="right nowrap">${KS.esc(KS.kz(p.revenue))}</td></tr>`).join("") ||
      '<tr><td colspan="3" class="empty">Sem vendas.</td></tr>';
  }

  function exportCsv() {
    if (!last) return;
    const rows = [["Relatório KET SHOP", last.from + " a " + last.to], [],
      ["Receita (Kz)", last.revenue], ["Encomendas", last.orders], ["Pagas", last.paid_orders], ["Rejeitadas", last.rejected], ["Canceladas", last.cancelled], [],
      ["Dia", "Encomendas", "Receita (Kz)"]];
    (last.by_day || []).forEach((x) => rows.push([x.day, x.orders, x.revenue]));
    rows.push([], ["Produto", "Quantidade", "Receita (Kz)"]);
    (last.by_product || []).forEach((x) => rows.push([x.product, x.quantity, x.revenue]));
    rows.push([], ["Método", "Encomendas", "Receita (Kz)"]);
    (last.by_payment_method || []).forEach((x) => rows.push([x.method, x.orders, x.revenue]));
    KS.downloadCSV(`relatorio-ketshop-${last.from}-${last.to}.csv`, rows);
  }

  run();
})();
