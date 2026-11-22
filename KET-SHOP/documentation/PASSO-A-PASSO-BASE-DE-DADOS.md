# Passo a passo — instalar a base de dados (Supabase)

> Use sempre um projecto **NOVO e vazio**. Se o projecto já pertencer a outra aplicação, o script
> `INSTALL_ALL.sql` pára no início com a mensagem "este projecto Supabase já pertence a outra aplicação"
> e **não altera nada**.

## Passo 1 — Criar um projecto novo
1. Abrir **supabase.com/dashboard** → **New project**.
2. **Name:** `ket-shop` · **Database Password:** forte (guarde-a) · **Region:** Europa (ex.: West EU – Ireland).
3. **Create new project** e esperar 1–2 minutos.

## Passo 2 — Abrir o SQL Editor do projecto novo
Confirmar no topo que está no projecto **ket-shop** → **SQL Editor** → **New query**.

## Passo 3 — Instalar
Copiar **todo** o conteúdo de `supabase/INSTALL_ALL.sql` → colar → **Run**.
Resultado esperado: "Success. No rows returned".

## Passo 4 — Confirmar
```sql
select count(*) as produtos from public.products;   -- deve dar 13
```

## Passo 5 — Criar a sua conta
**Authentication → Users → Add user → Create new user** → e-mail + palavra-passe →
marcar **Auto Confirm User** → **Create user**.

## Passo 6 — Ficar administrador
No SQL Editor (troque o e-mail):
```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users
where lower(email) = lower('O-SEU-EMAIL@exemplo.com')
on conflict do nothing;

select u.email, r.role from auth.users u join public.user_roles r on r.user_id = u.id;
```
Deve aparecer o seu e-mail com **admin**.

## Passo 7 — Ligar o painel e a app
**Project Settings → API** (ou *Data API* / *API Keys*): copiar **Project URL** e a chave **anon / publishable**.
- Painel: `admin-web/js/config.js`
- App: `android-app/app/src/main/java/com/ketshop/network/SupabaseConfig.java`

**Nunca** usar a chave `service_role` na app ou no painel.

## Passo 8 — Entrar no painel
Abrir o painel (`login.html`) → entrar com o e-mail e palavra-passe do Passo 5 →
**Métodos de pagamento** → preencher dados reais → activar.

## Erros comuns
| Mensagem | Solução |
|---|---|
| `este projecto Supabase já pertence a outra aplicação` | Está no projecto errado. Criar projecto novo (Passo 1). |
| `invalid input value for enum order_status` | Versão antiga do script num projecto ocupado. Usar o `INSTALL_ALL.sql` desta entrega num projecto novo. |
| Login no painel recusado ("não tem acesso") | Falta o Passo 6. |
| App diz "Perfil não encontrado" | Conta criada antes do SQL. Executar: `insert into public.profiles(id,email) select id,email from auth.users on conflict do nothing; insert into public.user_roles(user_id,role) select id,'customer' from auth.users on conflict do nothing;` |
