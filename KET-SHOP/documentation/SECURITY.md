# Segurança

## Princípios
1. **A app e o painel são clientes públicos.** Usam só a chave `anon`; qualquer pessoa pode ler o código.
   Por isso nenhuma regra depende de esconder botões.
2. **Toda a autorização está no PostgreSQL**: RLS em todas as tabelas, privilégios por coluna e funções
   `SECURITY DEFINER` com `search_path` vazio que verificam `auth.uid()` e o papel.
3. **A chave `service_role` só existe na Edge Function `delete-account`**, dentro do Supabase.

## Quem pode fazer o quê

| Recurso | Cliente | Operador | Admin |
|---|---|---|---|
| Produtos / categorias activos | ler | ler tudo | ler + escrever |
| Métodos de pagamento | ler activos | ler | ler + escrever |
| Encomendas | ler as suas; criar/cancelar/pagar **só via RPC** | ler todas; mudar estado via RPC | igual |
| Itens e histórico | das suas encomendas | todos | todos |
| Comprovativos (tabela e ficheiros) | enviar e ver os seus | ver todos | ver todos; apagar ficheiros |
| Notificações | ler/apagar as suas; marcar lidas via RPC | enviar | enviar |
| Perfis | ver/editar o seu (nome, telefone) | ver todos | ver todos; bloquear |
| Papéis | ver os seus | ver | atribuir/remover (via RPC) |
| Definições | ler públicas | ler todas | escrever |
| Auditoria | — | — | ler |

## Protecções específicas
- **Preço:** `create_order` lê `price_kz` da tabela `products`; a app nunca envia valores.
- **Estados:** transições válidas codificadas em `admin_update_order_status`; o cliente só consegue
  "enviar comprovativo" e "cancelar" nos estados permitidos. `UPDATE` directo em `orders` está revogado.
- **Comprovativos:**
  - bucket privado, 5 MB, apenas `image/jpeg|png|webp` (verificado pelo Storage);
  - política de `INSERT` exige pasta `<auth.uid()>/<order_id>/`, encomenda do próprio e em estado que
    aceita comprovativo, e extensão permitida;
  - não existe política de `UPDATE`: um ficheiro enviado não pode ser substituído;
  - `submit_payment_proof` confirma que o objecto existe no Storage e que o caminho pertence ao utilizador;
  - a app valida o formato pelos *magic bytes* (não apenas pela extensão) e recomprime imagens grandes;
  - o painel mostra os ficheiros através de **URLs assinados válidos 10 minutos**.
- **Perfil:** o cliente só tem `UPDATE` nas colunas `full_name`, `phone`, `avatar_url`, `last_player_id`;
  um trigger impede alteração de bloqueio/e-mail por não-admins.
- **Anti-abuso:** máximo de 5 encomendas por pagar por cliente; contas bloqueadas não criam encomendas;
  modo de manutenção bloqueia encomendas no servidor.
- **Auto-bloqueio:** um admin não pode remover o próprio papel de admin nem bloquear a própria conta.
- **Auditoria:** triggers registam inserções/alterações/remoções em produtos, categorias, métodos de
  pagamento, definições e papéis; RPCs registam mudanças de estado, notas, envios e bloqueios.
- **Sessão na app:** tokens em `SharedPreferences` privadas, excluídas do backup (`backup_rules.xml`);
  renovação automática; HTTPS obrigatório (`network_security_config.xml`, `usesCleartextTraffic=false`).
- **XSS no painel:** todo o conteúdo vindo de clientes (nickname, notas, nomes) passa por `KS.esc()`
  ou `textContent` (testado com `<b>Nick</b>`).

## Recomendações de configuração
- Supabase Auth: activar *Leaked password protection*, considerar CAPTCHA no registo e MFA para a equipa.
- Rever periodicamente *Database → Advisors* (segurança e desempenho).
- Não partilhar contas de admin; criar um utilizador por membro da equipa (a auditoria regista quem fez o quê).
- Guardar o *keystore* de release do APK fora do telemóvel.

## Limitações conhecidas
- Um ficheiro carregado cujo registo (`submit_payment_proof`) falhe fica no Storage sem linha na tabela.
  A app tenta repetir o registo com o mesmo ficheiro; ficheiros órfãos podem ser apagados por um admin
  em *Storage → payment-proofs*.
- A validação de que a imagem é realmente um comprovativo é humana (revisão no painel).
