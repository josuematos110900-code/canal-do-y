(function () {
  "use strict";
  const alertBox = KS.qs("#reset-alert");
  const fields = KS.qs("#reset-fields");
  const show = (msg, type) => { alertBox.className = "alert " + (type || "error"); alertBox.textContent = msg; };
  if (!KS.sb) { show("Página não configurada (config.js).", "warning"); return; }

  let ready = false;
  // O supabase-js lê o token de recuperação do URL (detectSessionInUrl) e emite PASSWORD_RECOVERY
  KS.sb.auth.onAuthStateChange((event, session) => {
    if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
      ready = true;
      fields.classList.remove("hidden");
      alertBox.classList.add("hidden");
    }
  });
  setTimeout(async () => {
    const { data } = await KS.sb.auth.getSession();
    if (data.session) { ready = true; fields.classList.remove("hidden"); }
    else if (!ready) {
      const err = new URLSearchParams(location.hash.slice(1)).get("error_description");
      show(err ? err.replace(/\+/g, " ") : "Ligação inválida ou expirada. Peça uma nova recuperação na app.");
    }
  }, 1200);

  KS.qs("#reset-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const p1 = KS.qs("#pw1").value, p2 = KS.qs("#pw2").value;
    if (p1.length < 8 || !/[A-Za-z]/.test(p1) || !/\d/.test(p1)) return show("Use pelo menos 8 caracteres com letras e números.");
    if (p1 !== p2) return show("As palavras-passe não coincidem.");
    await KS.busy(KS.qs("#reset-btn"), async () => {
      const { error } = await KS.sb.auth.updateUser({ password: p1 });
      if (error) return show(KS.errMsg(error));
      fields.classList.add("hidden");
      show("Palavra-passe alterada. Já pode iniciar sessão na app KET SHOP.", "success");
      await KS.sb.auth.signOut();
    });
  });
})();
