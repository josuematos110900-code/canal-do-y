(async function () {
  "use strict";
  try { await KS.init("settings", "Configurações"); } catch (e) { return; }

  // chave -> tipo
  const FIELDS = {
    store_name: "text", support_whatsapp: "text", support_email: "text", support_phone: "text", support_hours: "text",
    min_android_version: "int", announcement: "text", maintenance_mode: "bool", maintenance_message: "text",
    admin_order_alert_sound: "bool", terms_text: "text", privacy_text: "text",
  };
  const PRIVATE = ["admin_order_alert_sound"];
  let existing = {};

  async function load() {
    const { data, error } = await KS.sb.from("app_settings").select("*").order("key");
    if (error) return KS.toast(KS.errMsg(error), "error");
    existing = {};
    data.forEach((s) => (existing[s.key] = s));
    Object.keys(FIELDS).forEach((k) => {
      const el = KS.qs("#s-" + k);
      if (!el) return;
      const v = existing[k] ? existing[k].value : null;
      if (FIELDS[k] === "bool") el.checked = v === true;
      else el.value = v === null || v === undefined ? "" : String(v);
    });
    KS.qs("#set-raw").innerHTML = data.map((s) => `<tr><td class="mono">${KS.esc(s.key)}</td>
      <td class="small mono" style="max-width:420px;word-break:break-word">${KS.esc(JSON.stringify(s.value).slice(0, 300))}</td>
      <td>${s.is_public ? '<span class="tag on">sim</span>' : '<span class="tag">não</span>'}</td>
      <td class="small nowrap">${KS.esc(KS.date(s.updated_at))}</td></tr>`).join("");
  }

  KS.qs("#set-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const rows = [];
    for (const k of Object.keys(FIELDS)) {
      const el = KS.qs("#s-" + k);
      if (!el) continue;
      let v;
      if (FIELDS[k] === "bool") v = el.checked;
      else if (FIELDS[k] === "int") {
        v = parseInt(el.value || "1", 10);
        if (!(v >= 1)) return KS.toast("versionCode mínimo inválido.", "error");
      } else v = el.value.trim();
      if (k === "support_whatsapp" && v && !/^[0-9]{9,15}$/.test(v)) return KS.toast("WhatsApp: use só dígitos em formato internacional (ex.: 244XXXXXXXXX).", "error");
      if (k === "support_email" && v && !/^\S+@\S+\.\S+$/.test(v)) return KS.toast("E-mail de suporte inválido.", "error");
      const prev = existing[k] ? existing[k].value : undefined;
      if (JSON.stringify(prev) === JSON.stringify(v)) continue;
      rows.push({ key: k, value: v, is_public: existing[k] ? existing[k].is_public : !PRIVATE.includes(k),
        description: existing[k] ? existing[k].description : null });
    }
    if (!rows.length) return KS.toast("Sem alterações.");
    if (rows.some((r) => r.key === "maintenance_mode" && r.value === true) &&
        !(await KS.confirm("Modo de manutenção", "Os clientes deixam de conseguir criar encomendas até desactivar. Continuar?", "Activar", true))) return;
    await KS.busy(KS.qs("#set-save"), async () => {
      const { error } = await KS.sb.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) return KS.toast(KS.errMsg(error), "error");
      KS.toast(`${rows.length} definição(ões) guardada(s). A app recebe-as no próximo carregamento.`, "success");
      load();
    });
  });

  load();
})();
