import { KS, FS } from "./core.js";
const { collection, getDocs, doc } = FS;

await KS.init("payments", "Métodos de pagamento");
let methods = [];
if (!KS.isAdmin) KS.qsa(".admin-only").forEach((el) => el.classList.add("hidden"));
KS.qs("#pm-new").onclick = () => edit(null);

async function load() {
  try {
    methods = KS.rows(await getDocs(collection(KS.db, "paymentMethods"))).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    render();
  } catch (e) { KS.qs("#pm-body").innerHTML = `<tr><td colspan="6" class="empty">${KS.esc(KS.errMsg(e))}</td></tr>`; }
}

function summary(m) {
  const parts = [];
  if (m.iban) parts.push("IBAN " + m.iban);
  if (m.phone_number) parts.push("Nº " + m.phone_number);
  if (m.entity) parts.push("Ent. " + m.entity);
  if (m.reference) parts.push("Ref. " + m.reference);
  if (m.account_number) parts.push("Conta " + m.account_number);
  return parts.length ? parts.join(" · ") : null;
}

function render() {
  const body = KS.qs("#pm-body");
  if (!methods.length) { body.innerHTML = '<tr><td colspan="6" class="empty">Nenhum método configurado. Use Configurações → Carregar catálogo inicial, ou "Novo método".</td></tr>'; return; }
  body.innerHTML = methods.map((m) => {
    const s = summary(m);
    return `<tr><td>${KS.esc(m.sort_order)}</td><td><b>${KS.esc(m.name)}</b><div class="small muted">${KS.esc(m.account_holder || "")}</div></td>
      <td>${KS.esc(KS.PM_TYPES[m.type] || m.type)}</td>
      <td class="small mono">${s ? KS.esc(s) : '<span style="color:var(--warning)">Sem dados — preencher antes de activar</span>'}</td>
      <td>${m.is_active ? '<span class="tag on">activo</span>' : '<span class="tag off">inactivo</span>'}</td>
      <td class="right nowrap">${KS.isAdmin ? `<button class="btn btn-sm btn-ghost" data-toggle="${KS.esc(m.id)}">${m.is_active ? "Desactivar" : "Activar"}</button>
        <button class="btn btn-sm btn-outline" data-edit="${KS.esc(m.id)}">Editar</button>` : ""}</td></tr>`;
  }).join("");
  KS.qsa("[data-edit]", body).forEach((b) => (b.onclick = () => edit(methods.find((x) => x.id === b.dataset.edit))));
  KS.qsa("[data-toggle]", body).forEach((b) => (b.onclick = () => toggle(methods.find((x) => x.id === b.dataset.toggle))));
}

async function save(id, rec, isNew) {
  const b = KS.batch();
  const ref = isNew ? KS.newRef("paymentMethods") : doc(KS.db, "paymentMethods", id);
  if (isNew) b.set(ref, Object.assign({}, rec, { created_at: KS.now(), updated_at: KS.now() }));
  else b.update(ref, Object.assign({}, rec, { updated_at: KS.now() }));
  KS.audit(b, isNew ? "payment_method.created" : "payment_method.updated", "paymentMethods", ref.id, rec);
  await b.commit();
}

async function toggle(m) {
  if (!m.is_active && !summary(m)) return KS.toast("Preencha os dados de pagamento antes de activar este método.", "error");
  try {
    await save(m.id, { is_active: !m.is_active }, false);
    KS.toast(m.is_active ? "Método desactivado." : "Método activado: já aparece na app.", "success");
    load();
  } catch (e) { KS.toast(KS.errMsg(e), "error"); }
}

