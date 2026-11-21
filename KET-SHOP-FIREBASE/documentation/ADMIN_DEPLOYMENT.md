# Publicar o painel administrativo

O painel é um **site estático** (HTML/CSS/JavaScript em módulos ES). Não tem servidor próprio: usa o SDK Web
do Firebase (carregado de `www.gstatic.com`, versão fixa 10.12.2) com a sessão do administrador.
Pode ser alojado em qualquer serviço com **HTTPS**.

## 1. Configurar
Consola Firebase → ⚙ *Definições do projecto* → *As suas apps* → **Web (</>)** → registar a app →
copiar o objecto `firebaseConfig` para `admin-web/js/config.js`:
```js
firebase: {
  apiKey: "AIzaSy...",
  authDomain: "ketshop-xxxx.firebaseapp.com",
  projectId: "ketshop-xxxx",
  storageBucket: "ketshop-xxxx.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
},
USE_EMULATORS: false
```

## 2. Publicar (escolha um)
- **Firebase Hosting** (mesmo projecto, recomendado): com a Firebase CLI, na pasta `firebase/`:
  `firebase login`, `firebase use <id-do-projecto>`, `firebase deploy --only hosting`
  (o `firebase.json` já aponta para `../admin-web`). Fica em `https://<id>.web.app`.
- **Netlify Drop:** <https://app.netlify.com/drop> → arrastar a pasta `admin-web` (funciona no navegador do telemóvel).
- **Cloudflare Pages / Vercel / GitHub Pages / alojamento próprio:** enviar o conteúdo de `admin-web`.

Os ficheiros têm de ser servidos por HTTP(S): abrir `login.html` directamente do disco (`file://`) não funciona
com módulos ES.

## 3. Domínio autorizado
*Authentication → Settings → Authorized domains* → acrescentar o domínio do painel
(os domínios `*.web.app` e `*.firebaseapp.com` do próprio projecto já estão autorizados).

## 4. Primeiro acesso
1. Crie o documento `roles/{o-seu-UID}` com `admin: true` (ver FIREBASE.md §5).
2. Abra `https://<painel>/login.html`.
3. **Configurações → Carregar catálogo inicial**.
4. **Métodos de pagamento** → preencher dados reais → activar.
5. **Configurações** → contactos de suporte, textos legais.

Contas sem documento em `roles` (ou com `admin`/`operator` a `false`) são recusadas, mesmo com palavra-passe válida.

## 5. Recomendações
- O indicador verde na barra superior mostra que o tempo real (`onSnapshot`) está ligado.
- O som de novas encomendas pode ser desligado em **Configurações**.
- Os comprovativos são mostrados com URLs de download do Storage obtidos com a sessão do administrador.
  Esses URLs contêm um token secreto: não os partilhe. Pode revogá-los na consola (*Storage → ficheiro →
  Token de acesso*).
- Active a verificação em dois passos (MFA) nas contas Google da equipa com acesso à consola.
