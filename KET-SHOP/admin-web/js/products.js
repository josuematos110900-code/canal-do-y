(async function () {
  "use strict";
  try { await KS.init("products", "Produtos e preços"); } catch (e) { return; }

  let categories = [];
  let products = [];
  if (!KS.isAdmin) {
    KS.qs("#prod-readonly").classList.remove("hidden");
    KS.qsa(".admin-only").forEach((el) => el.classList.add("hidden"));
  }

  KS.qsa("#prod-tabs .tab").forEach((t) => {
    t.onclick = () => {
      KS.qsa("#prod-tabs .tab").forEach((x) => x.classList.toggle("active", x === t));
      KS.qs("#tab-products").classList.toggle("hidden", t.dataset.tab !== "products");
      KS.qs("#tab-categories").classList.toggle("hidden", t.dataset.tab !== "categories");
    };
  });
  KS.qs("#prod-search").addEventListener("input", KS.debounce(renderProducts, 200));
  KS.qs("#prod-cat-filter").onchange = renderProducts;
  KS.qs("#prod-new").onclick = () => editProduct(null);
  KS.qs("#cat-new").onclick = () => editCategory(null);

  async function loadAll() {
    const [c, p] = await Promise.all([
      KS.sb.from("product_categories").select("*").order("sort_order"),
      KS.sb.from("products").select("*,product_categories(name)").order("sort_order"),
    ]);
    if (c.error || p.error) return KS.toast(KS.errMsg(c.error || p.error), "error");
    categories = c.data; products = p.data;
    const sel = KS.qs("#prod-cat-filter");
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todas</option>' + categories.map((x) => `<option value="${KS.esc(x.id)}">${KS.esc(x.name)}</option>`).join("");
    sel.value = cur;
    renderProducts(); renderCategories();
  }

  function renderProducts() {
    const q = KS.qs("#prod-search").value.trim().toLowerCase();
    const cat = KS.qs("#prod-cat-filter").value;
    const rows = products.filter((p) => (!cat || p.category_id === cat) &&
      (!q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)));
    const body = KS.qs("#prod-body");
    if (!rows.length) { body.innerHTML = '<tr><td colspan="7" class="empty">Sem produtos.</td></tr>'; return; }
    body.innerHTML = rows.map((p) => `
      <tr>
        <td>${KS.esc(p.sort_order)}</td>
        <td><b>${KS.esc(p.name)}</b><div class="small muted mono">${KS.esc(p.sku || "")}</div></td>
        <td>${KS.esc(p.product_categories ? p.product_categories.name : "")}</td>
        <td class="small">${p.base_amount ? `${KS.esc(KS.num(p.base_amount))} + ${KS.esc(KS.num(p.bonus_amount))} = <b>${KS.esc(KS.num(p.total_amount))}</b>` : KS.esc(p.unit_label)}</td>
        <td class="right nowrap"><b>${KS.esc(KS.kz(p.price_kz))}</b></td>
        <td>${p.is_active ? '<span class="tag on">activo</span>' : '<span class="tag off">inactivo</span>'}
            ${p.is_on_demand ? '<span class="tag">encomenda</span>' : ""}${p.is_featured ? '<span class="tag">destaque</span>' : ""}</td>
        <td class="right nowrap">${KS.isAdmin ? `
          <button class="btn btn-sm btn-ghost" data-price="${KS.esc(p.id)}">Preço</button>
          <button class="btn btn-sm btn-outline" data-edit="${KS.esc(p.id)}">Editar</button>` : ""}</td>
      </tr>`).join("");
    KS.qsa("[data-edit]", body).forEach((b) => (b.onclick = () => editProduct(products.find((x) => x.id === b.dataset.edit))));
    KS.qsa("[data-price]", body).forEach((b) => (b.onclick = () => quickPrice(products.find((x) => x.id === b.dataset.price))));
  }

  async function quickPrice(p) {
    const v = await KS.prompt("Alterar preço — " + p.name, "Novo preço em Kz (actual: " + KS.kz(p.price_kz) + ")", { value: String(p.price_kz), required: true, max: 15 });
    if (v === null) return;
    const price = Number(v.replace(/\./g, "").replace(",", "."));
    if (!(price > 0)) return KS.toast("Preço inválido.", "error");
    const { error } = await KS.sb.from("products").update({ price_kz: price }).eq("id", p.id);
    if (error) return KS.toast(KS.errMsg(error), "error");
    KS.toast("Preço actualizado para " + KS.kz(price) + ".", "success");
    loadAll();
  }

  function editProduct(p) {
    const isNew = !p;
    p = p || { is_active: true, bonus_amount: 0, unit_label: "diamantes", game: "Free Fire", sort_order: products.length + 1 };
    const m = KS.modal(isNew ? "Novo produto" : "Editar produto", `
      <form id="pf" novalidate>
        <div class="form-grid">
          <div><label>Categoria</label><select name="category_id" required>${categories.map((c) =>
            `<option value="${KS.esc(c.id)}" ${c.id === p.category_id ? "selected" : ""}>${KS.esc(c.name)}</option>`).join("")}</select></div>
          <div><label>Nome</label><input name="name" maxlength="80" required value="${KS.esc(p.name || "")}"></div>
          <div><label>SKU (maiúsculas, números e -)</label><input name="sku" maxlength="40" value="${KS.esc(p.sku || "")}"></div>
          <div><label>Jogo</label><input name="game" maxlength="40" value="${KS.esc(p.game || "Free Fire")}"></div>
          <div><label>Quantidade base (vazio para passes)</label><input name="base_amount" type="number" min="0" step="1" value="${KS.esc(p.base_amount ?? "")}"></div>
          <div><label>Bónus</label><input name="bonus_amount" type="number" min="0" step="1" value="${KS.esc(p.bonus_amount ?? 0)}"></div>
          <div><label>Unidade</label><input name="unit_label" maxlength="20" value="${KS.esc(p.unit_label || "")}"></div>
          <div><label>Preço (Kz)</label><input name="price_kz" type="number" min="1" step="0.01" required value="${KS.esc(p.price_kz ?? "")}"></div>
          <div><label>Ordem</label><input name="sort_order" type="number" step="1" value="${KS.esc(p.sort_order ?? 0)}"></div>
          <div><label>URL da imagem (https, opcional)</label><input name="image_url" value="${KS.esc(p.image_url || "")}"></div>
        </div>
        <label>Descrição</label><textarea name="description" maxlength="600">${KS.esc(p.description || "")}</textarea>
        <label class="check"><input type="checkbox" name="is_active" ${p.is_active ? "checked" : ""}> Activo (visível na app)</label>
        <label class="check"><input type="checkbox" name="is_on_demand" ${p.is_on_demand ? "checked" : ""}> Exclusivamente por encomenda</label>
        <label class="check"><input type="checkbox" name="is_featured" ${p.is_featured ? "checked" : ""}> Destaque na Home</label>
        <div class="alert error hidden" id="pf-err"></div>
        <div class="form-actions">
          ${isNew ? "" : '<button type="button" class="btn btn-danger" id="pf-del">Eliminar</button>'}
          <span class="grow"></span>
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary" id="pf-save">Guardar</button>
        </div>
      </form>`, { wide: true });
    const f = KS.qs("#pf", m.body);
    const err = (msg) => { const e = KS.qs("#pf-err", m.body); e.textContent = msg; e.classList.remove("hidden"); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const rec = {
        category_id: fd.get("category_id"),
        name: fd.get("name").trim(),
        sku: fd.get("sku").trim().toUpperCase() || null,
        game: fd.get("game").trim() || "Free Fire",
        base_amount: fd.get("base_amount") === "" ? null : parseInt(fd.get("base_amount"), 10),
        bonus_amount: parseInt(fd.get("bonus_amount") || "0", 10),
        unit_label: fd.get("unit_label").trim() || "unidade",
        price_kz: Number(fd.get("price_kz")),
        sort_order: parseInt(fd.get("sort_order") || "0", 10),
        image_url: fd.get("image_url").trim() || null,
        description: fd.get("description").trim() || null,
        is_active: f.is_active.checked, is_on_demand: f.is_on_demand.checked, is_featured: f.is_featured.checked,
      };
      if (rec.name.length < 2) return err("Indique o nome do produto.");
      if (!(rec.price_kz > 0)) return err("O preço tem de ser maior que zero.");
      if (rec.sku && !/^[A-Z0-9-]{2,40}$/.test(rec.sku)) return err("SKU inválido (use A-Z, 0-9 e -).");
      if (rec.image_url && !/^https:\/\//.test(rec.image_url)) return err("O URL da imagem deve começar por https://");
      if (rec.base_amount !== null && (isNaN(rec.base_amount) || rec.base_amount < 0)) return err("Quantidade base inválida.");
      await KS.busy(KS.qs("#pf-save", m.body), async () => {
        const res = isNew ? await KS.sb.from("products").insert(rec) : await KS.sb.from("products").update(rec).eq("id", p.id);
        if (res.error) return err(KS.errMsg(res.error));
        KS.toast("Produto guardado.", "success"); m.close(); loadAll();
      });
    };
    const del = KS.qs("#pf-del", m.body);
    if (del) del.onclick = async () => {
      if (!(await KS.confirm("Eliminar produto", `Eliminar "${p.name}"? As encomendas antigas mantêm o nome e o preço. Em alternativa, pode apenas desactivá-lo.`, "Eliminar", true))) return;
      const { error } = await KS.sb.from("products").delete().eq("id", p.id);
      if (error) return err(KS.errMsg(error));
      KS.toast("Produto eliminado."); m.close(); loadAll();
    };
  }

  function renderCategories() {
    const body = KS.qs("#cat-body");
    if (!categories.length) { body.innerHTML = '<tr><td colspan="6" class="empty">Sem categorias.</td></tr>'; return; }
    body.innerHTML = categories.map((c) => `<tr>
      <td>${KS.esc(c.sort_order)}</td><td><b>${KS.esc(c.name)}</b><div class="small muted">${KS.esc(c.description || "")}</div></td>
      <td class="mono">${KS.esc(c.slug)}</td><td>${KS.esc(c.game)}</td>
      <td>${c.is_active ? '<span class="tag on">activa</span>' : '<span class="tag off">inactiva</span>'}</td>
      <td class="right">${KS.isAdmin ? `<button class="btn btn-sm btn-outline" data-cat="${KS.esc(c.id)}">Editar</button>` : ""}</td></tr>`).join("");
    KS.qsa("[data-cat]", body).forEach((b) => (b.onclick = () => editCategory(categories.find((x) => x.id === b.dataset.cat))));
  }

  function editCategory(c) {
    const isNew = !c;
    c = c || { is_active: true, game: "Free Fire", sort_order: categories.length + 1 };
    const m = KS.modal(isNew ? "Nova categoria" : "Editar categoria", `
      <form id="cf" novalidate><div class="form-grid">
        <div><label>Nome</label><input name="name" maxlength="60" value="${KS.esc(c.name || "")}"></div>
        <div><label>Slug (a-z, 0-9, -)</label><input name="slug" maxlength="40" value="${KS.esc(c.slug || "")}"></div>
        <div><label>Jogo</label><input name="game" maxlength="40" value="${KS.esc(c.game || "")}"></div>
        <div><label>Ordem</label><input name="sort_order" type="number" value="${KS.esc(c.sort_order ?? 0)}"></div></div>
        <label>Descrição</label><textarea name="description" maxlength="300">${KS.esc(c.description || "")}</textarea>
        <label class="check"><input type="checkbox" name="is_active" ${c.is_active ? "checked" : ""}> Activa</label>
        <div class="alert error hidden" id="cf-err"></div>
        <div class="form-actions">${isNew ? "" : '<button type="button" class="btn btn-danger" id="cf-del">Eliminar</button>'}<span class="grow"></span>
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="cf-save" type="submit">Guardar</button></div></form>`);
    const f = KS.qs("#cf", m.body);
    const err = (msg) => { const e = KS.qs("#cf-err", m.body); e.textContent = msg; e.classList.remove("hidden"); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const rec = { name: fd.get("name").trim(), slug: fd.get("slug").trim().toLowerCase(), game: fd.get("game").trim() || "Free Fire",
        sort_order: parseInt(fd.get("sort_order") || "0", 10), description: fd.get("description").trim() || null, is_active: f.is_active.checked };
      if (rec.name.length < 2) return err("Indique o nome.");
      if (!/^[a-z0-9-]{2,40}$/.test(rec.slug)) return err("Slug inválido.");
      await KS.busy(KS.qs("#cf-save", m.body), async () => {
        const res = isNew ? await KS.sb.from("product_categories").insert(rec) : await KS.sb.from("product_categories").update(rec).eq("id", c.id);
        if (res.error) return err(KS.errMsg(res.error));
        KS.toast("Categoria guardada.", "success"); m.close(); loadAll();
      });
    };
    const del = KS.qs("#cf-del", m.body);
    if (del) del.onclick = async () => {
      if (!(await KS.confirm("Eliminar categoria", "Só é possível eliminar categorias sem produtos.", "Eliminar", true))) return;
      const { error } = await KS.sb.from("product_categories").delete().eq("id", c.id);
      if (error) return err(/foreign key/i.test(error.message) ? "A categoria tem produtos associados. Mova ou elimine os produtos primeiro." : KS.errMsg(error));
      m.close(); loadAll();
    };
  }

  loadAll();
})();
