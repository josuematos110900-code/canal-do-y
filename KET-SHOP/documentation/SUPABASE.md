# Supabase — instalação e referência

## 1. Criar o projecto
1. <https://supabase.com> → *New project*. Escolha uma região próxima (ex.: Europa).
2. Guarde a palavra-passe da base de dados.

## 2. Instalar a base de dados
**Opção A (recomendada, sem ferramentas):** Dashboard → **SQL Editor** → *New query* → colar o conteúdo
completo de `supabase/INSTALL_ALL.sql` → **Run**. O ficheiro é idempotente (pode voltar a executar).

**Opção B (Supabase CLI num computador/Termux):** copiar os ficheiros de `migrations/`, `policies/`,
`storage/` e `seed/001_*` para `supabase/migrations/` de um projecto CLI (com prefixo de data) e
`supabase db push`.

Ordem obrigatória se executar ficheiro a ficheiro: `migrations/001…006` → `policies/001` → `storage/001` → `seed/001`.

## 3. Primeiro administrador
1. Crie a sua conta (na app ou em *Authentication → Users → Add user*, com *Auto Confirm*).
2. Edite `seed/002_promote_first_admin.sql` com o seu e-mail e execute no SQL Editor.
3. Entre no painel. Novos operadores/admins: **Clientes → abrir → Papéis**.

Papéis: `admin` (tudo), `operator` (encomendas, comprovativos, clientes em leitura, notificações, relatórios),
`customer` (atribuído automaticamente no registo).

## 4. Autenticação (Dashboard → Authentication)
- **Providers → Email:** activo. *Confirm email* pode ficar ligado (a app trata o caso: pede para confirmar
  o e-mail antes de entrar) ou desligado (entra logo após o registo).
- **Password:** recomenda-se mínimo 8 caracteres (a app já exige letras + números).
- **URL Configuration:** *Site URL* = endereço do painel; em *Redirect URLs* acrescente
  `https://<painel>/reset-password.html`. Use o mesmo URL em `SupabaseConfig.PASSWORD_RESET_REDIRECT_URL`.
- Opcional: *Leaked password protection*, CAPTCHA e MFA para contas da equipa.

## 5. Verificações rápidas (SQL Editor)
```sql
select count(*) from public.products;                         -- 13
select type, is_active from public.payment_methods;           -- 4, todos inactivos
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'payment-proofs';
select tablename from pg_publication_tables where pubname = 'supabase_realtime';
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;  -- todos true
```

## 6. Storage
O SQL cria o bucket **`payment-proofs`**: privado, limite 5 MB, MIME `image/jpeg`, `image/png`, `image/webp`.
Caminho dos ficheiros: `<user_id>/<order_id>/comprovativo_<timestamp>.<ext>`.

## 7. Realtime
O SQL adiciona `orders`, `notifications`, `payment_proofs` e `order_status_history` à publicação
`supabase_realtime`. Cada subscritor só recebe linhas que as políticas RLS lhe permitem ler.

## 8. Edge Function `delete-account`
Ver `supabase/functions/README.md`. É a única operação que precisa da chave `service_role`,
e essa chave fica apenas no servidor do Supabase.

## 9. Modelo de dados

| Tabela | Conteúdo |
|---|---|
| `profiles` | 1:1 com `auth.users` (nome, e-mail, telefone, último ID, bloqueio) |
| `user_roles` | papéis `admin` / `operator` / `customer` |
| `product_categories` | Diamantes, Passes e Assinaturas, … |
| `products` | base, bónus, total (coluna gerada), preço em Kz, activo, por encomenda, destaque |
| `payment_methods` | IBAN, telefone, entidade/referência, instruções — **configurados no painel** |
| `orders` | código único, estado, ID do jogador, total, snapshot do método de pagamento, motivos |
| `order_items` | produto e snapshot (nome/quantidades/preço no momento da compra) |
| `payment_proofs` | caminho no Storage, MIME, tamanho, estado da revisão |
| `notifications` | notificações por utilizador (automáticas e gerais) |
| `app_settings` | chave/valor JSON (`is_public` = legível pela app) |
| `order_status_history` | cada mudança de estado com nota e autor |
| `audit_logs` | alterações de catálogo, pagamentos, definições, papéis e acções sobre encomendas |

## 10. Funções RPC

| Função | Quem | O que faz |
|---|---|---|
| `create_order(product_id, player_id, nickname, notes)` | cliente | Cria encomenda com o **preço lido do servidor**; valida ID, produto activo, conta não bloqueada, modo manutenção, máx. 5 por pagar |
| `set_order_payment_method(order_id, method_id)` | cliente | Escolhe método activo e grava snapshot dos dados |
| `submit_payment_proof(order_id, path, name, mime, size)` | cliente | Verifica dono, estado, caminho, MIME, tamanho e **existência do ficheiro no Storage**; muda para "Comprovativo enviado" |
| `cancel_my_order(order_id, reason)` | cliente | Só em "Pendente de pagamento" ou "Pagamento rejeitado" |
| `update_my_profile(name, phone)` | cliente | Actualiza nome/telefone |
| `mark_notification_read`, `mark_all_notifications_read`, `unread_notifications_count` | cliente | Notificações |
| `admin_update_order_status(order_id, status, note)` | admin/operador | Transições validadas; motivo obrigatório para rejeitar/cancelar |
| `admin_update_order_notes` | admin/operador | Notas internas |
| `admin_send_notification(user_id \| null, title, body)` | admin/operador | Notificação a um cliente ou a todos |
| `admin_set_user_role`, `admin_set_user_blocked` | admin | Papéis e bloqueio (impede auto-bloqueio/auto-remoção) |
| `admin_dashboard_stats`, `admin_sales_report(from, to)` | admin/operador | Estatísticas e relatórios |

## 11. Estados e transições

```
pending_payment ──(cliente envia comprovativo)──▶ proof_submitted ──▶ under_review
      │                                               │                  │
      │                                               ├──▶ payment_approved ──▶ processing ──▶ completed
      │                                               └──▶ payment_rejected ──(novo comprovativo)──▶ proof_submitted
      └──▶ cancelled  (cliente: só por pagar/rejeitada · equipa: qualquer estado não final, com motivo)
```
Cada transição grava `order_status_history` e cria uma notificação para o cliente (trigger).
