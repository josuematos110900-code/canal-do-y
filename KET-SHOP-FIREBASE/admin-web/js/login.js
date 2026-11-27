import { KS, AUTH } from "./core.js";

const form = KS.qs("#login-form");
const alertBox = KS.qs("#login-alert");
const show = (msg, type) => { alertBox.className = "alert " + (type || "error"); alertBox.textContent = msg; };
const params = new URLSearchParams(location.search);

if (params.get("error") === "forbidden") show("Esta conta não tem acesso ao painel (requer papel admin ou operator na colecção roles).");
if (!KS.configured) show("Configure admin-web/js/config.js com o firebaseConfig do seu projecto.", "warning");
else if (!params.get("error")) {
  const u = await KS.currentUser();
  if (u && (await KS.loadRoles(u.uid).catch(() => [])).length) location.replace(params.get("next") || "dashboard.html");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!KS.configured) return;
  const email = KS.qs("#email").value.trim();
  const password = KS.qs("#password").value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return show("Indique um e-mail válido.");
  if (!password) return show("Indique a palavra-passe.");
  await KS.busy(KS.qs("#login-btn"), async () => {
    try {
      const cred = await AUTH.signInWithEmailAndPassword(KS.auth, email, password);
      const roles = await KS.loadRoles(cred.user.uid);
      if (!roles.length) {
        await AUTH.signOut(KS.auth);
        return show("Esta conta não tem acesso ao painel (requer papel admin ou operator na colecção roles).");
      }
      const next = params.get("next");
      location.replace(next && /^[a-z-]+\.html$/.test(next) ? next : "dashboard.html");
    } catch (err) {
      show(KS.errMsg(err));
    }
  });
});