function edit(m) {
  const isNew = !m;
  m = m || { type: "bank_transfer", is_active: false, sort_order: methods.length + 1 };
  const md = KS.modal(isNew ? "Novo método de pagamento" : "Editar " + m.name, `
    <form id="mf" novalidate><div class="form-grid">
      <div><label>Tipo</label><select name="type">${Object.keys(KS.PM_TYPES).map((t) =>
        `<option value="${t}" ${t === m.type ? "selected" : ""}>${KS.esc(KS.PM_TYPES[t])}</option>`).join("")}</select></div>
      <div><label>Nome mostrado na app</label><input name="name" maxlength="60" value="${KS.esc(m.name || "")}"></div>
      <div><label>Titular</label><input name="account_holder" maxlength="120" value="${KS.esc(m.account_holder || "")}"></div>
      <div><label>Banco</label><input name="bank_name" maxlength="80" value="${KS.esc(m.bank_name || "")}"></div>
      <div><label>IBAN</label><input name="iban" maxlength="50" placeholder="AO06 ..." value="${KS.esc(m.iban || "")}"></div>
      <div><label>Número de conta</label><input name="account_number" maxlength="40" value="${KS.esc(m.account_number || "")}"></div>
      <div><label>Telefone (Multicaixa Express / PayPay)</label><input name="phone_number" maxlength="20" value="${KS.esc(m.phone_number || "")}"></div>
      <div><label>Entidade</label><input name="entity" maxlength="20" value="${KS.esc(m.entity || "")}"></div>
      <div><label>Referência</label><input name="reference" maxlength="40" value="${KS.esc(m.reference || "")}"></div>
      <div><label>Ordem</label><input name="sort_order" type="number" value="${KS.esc(m.sort_order ?? 0)}"></div></div>
      <label>Descrição curta</label><input name="description" maxlength="300" value="${KS.esc(m.description || "")}">
      <label>Instruções para o cliente</label><textarea name="instructions" maxlength="2000">${KS.esc(m.instructions || "")}</textarea>
      <label class="check"><input type="checkbox" name="is_active" ${m.is_active ? "checked" : ""}> Activo (visível na app)</label>
      <div class="alert error hidden" id="mf-err"></div>
      <div class="form-actions">${isNew ? "" : '<button type="button" class="btn btn-danger" id="mf-del">Eliminar</button>'}<span class="grow"></span>
        <button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="mf-save" type="submit">Guardar</button></div></form>`, { wide: true });
  const f = KS.qs("#mf", md.body);
  const err = (msg) => { const e = KS.qs("#mf-err", md.body); e.textContent = msg; e.classList.remove("hidden"); };
  const val = (n) => { const v = (new FormData(f).get(n) || "").trim(); return v === "" ? null : v; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const rec = {
      type: val("type"), name: val("name"), account_holder: val("account_holder"), bank_name: val("bank_name"),
      iban: val("iban") ? val("iban").toUpperCase().replace(/\s+/g, " ") : null, account_number: val("account_number"),
      phone_number: val("phone_number"), entity: val("entity"), reference: val("reference"),
      sort_order: parseInt(val("sort_order") || "0", 10), description: val("description"), instructions: val("instructions"),
      is_active: f.is_active.checked,
    };
    if (!rec.name || rec.name.length < 2) return err("Indique o nome do método.");
    if (rec.iban && !/^[A-Z]{2}[0-9]{2}[0-9A-Z ]{10,40}$/.test(rec.iban)) return err("IBAN com formato inválido.");
    if (rec.phone_number && !/^\+?[0-9 ]{7,20}$/.test(rec.phone_number)) return err("Telefone inválido.");
    if (rec.is_active && !(rec.iban || rec.phone_number || rec.reference || rec.account_number || rec.entity))
      return err("Para activar, preencha pelo menos um dado de pagamento (IBAN, telefone, entidade/referência ou conta).");
    await KS.busy(KS.qs("#mf-save", md.body), async () => {
      try { await save(m.id, rec, isNew); KS.toast("Método guardado.", "success"); md.close(); load(); }
      catch (e2) { err(KS.errMsg(e2)); }
    });
  };
  const del = KS.qs("#mf-del", md.body);
  if (del) del.onclick = async () => {
    if (!(await KS.confirm("Eliminar método", "As encomendas antigas mantêm uma cópia dos dados usados. Prefira desactivar se não tiver a certeza.", "Eliminar", true))) return;
    try {
      const b = KS.batch(); b.delete(doc(KS.db, "paymentMethods", m.id));
      KS.audit(b, "payment_method.deleted", "paymentMethods", m.id, { name: m.name }); await b.commit();
      md.close(); load();
    } catch (e) { err(KS.errMsg(e)); }
  };
}

load();
