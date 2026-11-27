(async function () {
  "use strict";
  try { await KS.init("notifications", "Notificações"); } catch (e) { return; }
  const params = new URLSearchParams(location.search);
  let listType = "";

  const target = KS.qs("#notif-target");
  const userBox = KS.qs("#notif-user-box");
  const userSel = KS.qs("#notif-user");
  target.onchange = () => userBox.classList.toggle("hidden", target.value !== "one");

  async function searchUsers(q) {
    let query = KS.sb.from("profiles").select("id,full_name,email").order("full_name").limit(30);
    const s = (q || "").replace(/[,()*%\\]/g, " ").trim();
    if (s) query = query.or(`full_name.ilike.*${s}*,email.ilike.*${s}*`);
    const { data, error } = await query;
    if (error) return KS.toast(KS.errMsg(error), "error");
    userSel.innerHTML = data.map((u) => `<option value="${KS.esc(u.id)}">${KS.esc(u.full_name || "—")} · ${KS.esc(u.email || "")}</option>`).join("");
  }
  KS.qs("#notif-user-search").addEventListener("input", KS.debounce((e) => searchUsers(e.target.value), 300));

  if (params.get("user")) {
    target.value = "one"; userBox.classList.remove("hidden");
    const { data } = await KS.sb.from("profiles").select("id,full_name,email").eq("id", params.get("user")).maybeSingle();
    if (data) userSel.innerHTML = `<option value="${KS.esc(data.id)}" selected>${KS.esc(data.full_name || "—")} · ${KS.esc(data.email || "")}</option>`;
  } else {
    searchUsers("");
  }

  KS.qs("#notif-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = KS.qs("#notif-title").value.trim();
    const body = KS.qs("#notif-body").value.trim();
    const userId = target.value === "one" ? userSel.value : null;
    if (!title || !body) return KS.toast("Indique o título e a mensagem.", "error");
    if (target.value === "one" && !userId) return KS.toast("Escolha o cliente.", "error");
    const who = userId ? "este cliente" : "TODOS os clientes";
    if (!(await KS.confirm("Enviar notificação", `Enviar "${title}" para ${who}?`, "Enviar"))) return;
    await KS.busy(KS.qs("#notif-send"), async () => {
      const { data, error } = await KS.sb.rpc("admin_send_notification", { p_user_id: userId, p_title: title, p_body: body });
      if (error) return KS.toast(KS.errMsg(error), "error");
      KS.toast(`Notificação enviada a ${data} destinatário(s).`, "success");
      KS.qs("#notif-title").value = ""; KS.qs("#notif-body").value = "";
      loadList();
    });
  });

  KS.qsa("#notif-tabs .tab").forEach((t) => (t.onclick = () => {
    KS.qsa("#notif-tabs .tab").forEach((x) => x.classList.toggle("active", x === t));
    listType = t.dataset.type; loadList();
  }));
  KS.qs("#notif-refresh").onclick = loadList;

  const TYPES = { order_created: "Encomenda recebida", proof_received: "Comprovativo recebido", payment_approved: "Pagamento aprovado",
    payment_rejected: "Pagamento rejeitado", order_completed: "Encomenda concluída", order_status: "Estado", general: "Geral" };

  async function loadList() {
    let q = KS.sb.from("notifications").select("id,type,title,is_read,created_at,profiles!notifications_user_id_fkey(full_name,email)")
      .order("created_at", { ascending: false }).limit(100);
    if (listType === "general") q = q.eq("type", "general");
    if (listType === "auto") q = q.neq("type", "general");
    const { data, error } = await q;
    const body = KS.qs("#notif-body-list");
    if (error) { body.innerHTML = `<tr><td colspan="5" class="empty">${KS.esc(KS.errMsg(error))}</td></tr>`; return; }
    body.innerHTML = data.length ? data.map((n) => `<tr>
      <td class="small nowrap">${KS.esc(KS.date(n.created_at))}</td>
      <td class="small">${KS.esc(n.profiles ? n.profiles.full_name || n.profiles.email : "")}</td>
      <td><span class="tag">${KS.esc(TYPES[n.type] || n.type)}</span></td>
      <td>${KS.esc(n.title)}</td><td>${n.is_read ? "✓" : ""}</td></tr>`).join("") :
      '<tr><td colspan="5" class="empty">Sem notificações.</td></tr>';
  }
  loadList();
})();
