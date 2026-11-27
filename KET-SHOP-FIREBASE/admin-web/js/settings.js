import { KS, FS } from "./core.js";
import { SEED } from "./seed-data.js";
const { doc, getDoc, setDoc } = FS;

await KS.init("settings", "Configurações");

// campo -> [documento, tipo]
const FIELDS = {
  store_name: ["public", "text"], support_whatsapp: ["public", "text"], support_email: ["public", "text"],
  support_phone: ["public", "text"], support_hours: ["public", "text"], min_android_version: ["public", "int"],
  announcement: ["public", "text"], maintenance_mode: ["public", "bool"], maintenance_message: ["public", "text"],
  terms_text: ["public", "text"], privacy_text: ["public", "text"], admin_order_alert_sound: ["private", "bool"],
};
let current = { public: {}, private: {} };

// Botão "Carregar catálogo inicial" (cria apenas o que não existe)
const seedCard = document.createElement("div");
seedCard.className = "card";
seedCard.innerHTML = `<div class="card-header"><h2>Catálogo inicial</h2></div>
  <p class="muted">Cria as categorias, os 13 produtos Free Fire com os preços iniciais, os 4 métodos de pagamento
  (inactivos e sem dados bancários) e as definições por omissão. Registos já existentes <b>não</b> são alterados.</p>
  <div class="form-actions"><button class="btn btn-outline" id="seed-btn">Carregar catálogo inicial</button></div>`;
KS.qs("#set-form").before(seedCard);
KS.qs("#seed-btn").onclick = (e) => KS.busy(e.currentTarget, async () => {
  if (!(await KS.confirm("Carregar catálogo inicial", "Criar os dados iniciais que ainda não existem?", "Carregar"))) return;
  try {
    let created = 0;
    const b = KS.batch();
    const add = async (col, item, extra) => {
      const { id, ...data } = item;
      const ref = doc(KS.db, col, id);
      if (!(await getDoc(ref)).exists()) { b.set(ref, Object.assign(data, extra || {})); created++; }
    };
    for (const c of SEED.categories) await add("categories", c, { updated_at: KS.now() });
    await b.commit(); // as regras dos produtos exigem que a categoria já exista
    const b2 = KS.batch();
    let created2 = 0;
    const add2 = async (col, item, extra) => {
      const { id, ...data } = item;
      const ref = doc(KS.db, col, id);
      if (!(await getDoc(ref)).exists()) { b2.set(ref, Object.assign(data, extra || {})); created2++; }
    };
    for (const p of SEED.products) await add2("products", p, { created_at: KS.now(), updated_at: KS.now() });
    for (const m of SEED.paymentMethods) await add2("paymentMethods", m, { created_at: KS.now(), updated_at: KS.now() });
    for (const [id, data] of [["public", SEED.settingsPublic], ["private", SEED.settingsPrivate]]) {
      const ref = doc(KS.db, "settings", id);
      if (!(await getDoc(ref)).exists()) { b2.set(ref, Object.assign({}, data, { updated_at: KS.now() })); created2++; }
    }
    KS.audit(b2, "catalog.seeded", "products", null, { created: created + created2 });
    await b2.commit();
    KS.toast(`${created + created2} registo(s) criado(s).`, "success");
    load();
  } catch (err) { KS.toast(KS.errMsg(err), "error"); }
});

async function load() {
  try {
    const [pub, priv] = await Promise.all([getDoc(doc(KS.db, "settings", "public")), getDoc(doc(KS.db, "settings", "private"))]);
    current = { public: pub.exists() ? pub.data() : {}, private: priv.exists() ? priv.data() : {} };
  } catch (e) { return KS.toast(KS.errMsg(e), "error"); }
  Object.keys(FIELDS).forEach((k) => {
    const el = KS.qs("#s-" + k);
    if (!el) return;
    const v = current[FIELDS[k][0]][k];
    if (FIELDS[k][1] === "bool") el.checked = k === "admin_order_alert_sound" ? v !== false : v === true;
    else el.value = v === null || v === undefined ? "" : String(v);
  });
  const rows = [];
  ["public", "private"].forEach((d) => Object.keys(current[d]).sort().forEach((k) => {
    if (k === "updated_at") return;
    rows.push(`<tr><td class="mono">${KS.esc(k)}</td>
      <td class="small mono" style="max-width:420px;word-break:break-word">${KS.esc(JSON.stringify(current[d][k]).slice(0, 300))}</td>
      <td>${d === "public" ? '<span class="tag on">sim</span>' : '<span class="tag">não</span>'}</td>
      <td class="small nowrap">${KS.esc(KS.date(current[d].updated_at))}</td></tr>`);
  }));
  KS.qs("#set-raw").innerHTML = rows.join("") || '<tr><td colspan="4" class="empty">Ainda sem definições. Use "Carregar catálogo inicial".</td></tr>';
}

KS.qs("#set-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const changes = { public: {}, private: {} };
  let n = 0;
  for (const k of Object.keys(FIELDS)) {
    const el = KS.qs("#s-" + k);
    if (!el) continue;
    const [d, type] = FIELDS[k];
    let v;
    if (type === "bool") v = el.checked;
    else if (type === "int") { v = parseInt(el.value || "1", 10); if (!(v >= 1)) return KS.toast("versionCode mínimo inválido.", "error"); }
    else v = el.value.trim();
    if (k === "support_whatsapp" && v && !/^[0-9]{9,15}$/.test(v)) return KS.toast("WhatsApp: use só dígitos em formato internacional (ex.: 244XXXXXXXXX).", "error");
    if (k === "support_email" && v && !/^\S+@\S+\.\S+$/.test(v)) return KS.toast("E-mail de suporte inválido.", "error");
    if (JSON.stringify(current[d][k]) === JSON.stringify(v)) continue;
    changes[d][k] = v; n++;
  }
  if (!n) return KS.toast("Sem alterações.");
  if (changes.public.maintenance_mode === true &&
      !(await KS.confirm("Modo de manutenção", "Os clientes deixam de conseguir criar encomendas até desactivar. Continuar?", "Activar", true))) return;
  await KS.busy(KS.qs("#set-save"), async () => {
    try {
      const b = KS.batch();
      ["public", "private"].forEach((d) => {
        if (Object.keys(changes[d]).length) b.set(doc(KS.db, "settings", d), Object.assign({}, changes[d], { updated_at: KS.now() }), { merge: true });
      });
      KS.audit(b, "settings.updated", "settings", null, changes);
      await b.commit();
      KS.toast(`${n} definição(ões) guardada(s). A app recebe-as no próximo carregamento.`, "success");
      load();
    } catch (err) { KS.toast(KS.errMsg(err), "error"); }
  });
});

load();
