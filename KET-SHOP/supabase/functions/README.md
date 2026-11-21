# Edge Functions — KET SHOP

| Função | Para quê | Porque precisa de servidor |
|---|---|---|
| `delete-account` | O cliente elimina a própria conta (Definições → Eliminar conta) | Apagar um utilizador do Supabase Auth exige a chave `service_role`, que **nunca** pode estar no APK nem no painel. |

Todas as restantes operações privilegiadas (aprovar/rejeitar pagamentos, mudar estados,
enviar notificações, gerir papéis, relatórios) são funções SQL `SECURITY DEFINER`
em `migrations/004_functions.sql`, que verificam `auth.uid()` e o papel no servidor.

## Deploy (requer Supabase CLI num computador ou Termux)

```bash
supabase login
supabase link --project-ref <REF_DO_PROJECTO>
supabase functions deploy delete-account
```

As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injectadas automaticamente pelo Supabase.

Alternativa sem CLI: Dashboard → Edge Functions → *Deploy a new function* → *Via Editor*,
nome `delete-account`, colar o conteúdo de `delete-account/index.ts`.

Se não fizer o deploy, a app continua a funcionar; apenas o botão "Eliminar conta" mostrará
uma mensagem de erro indicando que o serviço não está disponível.
