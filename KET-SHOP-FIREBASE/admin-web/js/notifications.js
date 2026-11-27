import { KS, FS } from "./core.js";
const { collection, getDocs, getDoc, doc, query, where, orderBy, limit } = FS;

await KS.init("notifications", "Notificações");
const params = new URLSearchParams(location.search);
let listType = "";
let allUsers = null;

const target = KS.qs("#notif-target");
const userBox = KS.qs("#notif-user-box");
const userSel = KS.qs("#notif-user");
target.onchange = () => userBox.classList.toggle("hidden", target.value !== "one");

async function users() {
  if (!allUsers) allUsers = KS.rows(await getDocs(query(collection(KS.db, "users"), limit(5000))));
  return allUsers;
}
async function searchUsers(q) {
  const s = (q || "").toLowerCase();
  const list = (await users()).filter((u) => !s || (u.full_name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s)).slice(0, 30);
  userSel.innerHTML = list.map((u) => `<option value="${KS.esc(u.id)}">${KS.esc(u.full_name || "—")} · ${KS.esc(u.email || "")}</option>`).join("");
}
KS.qs("#notif-user-search").addEventListener("input", KS.debounce((e) => searchUsers(e.target.value), 250));

if (params.get("user")) {
  target.value = "one"; userBox.classList.remove("hidden");
  const s = await getDoc(doc(KS.db, "users", params.get("user")));
  if (s.exists()) userSel.innerHTML = `<option value="${KS.esc(s.id)}" selected>${KS.esc(s.data().full_name || "—")} · ${KS.esc(s.data().email || "")}</option>`;
} else {
  searchUsers("").catch((e) => KS.toast(KS.errMsg(e), "error"));
}

KS.qs("#notif-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = KS.qs("#notif-title").value.trim();
  const body = KS.qs("#notif-body").value.trim();
  const userId = target.value === "one" ? userSel.value : null;
  if (!title || !body) return KS.toast("Indique o título e a mensagem.", "error");
  if (target.value === "one" && !userId) return KS.toast("Escolha o cliente.", "error");
  if (!(await KS.confirm("Enviar notificação", `Enviar "${title}" para ${userId ? "este cliente" : "TODOS os clientes"}?`, "Enviar"))) return;
  await KS.busy(KS.qs("#notif-send"), async () => {
    try {
      const ids = userId ? [userId] : (await users()).filter((u) => !u.is_blocked).map((u) => u.id);
      // Um batch aceita até 500 escritas: envia em blocos de 400
      for (let i = 0; i < ids.length; i += 400) {
        const b = KS.batch();
        ids.slice(i, i + 400).forEach((uid) => b.set(KS.newRef("notifications"), { user_id: uid, type: "general", title, body,
          order_id: null, is_read: false, created_by: KS.uid(), created_at: KS.now() }));
        if (i === 0) KS.audit(b, "notification.sent", "notifications", userId || "ALL", { title, recipients: ids.length });
        await b.commit();
      }
      KS.toast(`Notificação enviada a ${ids.length} destinatário(s).`, "success");
      KS.qs("#notif-title").value = ""; KS.qs("#notif-body").value = "";
      loadList();
    } catch (err) { KS.toast(KS.errMsg(err), "error"); }
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
  const body = KS.qs("#notif-body-list");
  try {
    let data = KS.rows(await getDocs(query(collection(KS.db, "notifications"), orderBy("created_at", "desc"), limit(150))));
    if (listType === "general") data = data.filter((n) => n.type === "general");
    if (listType === "auto") data = data.filter((n) => n.type !== "general");
    const us = await Promise.all(data.map((n) => KS.user(n.user_id)));
    body.innerHTML = data.length ? data.map((n, i) => `<tr>
      <td class="small nowrap">${KS.esc(KS.date(n.created_at))}</td>
      <td class="small">${KS.esc(us[i] ? us[i].full_name || us[i].email : "")}</td>
      <td><span class="tag">${KS.esc(TYPES[n.type] || n.type)}</span></td>
      <td>${KS.esc(n.title)}</td><td>${n.is_read ? "✓" : ""}</td></tr>`).join("") :
      '<tr><td colspan="5" class="empty">Sem notificações.</td></tr>';
  } catch (e) { body.innerHTML = `<tr><td colspan="5" class="empty">${KS.esc(KS.errMsg(e))}</td></tr>`; }
}
loadList();
