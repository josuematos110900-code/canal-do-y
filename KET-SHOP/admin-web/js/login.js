(function () {
  "use strict";
  const form = KS.qs("#login-form");
  const alertBox = KS.qs("#login-alert");
  const show = (msg, type) => { alertBox.className = "alert " + (type || "error"); alertBox.textContent = msg; };

  const params = new URLSearchParams(location.search);
  if (params.get("error") === "forbidden") show("Esta conta não tem acesso ao painel (requer papel admin ou operator).");
  if (!KS.sb) show("Configure admin-web/js/config.js com o URL e a anon key do Supabase.", "warning");

  (async function () {
    if (!KS.sb) return;
    const { data } = await KS.sb.auth.getSession();
    if (data.session && !params.get("error")) location.replace(params.get("next") || "dashboard.html");
  })();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!KS.sb) return;
    const email = KS.qs("#email").value.trim();
    const password = KS.qs("#password").value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return show("Indique um e-mail válido.");
    if (!password) return show("Indique a palavra-passe.");
    const btn = KS.qs("#login-btn");
    await KS.busy(btn, async () => {
      const { error } = await KS.sb.auth.signInWithPassword({ email, password });
      if (error) return show(KS.errMsg(error));
      const { data: roles, error: rErr } = await KS.sb.rpc("my_roles");
      if (rErr) return show(KS.errMsg(rErr));
      if (!roles || !(roles.includes("admin") || roles.includes("operator"))) {
        await KS.sb.auth.signOut();
        return show("Esta conta não tem acesso ao painel (requer papel admin ou operator).");
      }
      const next = params.get("next");
      location.replace(next && /^[a-z-]+\.html$/.test(next) ? next : "dashboard.html");
    });
  });
})();
