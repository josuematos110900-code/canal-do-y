/* =====================================================================
   KET SHOP — núcleo do painel (autenticação, layout, utilitários)
   A segurança real está no Supabase (RLS + funções SQL). Esconder
   botões aqui é apenas conveniência de interface.
   ===================================================================== */
(function () {
  "use strict";

  const CFG = window.KETSHOP_CONFIG || {};
  const KS = (window.KS = {});

  KS.configured =
    typeof CFG.SUPABASE_URL === "string" &&
    CFG.SUPABASE_URL.startsWith("https://") &&
    !CFG.SUPABASE_URL.includes("SEU-PROJECTO") &&
    typeof CFG.SUPABASE_ANON_KEY === "string" &&
    !CFG.SUPABASE_ANON_KEY.startsWith("COLE_");

  KS.sb = KS.configured && window.supabase
    ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

  KS.BUCKET = CFG.PROOF_BUCKET || "payment-proofs";

  // ------------------------------------------------------------------ Estados
  KS.STATUS = {
    pending_payment: "Pendente de pagamento",
    proof_submitted: "Comprovativo enviado",
    under_review: "Em verificação",
    payment_approved: "Pagamento aprovado",
    payment_rejected: "Pagamento rejeitado",
    processing: "Em processamento",
    completed: "Concluída",
    cancelled: "Cancelada",
  };
  // Transições permitidas (iguais às de admin_update_order_status no SQL)
  KS.TRANSITIONS = {
    pending_payment: ["under_review", "cancelled"],
    proof_submitted: ["under_review", "payment_approved", "payment_rejected", "cancelled"],
    under_review: ["payment_approved", "payment_rejected", "cancelled"],
    payment_approved: ["processing", "completed", "cancelled"],
    payment_rejected: ["under_review", "cancelled"],
    processing: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  KS.PM_TYPES = {
    bank_transfer: "Transferência bancária / IBAN",
    multicaixa_express: "Multicaixa Express",
    paypay: "PayPay AO",
    reference: "Pagamento por referência",
  };

  // ------------------------------------------------------------------ Ícones
  const ICONS = {
    dashboard: "M3,13h8V3H3V13zM3,21h8v-6H3V21zM13,21h8V11h-8V21zM13,3v6h8V3H13z",
    orders: "M18,17H6v-2h12v2zM18,13H6v-2h12v2zM18,9H6V7h12v2zM3,22l1.5,-1.5L6,22l1.5,-1.5L9,22l1.5,-1.5L12,22l1.5,-1.5L15,22l1.5,-1.5L18,22l1.5,-1.5L21,22V2l-1.5,1.5L18,2l-1.5,1.5L15,2l-1.5,1.5L12,2l-1.5,1.5L9,2 7.5,3.5 6,2 4.5,3.5 3,2v20z",
    products: "M6,3h12l4,6 -10,13L2,9 6,3z",
    customers: "M16,11c1.66,0 2.99,-1.34 2.99,-3S17.66,5 16,5c-1.66,0 -3,1.34 -3,3s1.34,3 3,3zM8,11c1.66,0 2.99,-1.34 2.99,-3S9.66,5 8,5C6.34,5 5,6.34 5,8s1.34,3 3,3zM8,13c-2.33,0 -7,1.17 -7,3.5V19h14v-2.5c0,-2.33 -4.67,-3.5 -7,-3.5zM16,13c-0.29,0 -0.62,0.02 -0.97,0.05 1.16,0.84 1.97,1.97 1.97,3.45V19h6v-2.5c0,-2.33 -4.67,-3.5 -7,-3.5z",
    payments: "M20,4H4c-1.11,0 -1.99,0.89 -1.99,2L2,18c0,1.11 0.89,2 2,2h16c1.11,0 2,-0.89 2,-2V6c0,-1.11 -0.89,-2 -2,-2zM20,18H4v-6h16v6zM20,8H4V6h16v2z",
    notifications: "M12,22c1.1,0 2,-0.9 2,-2h-4c0,1.1 0.89,2 2,2zM18,16v-5c0,-3.07 -1.64,-5.64 -4.5,-6.32V4c0,-0.83 -0.67,-1.5 -1.5,-1.5s-1.5,0.67 -1.5,1.5v0.68C7.63,5.36 6,7.92 6,11v5l-2,2v1h16v-1l-2,-2z",
    reports: "M19,3H5c-1.1,0 -2,0.9 -2,2v14c0,1.1 0.9,2 2,2h14c1.1,0 2,-0.9 2,-2V5c0,-1.1 -0.9,-2 -2,-2zM9,17H7v-7h2v7zM13,17h-2V7h2v10zM17,17h-2v-4h2v4z",
    settings: "M19.14,12.94c0.04,-0.3 0.06,-0.61 0.06,-0.94c0,-0.32 -0.02,-0.64 -0.07,-0.94l2.03,-1.58c0.18,-0.14 0.23,-0.41 0.12,-0.61l-1.92,-3.32c-0.12,-0.22 -0.37,-0.29 -0.59,-0.22l-2.39,0.96c-0.5,-0.38 -1.03,-0.7 -1.62,-0.94L14.4,2.81c-0.04,-0.24 -0.24,-0.41 -0.48,-0.41h-3.84c-0.24,0 -0.43,0.17 -0.47,0.41L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33c-0.22,-0.08 -0.47,0 -0.59,0.22L2.74,8.87C2.62,9.08 2.66,9.34 2.86,9.48l2.03,1.58C4.84,11.36 4.8,11.69 4.8,12s0.02,0.64 0.07,0.94l-2.03,1.58c-0.18,0.14 -0.23,0.41 -0.12,0.61l1.92,3.32c0.12,0.22 0.37,0.29 0.59,0.22l2.39,-0.96c0.5,0.38 1.03,0.7 1.62,0.94l0.36,2.54c0.05,0.24 0.24,0.41 0.48,0.41h3.84c0.24,0 0.44,-0.17 0.47,-0.41l0.36,-2.54c0.59,-0.24 1.13,-0.56 1.62,-0.94l2.39,0.96c0.22,0.08 0.47,0 0.59,-0.22l1.92,-3.32c0.12,-0.22 0.07,-0.47 -0.12,-0.61L19.14,12.94zM12,15.6c-1.98,0 -3.6,-1.62 -3.6,-3.6s1.62,-3.6 3.6,-3.6s3.6,1.62 3.6,3.6S13.98,15.6 12,15.6z",
    audit: "M12,1L3,5v6c0,5.55 3.84,10.74 9,12 5.16,-1.26 9,-6.45 9,-12V5l-9,-4zM10,17l-4,-4 1.41,-1.41L10,14.17l6.59,-6.59L18,9l-8,8z",
    menu: "M3,18h18v-2H3v2zM3,13h18v-2H3v2zM3,6v2h18V6H3z",
    logout: "M17,7l-1.41,1.41L18.17,11H8v2h10.17l-2.58,2.58L17,17l5,-5zM4,5h8V3H4c-1.1,0 -2,0.9 -2,2v14c0,1.1 0.9,2 2,2h8v-2H4V5z",
    close: "M19,6.41L17.59,5 12,10.59 6.41,5 5,6.41 10.59,12 5,17.59 6.41,19 12,13.41 17.59,19 19,17.59 13.41,12z",
    refresh: "M17.65,6.35C16.2,4.9 14.21,4 12,4c-4.42,0 -7.99,3.58 -7.99,8s3.57,8 7.99,8c3.73,0 6.84,-2.55 7.73,-6h-2.08c-0.82,2.33 -3.04,4 -5.65,4 -3.31,0 -6,-2.69 -6,-6s2.69,-6 6,-6c1.66,0 3.14,0.69 4.22,1.78L13,11h7V4l-2.35,2.35z",
    plus: "M19,13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
    download: "M19,9h-4V3H9v6H5l7,7 7,-7zM5,18v2h14v-2H5z",
  };
  KS.icon = (name) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;

  const NAV = [
    { key: "dashboard", href: "dashboard.html", label: "Dashboard" },
    { key: "orders", href: "orders.html", label: "Encomendas", badge: true },
    { key: "products", href: "products.html", label: "Produtos e preços" },
    { key: "customers", href: "customers.html", label: "Clientes" },
    { key: "payments", href: "payments.html", label: "Métodos de pagamento" },
    { key: "notifications", href: "notifications.html", label: "Notificações" },
    { key: "reports", href: "reports.html", label: "Relatórios" },
    { key: "settings", href: "settings.html", label: "Configurações", adminOnly: true },
    { key: "audit", href: "audit.html", label: "Auditoria", adminOnly: true },
  ];

  // ------------------------------------------------------------- Utilitários
  KS.esc = function (v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };
  /** Agrupa milhares com "." e decimais com "," (formato usado em Angola: 1.050 Kz). */
  function groupNum(n, decimals) {
    const fixed = Math.abs(n).toFixed(decimals);
    const parts = fixed.split(".");
    const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (n < 0 ? "-" : "") + int + (decimals ? "," + parts[1] : "");
  }
  KS.num = (v) => groupNum(Math.round(Number(v || 0)), 0);
  KS.kz = (v) => {
    const n = Number(v || 0);
    return groupNum(n, Math.abs(n - Math.round(n)) < 0.005 ? 0 : 2) + " Kz";
  };
  KS.date = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  KS.day = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-PT") : "");
  KS.statusPill = (s) => `<span class="pill st-${KS.esc(s)}">${KS.esc(KS.STATUS[s] || s)}</span>`;
  KS.debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 300); };
  };
  KS.qs = (sel, root) => (root || document).querySelector(sel);
  KS.qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** Converte erros do Supabase em mensagens legíveis. */
  KS.errMsg = function (err) {
    if (!err) return "Erro desconhecido.";
    const raw = err.message || err.error_description || err.msg || String(err);
    const m = raw.match(/^([A-Z_]{3,40}):\s*(.+)$/);
    if (m) return m[2].charAt(0).toUpperCase() + m[2].slice(1);
    if (/row-level security|permission denied/i.test(raw)) return "Sem permissão para esta operação (apenas administradores).";
    if (/Invalid login credentials/i.test(raw)) return "E-mail ou palavra-passe incorrectos.";
    if (/Email not confirmed/i.test(raw)) return "E-mail ainda não confirmado.";
    if (/Failed to fetch|NetworkError/i.test(raw)) return "Sem ligação ao servidor. Verifique a Internet e o config.js.";
    if (/duplicate key/i.test(raw)) return "Já existe um registo com esse identificador.";
    if (/violates check constraint/i.test(raw)) return "Algum valor não cumpre as regras de validação (verifique formatos e limites).";
    if (/JWT expired/i.test(raw)) return "Sessão expirada. Inicie sessão novamente.";
    return raw;
  };

  KS.toast = function (msg, type) {
    let root = document.getElementById("toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "toast-root";
      document.body.appendChild(root);
    }
    const el = document.createElement("div");
    el.className = "toast " + (type || "");
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; }, 4200);
    setTimeout(() => el.remove(), 4600);
  };

  /** Abre um modal. `content` é HTML (já escapado) ou um Element. Devolve {el, close}. */
  KS.modal = function (title, content, opts) {
    opts = opts || {};
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML =
      `<div class="modal ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true">
         <div class="modal-header"><h2></h2>
           <button class="btn btn-ghost btn-icon" data-close aria-label="Fechar">${KS.icon("close")}</button>
         </div>
         <div class="modal-body"></div>
       </div>`;
    back.querySelector("h2").textContent = title;
    const body = back.querySelector(".modal-body");
    if (typeof content === "string") body.innerHTML = content; else if (content) body.appendChild(content);
    const close = () => { back.remove(); document.removeEventListener("keydown", onKey); if (opts.onClose) opts.onClose(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    back.addEventListener("click", (e) => { if (e.target === back || e.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);
    return { el: back.querySelector(".modal"), body, close };
  };

  KS.confirm = function (title, message, okLabel, danger) {
    return new Promise((resolve) => {
      const m = KS.modal(title,
        `<p class="muted"></p>
         <div class="form-actions">
           <button class="btn btn-ghost" data-act="no">Cancelar</button>
           <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="yes"></button>
         </div>`, { onClose: () => resolve(false) });
      m.body.querySelector("p").textContent = message;
      m.body.querySelector('[data-act="yes"]').textContent = okLabel || "Confirmar";
      m.body.querySelector('[data-act="no"]').onclick = () => m.close();
      m.body.querySelector('[data-act="yes"]').onclick = () => { resolve(true); m.close(); };
    });
  };

  /** Pede um texto (ex.: motivo de rejeição). Devolve null se cancelado. */
  KS.prompt = function (title, label, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let done = false;
      const m = KS.modal(title,
        `<label></label><textarea maxlength="${opts.max || 500}"></textarea>
         <div class="field-error hidden">Campo obrigatório.</div>
         <div class="form-actions">
           <button class="btn btn-ghost" data-act="no">Cancelar</button>
           <button class="btn ${opts.danger ? "btn-danger" : "btn-primary"}" data-act="yes"></button>
         </div>`, { onClose: () => { if (!done) resolve(null); } });
      m.body.querySelector("label").textContent = label;
      const ta = m.body.querySelector("textarea");
      if (opts.value) ta.value = opts.value;
      m.body.querySelector('[data-act="yes"]').textContent = opts.okLabel || "Confirmar";
      m.body.querySelector('[data-act="no"]').onclick = () => m.close();
      m.body.querySelector('[data-act="yes"]').onclick = () => {
        const v = ta.value.trim();
        if (opts.required && !v) { m.body.querySelector(".field-error").classList.remove("hidden"); return; }
        done = true; resolve(v); m.close();
      };
      setTimeout(() => ta.focus(), 50);
    });
  };

  KS.downloadCSV = function (filename, rows) {
    const csv = rows.map((r) => r.map((c) => {
      const s = c === null || c === undefined ? "" : String(c);
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  /** Botão com estado de carregamento. */
  KS.busy = async function (btn, fn) {
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span>';
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = label; }
  };

  /** Som curto (Web Audio) para novas encomendas. */
  KS.beep = function () {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.06;
      o.connect(g); g.connect(ctx.destination); o.start();
      o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      o.stop(ctx.currentTime + 0.25);
    } catch (e) { /* sem áudio */ }
  };

  // ---------------------------------------------------------- Autenticação
  KS.session = null;
  KS.roles = [];
  KS.isAdmin = false;

  function configError() {
    document.body.innerHTML =
      `<div class="auth-page"><div class="card auth-card">
         <img class="logo" src="assets/logo.svg" alt="">
         <h1>KET SHOP</h1>
         <div class="alert warning">O painel ainda não está configurado.<br>
         Edite <b>admin-web/js/config.js</b> com o <i>Project URL</i> e a chave <i>anon public</i> do Supabase
         (ver documentation/ADMIN_DEPLOYMENT.md).</div>
       </div></div>`;
  }

  /**
   * Inicializa uma página protegida: exige sessão e papel admin/operator.
   * @returns {Promise<{user, roles, isAdmin}>}
   */
  KS.init = async function (pageKey, title) {
    if (!KS.sb) { configError(); throw new Error("not configured"); }
    const { data } = await KS.sb.auth.getSession();
    if (!data.session) {
      location.replace("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop()));
      throw new Error("no session");
    }
    KS.session = data.session;
    const { data: roles, error } = await KS.sb.rpc("my_roles");
    if (error) {
      renderShell(pageKey, title);
      KS.toast(KS.errMsg(error), "error");
      throw error;
    }
    KS.roles = roles || [];
    KS.isAdmin = KS.roles.includes("admin");
    const isStaff = KS.isAdmin || KS.roles.includes("operator");
    if (!isStaff) {
      await KS.sb.auth.signOut();
      location.replace("login.html?error=forbidden");
      throw new Error("forbidden");
    }
    const navItem = NAV.find((n) => n.key === pageKey);
    if (navItem && navItem.adminOnly && !KS.isAdmin) {
      location.replace("dashboard.html");
      throw new Error("admin only");
    }
    renderShell(pageKey, title);
    KS.sb.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_OUT") location.replace("login.html"); });
    refreshPendingBadge();
    setInterval(refreshPendingBadge, 60000);
    document.body.classList.add("ready");
    return { user: data.session.user, roles: KS.roles, isAdmin: KS.isAdmin };
  };

  function renderShell(pageKey, title) {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      const links = NAV.filter((n) => !n.adminOnly || KS.isAdmin).map((n) =>
        `<a class="nav-link ${n.key === pageKey ? "active" : ""}" href="${n.href}">
           ${KS.icon(n.key)}<span>${KS.esc(n.label)}</span>
           ${n.badge ? '<span class="badge hidden" id="nav-pending-badge"></span>' : ""}
         </a>`).join("");
      sidebar.innerHTML =
        `<div class="brand"><img src="assets/logo.svg" alt=""><strong>KET SHOP</strong></div>
         ${links}
         <div class="spacer"></div>
         <button class="nav-link btn-ghost" id="logout-btn" style="border:0;background:none;cursor:pointer;font:inherit;text-align:left">
           ${KS.icon("logout")}<span>Terminar sessão</span></button>`;
      KS.qs("#logout-btn").onclick = async () => { await KS.sb.auth.signOut(); location.replace("login.html"); };
    }
    const top = document.getElementById("topbar");
    if (top) {
      const email = KS.session ? KS.session.user.email : "";
      const role = KS.isAdmin ? "Administrador" : "Operador";
      top.innerHTML =
        `<button class="btn btn-ghost btn-icon menu-toggle" id="menu-toggle" aria-label="Menu">${KS.icon("menu")}</button>
         <div class="title">${KS.esc(title || "")}</div>
         <div class="user"><span class="live-dot" id="live-dot" title="Tempo real"></span>
           <span class="email">${KS.esc(email)}</span><span class="tag ${KS.isAdmin ? "role-admin" : "role-operator"}">${role}</span></div>`;
      KS.qs("#menu-toggle").onclick = () => document.body.classList.toggle("nav-open");
    }
    let ov = document.querySelector(".overlay");
    if (!ov) { ov = document.createElement("div"); ov.className = "overlay"; document.body.appendChild(ov); }
    ov.onclick = () => document.body.classList.remove("nav-open");
    document.title = (title ? title + " · " : "") + "KET SHOP Admin";
  }

  async function refreshPendingBadge() {
    const badge = document.getElementById("nav-pending-badge");
    if (!badge) return;
    const { count } = await KS.sb.from("orders").select("id", { count: "exact", head: true })
      .in("status", ["proof_submitted", "under_review"]);
    if (count) { badge.textContent = count; badge.classList.remove("hidden"); } else badge.classList.add("hidden");
  }
  KS.refreshPendingBadge = refreshPendingBadge;

  /**
   * Subscreve alterações (Supabase Realtime). Se o canal falhar, usa
   * polling de segurança. `cb(payload|null)`.
   */
  KS.live = function (name, tables, cb) {
    const dot = document.getElementById("live-dot");
    let poll = null;
    const startPoll = () => { if (!poll) poll = setInterval(() => cb(null), CFG.FALLBACK_POLL_MS || 30000); };
    let ch = KS.sb.channel(name);
    tables.forEach((t) => { ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, (p) => cb(p)); });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (dot) dot.classList.add("on");
        if (poll) { clearInterval(poll); poll = null; }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (dot) dot.classList.remove("on");
        startPoll();
      }
    });
    return ch;
  };
})();
