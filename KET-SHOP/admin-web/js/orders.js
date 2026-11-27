(async function () {
  "use strict";
  try { await KS.init("orders", "Encomendas"); } catch (e) { return; }

  const PAGE = 25;
  const params = new URLSearchParams(location.search);
  const state = { filter: params.get("filter") || "all", search: "", from: "", to: "", page: 0, rows: [], total: 0 };
  let soundOn = true;
  let openOrderId = null;

  const { data: snd } = await KS.sb.from("app_settings").select("value").eq("key", "admin_order_alert_sound").maybeSingle();
  if (snd && snd.value === false) soundOn = false;

  // ------------------------------------------------------------ Filtros
  KS.qsa("#order-tabs .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.filter === state.filter);
    t.onclick = () => {
      KS.qsa("#order-tabs .tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      state.filter = t.dataset.filter; state.page = 0; load();
    };
  });
  KS.qs("#order-search").addEventListener("input", KS.debounce((e) => { state.search = e.target.value.trim(); state.page = 0; load(); }, 350));
  KS.qs("#order-from").onchange = (e) => { state.from = e.target.value; state.page = 0; load(); };
  KS.qs("#order-to").onchange = (e) => { state.to = e.target.value; state.page = 0; load(); };
  KS.qs("#order-refresh").onclick = () => load();
  KS.qs("#orders-prev").onclick = () => { if (state.page > 0) { state.page--; load(); } };
  KS.qs("#orders-next").onclick = () => { if ((state.page + 1) * PAGE < state.total) { state.page++; load(); } };
  KS.qs("#order-export").onclick = exportCsv;

  function buildQuery(select, withCount) {
    let q = KS.sb.from("orders").select(select, withCount ? { count: "exact" } : undefined);
    if (state.filter === "review") q = q.in("status", ["proof_submitted", "under_review"]);
    else if (state.filter === "fulfil") q = q.in("status", ["payment_approved", "processing"]);
    else if (state.filter !== "all") q = q.eq("status", state.filter);
    if (state.search) {
      const s = state.search.replace(/[,()*%\\]/g, " ").trim();
      if (s) q = q.or(`order_code.ilike.*${s}*,player_id.ilike.*${s}*,player_nickname.ilike.*${s}*`);
    }
    if (state.from) q = q.gte("created_at", new Date(state.from + "T00:00:00").toISOString());
    if (state.to) q = q.lte("created_at", new Date(state.to + "T23:59:59").toISOString());
    return q.order("created_at", { ascending: false });
  }

  const LIST_SELECT = "id,order_code,status,player_id,player_nickname,total_kz,created_at,payment_method_snapshot," +
    "order_items(product_name),profiles!orders_user_id_fkey(full_name,email)";

  async function load(flashId) {
    const body = KS.qs("#orders-body");
    const { data, error, count } = await buildQuery(LIST_SELECT, true).range(state.page * PAGE, state.page * PAGE + PAGE - 1);
    if (error) { body.innerHTML = `<tr><td colspan="8" class="empty">${KS.esc(KS.errMsg(error))}</td></tr>`; return; }
    state.rows = data; state.total = count || 0;
    KS.qs("#orders-count").textContent = state.total
      ? `${state.page * PAGE + 1}–${Math.min(state.total, (state.page + 1) * PAGE)} de ${state.total}` : "";
    if (!data.length) { body.innerHTML = '<tr><td colspan="8" class="empty">Nenhuma encomenda encontrada.</td></tr>'; return; }
    body.innerHTML = data.map((o) => `
      <tr class="clickable ${o.id === flashId ? "flash" : ""}" data-id="${KS.esc(o.id)}">
        <td class="mono nowrap">${KS.esc(o.order_code)}</td>
        <td>${KS.esc(o.profiles ? o.profiles.full_name || "—" : "Conta eliminada")}<div class="small muted">${KS.esc(o.profiles ? o.profiles.email : "")}</div></td>
        <td>${KS.esc((o.order_items[0] || {}).product_name || "")}</td>
        <td class="mono">${KS.esc(o.player_id)}${o.player_nickname ? `<div class="small muted">${KS.esc(o.player_nickname)}</div>` : ""}</td>
        <td class="small">${KS.esc(o.payment_method_snapshot ? o.payment_method_snapshot.name : "—")}</td>
        <td class="right nowrap">${KS.esc(KS.kz(o.total_kz))}</td>
        <td>${KS.statusPill(o.status)}</td>
        <td class="small nowrap">${KS.esc(KS.date(o.created_at))}</td></tr>`).join("");
    KS.qsa("tr[data-id]", body).forEach((tr) => { tr.onclick = () => openOrder(tr.dataset.id); });
  }

  async function exportCsv() {
    const { data, error } = await buildQuery(LIST_SELECT, false).limit(5000);
    if (error) return KS.toast(KS.errMsg(error), "error");
    const rows = [["Código", "Estado", "Cliente", "E-mail", "Produto", "ID jogador", "Nickname", "Método", "Total (Kz)", "Data"]];
    data.forEach((o) => rows.push([o.order_code, KS.STATUS[o.status], o.profiles ? o.profiles.full_name : "", o.profiles ? o.profiles.email : "",
      (o.order_items[0] || {}).product_name, o.player_id, o.player_nickname, o.payment_method_snapshot ? o.payment_method_snapshot.name : "",
      o.total_kz, KS.date(o.created_at)]));
    KS.downloadCSV("encomendas-eliteshop.csv", rows);
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
    openOrderId = id;
    if (modal) modal.close();
    modal = KS.modal("Encomenda", '<div class="empty"><span class="spinner"></span></div>', { wide: true, onClose: () => { openOrderId = null; modal = null; } });
    const [{ data: o, error }, { data: proofs }, { data: hist }] = await Promise.all([
      KS.sb.from("orders").select("*,order_items(*),profiles!orders_user_id_fkey(id,full_name,email,phone,is_blocked)").eq("id", id).single(),
      KS.sb.from("payment_proofs").select("*").eq("order_id", id).order("created_at", { ascending: false }),
      KS.sb.from("order_status_history").select("*,profiles!order_status_history_changed_by_fkey(full_name,email)").eq("order_id", id).order("created_at"),
    ]);
    if (!modal) return;
    if (error) { modal.body.innerHTML = `<div class="alert error">${KS.esc(KS.errMsg(error))}</div>`; return; }
    modal.el.querySelector("h2").textContent = "Encomenda " + o.order_code;
    const item = o.order_items[0] || {};
    const snap = item.product_snapshot || {};
    const pm = o.payment_method_snapshot || {};
    const cust = o.profiles || {};
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
          ${snap.total_amount ? `<dt>Quantidade</dt><dd>${KS.esc(KS.num(snap.base_amount))} + ${KS.esc(KS.num(snap.bonus_amount))} = <b>${KS.esc(KS.num(snap.total_amount))}</b> ${KS.esc(snap.unit_label || "")}</dd>` : ""}
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
      <div class="card" style="margin-top:16px"><h3 style="margin-bottom:10px">Comprovativos (${(proofs || []).length})</h3>
        <div class="proof-grid" id="proof-grid">${(proofs || []).length ? "" : '<div class="muted">Ainda não foi enviado nenhum comprovativo.</div>'}</div></div>
      <div class="card" style="margin-top:16px"><h3 style="margin-bottom:10px">Acções</h3>
        <div class="row" id="order-actions">${next.length ? next.map((s) =>
          `<button class="btn ${ACTIONS[s].cls}" data-status="${s}">${ACTIONS[s].label}</button>`).join("") :
          '<span class="muted">Encomenda finalizada — sem acções disponíveis.</span>'}</div>
        <label for="admin-notes">Notas internas (não visíveis ao cliente)</label>
        <textarea id="admin-notes" maxlength="1000">${KS.esc(o.admin_notes || "")}</textarea>
        <div class="form-actions"><button class="btn btn-outline btn-sm" id="save-notes">Guardar notas</button></div></div>
      <div class="card" style="margin-top:16px"><h3 style="margin-bottom:10px">Histórico de estados</h3>
        <ul class="timeline">${(hist || []).map((h) => `<li><b>${KS.esc(KS.STATUS[h.new_status])}</b>
          <span class="muted small"> · ${KS.esc(KS.date(h.created_at))}${h.profiles ? " · " + KS.esc(h.profiles.full_name || h.profiles.email) : ""}</span>
          ${h.note ? `<div class="small">${KS.esc(h.note)}</div>` : ""}</li>`).join("")}</ul></div>`;

    KS.qs("#copy-player", modal.body).onclick = () => navigator.clipboard.writeText(o.player_id).then(() => KS.toast("ID copiado."));
    KS.qs("#save-notes", modal.body).onclick = (e) => KS.busy(e.currentTarget, async () => {
      const { error: nErr } = await KS.sb.rpc("admin_update_order_notes", { p_order_id: o.id, p_notes: KS.qs("#admin-notes", modal.body).value });
      KS.toast(nErr ? KS.errMsg(nErr) : "Notas guardadas.", nErr ? "error" : "success");
    });
    KS.qsa("#order-actions [data-status]", modal.body).forEach((b) => {
      b.onclick = () => changeStatus(o, b.dataset.status, b);
    });
    renderProofs(proofs || []);
  }

  async function renderProofs(proofs) {
    if (!proofs.length || !modal) return;
    const grid = KS.qs("#proof-grid", modal.body);
    const { data: signed, error } = await KS.sb.storage.from(KS.BUCKET).createSignedUrls(proofs.map((p) => p.storage_path), 600);
    if (error) { grid.innerHTML = `<div class="alert error">${KS.esc(KS.errMsg(error))}</div>`; return; }
    const st = { pending: "Em análise", approved: "Aprovado", rejected: "Rejeitado" };
    grid.innerHTML = proofs.map((p, i) => {
      const url = signed[i] && signed[i].signedUrl ? signed[i].signedUrl : "";
      return `<div class="proof-thumb" data-i="${i}">
        ${url ? `<img src="${KS.esc(url)}" alt="Comprovativo" loading="lazy">` : '<div class="empty">Ficheiro indisponível</div>'}
        <div class="meta"><b>${KS.esc(st[p.status] || p.status)}</b> · ${KS.esc(KS.date(p.created_at))}<br>
        ${KS.esc(p.mime_type)} · ${KS.esc((p.size_bytes / 1024).toFixed(0))} KB
        ${p.review_notes ? `<br><i>${KS.esc(p.review_notes)}</i>` : ""}</div></div>`;
    }).join("");
    KS.qsa(".proof-thumb", grid).forEach((el) => {
      el.onclick = () => {
        const s = signed[Number(el.dataset.i)];
        if (!s || !s.signedUrl) return;
        KS.modal("Comprovativo", `<img class="proof-full" src="${KS.esc(s.signedUrl)}" alt="Comprovativo">
          <div class="form-actions"><a class="btn btn-outline" href="${KS.esc(s.signedUrl)}" target="_blank" rel="noopener noreferrer">Abrir original</a></div>`, { wide: true });
      };
    });
  }

  async function changeStatus(o, status, btn) {
    const a = ACTIONS[status];
    let note = null;
    if (a.reason) {
      note = await KS.prompt(a.label, a.reason, { required: true, danger: true, okLabel: a.label });
      if (note === null) return;
    } else {
      const msg = status === "payment_approved"
        ? `Confirma que recebeu ${KS.kz(o.total_kz)} referente à encomenda ${o.order_code}?`
        : status === "completed"
          ? `Confirma que o produto foi creditado no ID ${o.player_id}?`
          : `Alterar o estado para "${KS.STATUS[status]}"?`;
      if (!(await KS.confirm(a.label, msg, a.label))) return;
    }
    await KS.busy(btn, async () => {
      const { error } = await KS.sb.rpc("admin_update_order_status", { p_order_id: o.id, p_new_status: status, p_note: note });
      if (error) return KS.toast(KS.errMsg(error), "error");
      KS.toast(`Estado actualizado: ${KS.STATUS[status]}. O cliente foi notificado.`, "success");
      await load(o.id);
      KS.refreshPendingBadge();
      openOrder(o.id);
    });
  }

  // ------------------------------------------------------------ Tempo real
  KS.live("orders-admin", ["orders", "payment_proofs"], (p) => {
    if (p && soundOn && ((p.table === "orders" && p.eventType === "INSERT") || (p.table === "payment_proofs" && p.eventType === "INSERT"))) {
      KS.beep();
      KS.toast(p.table === "orders" ? "Nova encomenda recebida." : "Novo comprovativo recebido.");
    }
    const id = p && p.new && (p.table === "orders" ? p.new.id : p.new.order_id);
    load(id);
    KS.refreshPendingBadge();
    if (id && openOrderId === id && p.table === "payment_proofs") openOrder(id);
  });

  await load();
  if (params.get("open")) openOrder(params.get("open"));
})();
