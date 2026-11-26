(async function () {
  "use strict";
  let ctx;
  try { ctx = await KS.init("customers", "Clientes"); } catch (e) { return; }
  let rows = [];

  KS.qs("#cust-search").addEventListener("input", KS.debounce(render, 200));
  KS.qs("#cust-filter").onchange = render;
  KS.qs("#cust-export").onclick = () => {
    const out = [["Nome", "E-mail", "Telefone", "Papéis", "Encomendas", "Total gasto (Kz)", "Bloqueado", "Registo"]];
    filtered().forEach((c) => out.push([c.full_name, c.email, c.phone, (c.roles || []).join(","), c.orders_count, c.total_spent_kz, c.is_blocked ? "sim" : "não", KS.day(c.created_at)]));
    KS.downloadCSV("clientes-eliteshop.csv", out);
  };

  async function load() {
    const { data, error } = await KS.sb.from("admin_customer_overview").select("*").order("created_at", { ascending: false }).limit(2000);
    if (error) { KS.qs("#cust-body").innerHTML = `<tr><td colspan="8" class="empty">${KS.esc(KS.errMsg(error))}</td></tr>`; return; }
    rows = data; render();
  }

  function filtered() {
    const q = KS.qs("#cust-search").value.trim().toLowerCase();
    const f = KS.qs("#cust-filter").value;
    return rows.filter((c) => {
      if (f === "blocked" && !c.is_blocked) return false;
      if (f === "staff" && !(c.roles || []).some((r) => r === "admin" || r === "operator")) return false;
      if (!q) return true;
      return [c.full_name, c.email, c.phone, c.last_player_id].some((v) => (v || "").toLowerCase().includes(q));
    });
  }

  function roleTags(roles) {
    return (roles || []).filter((r) => r !== "customer").map((r) => `<span class="tag role-${KS.esc(r)}">${r === "admin" ? "admin" : "operador"}</span>`).join("") || '<span class="tag">cliente</span>';
  }

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
    const isSelf = c.id === ctx.user.id;
    const m = KS.modal(c.full_name || c.email, '<div class="empty"><span class="spinner"></span></div>', { wide: true });
    const { data: orders } = await KS.sb.from("orders").select("id,order_code,status,total_kz,created_at,order_items(product_name)")
      .eq("user_id", c.id).order("created_at", { ascending: false }).limit(20);
    const roles = c.roles || [];
    m.body.innerHTML = `
      <dl class="kv"><dt>E-mail</dt><dd>${KS.esc(c.email)}</dd><dt>Telefone</dt><dd>${KS.esc(c.phone || "—")}</dd>
        <dt>Último ID de jogador</dt><dd class="mono">${KS.esc(c.last_player_id || "—")}</dd>
        <dt>Encomendas</dt><dd>${KS.esc(c.orders_count)} · ${KS.esc(KS.kz(c.total_spent_kz))} pagos</dd>
        <dt>Estado</dt><dd>${c.is_blocked ? `<span class="tag off">bloqueado</span> ${KS.esc(c.blocked_reason || "")}` : '<span class="tag on">activo</span>'}</dd></dl>
      ${KS.isAdmin ? `<div class="card" style="margin-top:14px"><h3>Papéis e acesso</h3>
        <label class="check"><input type="checkbox" id="r-operator" ${roles.includes("operator") ? "checked" : ""}> Operador (gere encomendas, comprovativos e notificações)</label>
        <label class="check"><input type="checkbox" id="r-admin" ${roles.includes("admin") ? "checked" : ""} ${isSelf ? "disabled" : ""}> Administrador (acesso total)</label>
        <div class="form-actions">
          ${isSelf ? "" : `<button class="btn ${c.is_blocked ? "btn-success" : "btn-danger"}" id="c-block">${c.is_blocked ? "Desbloquear conta" : "Bloquear conta"}</button>`}
          <a class="btn btn-outline" href="notifications.html?user=${KS.esc(c.id)}">Enviar notificação</a></div></div>` :
        `<div class="form-actions"><a class="btn btn-outline" href="notifications.html?user=${KS.esc(c.id)}">Enviar notificação</a></div>`}
      <h3 style="margin:16px 0 8px">Últimas encomendas</h3>
      <div class="table-wrap"><table style="min-width:480px"><thead><tr><th>Código</th><th>Produto</th><th class="right">Total</th><th>Estado</th><th>Data</th></tr></thead><tbody>
      ${(orders || []).map((o) => `<tr class="clickable" onclick="location.href='orders.html?open=${KS.esc(o.id)}'">
        <td class="mono">${KS.esc(o.order_code)}</td><td>${KS.esc((o.order_items[0] || {}).product_name || "")}</td>
        <td class="right nowrap">${KS.esc(KS.kz(o.total_kz))}</td><td>${KS.statusPill(o.status)}</td><td class="small">${KS.esc(KS.date(o.created_at))}</td></tr>`).join("") ||
        '<tr><td colspan="5" class="empty">Sem encomendas.</td></tr>'}</tbody></table></div>`;

    if (!KS.isAdmin) return;
    ["operator", "admin"].forEach((role) => {
      const cb = KS.qs("#r-" + role, m.body);
      if (!cb) return;
      cb.onchange = async () => {
        const { error } = await KS.sb.rpc("admin_set_user_role", { p_user_id: c.id, p_role: role, p_enabled: cb.checked });
        if (error) { cb.checked = !cb.checked; return KS.toast(KS.errMsg(error), "error"); }
        KS.toast("Papel actualizado.", "success"); load();
      };
    });
    const blockBtn = KS.qs("#c-block", m.body);
    if (blockBtn) blockBtn.onclick = async () => {
      let reason = null;
      if (!c.is_blocked) {
        reason = await KS.prompt("Bloquear conta", "Motivo (opcional, mostrado ao cliente ao iniciar sessão)", { danger: true, okLabel: "Bloquear" });
        if (reason === null) return;
      }
      const { error } = await KS.sb.rpc("admin_set_user_blocked", { p_user_id: c.id, p_blocked: !c.is_blocked, p_reason: reason });
      if (error) return KS.toast(KS.errMsg(error), "error");
      KS.toast(c.is_blocked ? "Conta desbloqueada." : "Conta bloqueada.", "success");
      m.close(); load();
    };
  }

  load();
})();
