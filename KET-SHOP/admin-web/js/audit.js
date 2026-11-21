(async function () {
  "use strict";
  try { await KS.init("audit", "Auditoria"); } catch (e) { return; }
  const PAGE = 50;
  let offset = 0;
  let rows = [];

  KS.qs("#aud-entity").onchange = () => reload();
  KS.qs("#aud-search").addEventListener("input", KS.debounce(() => reload(), 350));
  KS.qs("#aud-refresh").onclick = () => reload();
  KS.qs("#aud-more").onclick = () => fetchPage();

  function reload() { offset = 0; rows = []; fetchPage(); }

  async function fetchPage() {
    let q = KS.sb.from("audit_logs").select("*,profiles!audit_logs_actor_id_fkey(full_name,email)")
      .order("created_at", { ascending: false }).range(offset, offset + PAGE - 1);
    const ent = KS.qs("#aud-entity").value;
    const s = KS.qs("#aud-search").value.replace(/[,()*%\\]/g, " ").trim();
    if (ent) q = q.eq("entity", ent);
    if (s) q = q.ilike("action", `%${s}%`);
    const { data, error } = await q;
    const body = KS.qs("#aud-body");
    if (error) { body.innerHTML = `<tr><td colspan="6" class="empty">${KS.esc(KS.errMsg(error))}</td></tr>`; return; }
    rows = rows.concat(data);
    offset += data.length;
    KS.qs("#aud-more").classList.toggle("hidden", data.length < PAGE);
    body.innerHTML = rows.length ? rows.map((r, i) => `<tr>
      <td class="small nowrap">${KS.esc(KS.date(r.created_at))}</td>
      <td class="small">${KS.esc(r.profiles ? r.profiles.full_name || r.profiles.email : (r.actor_id ? r.actor_id : "sistema"))}</td>
      <td><span class="tag">${KS.esc(r.action)}</span></td><td>${KS.esc(r.entity)}</td>
      <td class="small mono">${KS.esc((r.entity_id || "").slice(0, 36))}</td>
      <td class="right"><button class="btn btn-sm btn-ghost" data-i="${i}">Detalhes</button></td></tr>`).join("") :
      '<tr><td colspan="6" class="empty">Sem registos.</td></tr>';
    KS.qsa("[data-i]", body).forEach((b) => (b.onclick = () => {
      const r = rows[Number(b.dataset.i)];
      const pre = document.createElement("pre");
      pre.className = "json";
      pre.textContent = JSON.stringify(r.details, null, 2);
      KS.modal(r.action + " · " + r.entity, pre, { wide: true });
    }));
  }
  reload();
})();
