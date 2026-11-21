# Publicar o painel administrativo

O painel é um **site estático** (HTML/CSS/JS). Não tem servidor próprio: fala directamente com o
Supabase usando a chave `anon` + a sessão do administrador. Pode ser alojado em qualquer serviço de
ficheiros estáticos com **HTTPS**.

## 1. Configurar
Edite `admin-web/js/config.js`:
```js
SUPABASE_URL: "https://abcdefghijkl.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",   // anon public — NUNCA a service_role
```

## 2. Publicar (escolha um)
- **Netlify:** <https://app.netlify.com/drop> → arrastar a pasta `admin-web`.
- **Cloudflare Pages / Vercel:** novo projecto → *upload* da pasta `admin-web` (sem comando de build;
  pasta de saída = raiz).
- **GitHub Pages:** colocar o conteúdo de `admin-web` num repositório → *Settings → Pages*.
- **Alojamento próprio (cPanel, Nginx, Apache):** copiar a pasta para `public_html/admin/`.

Do telemóvel: o Netlify Drop funciona no navegador do Android (escolher a pasta extraída do ZIP).

## 3. Ligar ao Supabase Auth
Supabase → *Authentication → URL Configuration*:
- *Site URL*: `https://<o-seu-painel>/`
- *Redirect URLs*: `https://<o-seu-painel>/reset-password.html`

`reset-password.html` é a página que os **clientes** abrem a partir do e-mail "Esqueci a palavra-passe"
enviado pela app. Coloque o mesmo endereço em `SupabaseConfig.PASSWORD_RESET_REDIRECT_URL` na app.

## 4. Primeiro acesso
Abra `https://<o-seu-painel>/login.html` com a conta promovida a `admin` (ver SUPABASE.md §3).
Contas sem papel `admin`/`operator` são recusadas mesmo que tenham palavra-passe válida.

## 5. Recomendações
- Use um endereço não óbvio e não o divulgue (as páginas já têm `noindex`), mas lembre-se de que a
  segurança está nas políticas do Supabase, não no segredo do endereço.
- Active MFA/palavras-passe fortes para as contas da equipa.
- O indicador verde na barra superior mostra que o **Realtime** está ligado; se ficar cinzento, o painel
  actualiza a cada 30 s automaticamente.
- O som de novas encomendas pode ser desligado em **Configurações**.
- A biblioteca `@supabase/supabase-js@2.45.4` é carregada do jsDelivr com versão fixa. Para não
  depender de CDN, descarregue `dist/umd/supabase.min.js` para `admin-web/js/` e ajuste o `<script>`
  das páginas.
