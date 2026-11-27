# Segurança (versão Firebase)

## Princípios
1. **A app e o painel são clientes públicos.** As chaves do Firebase que contêm são identificadores públicos;
   qualquer pessoa pode ler o código. Nenhuma regra depende de esconder botões.
2. **Toda a autorização está nas Security Rules** (`firebase/firestore.rules` e `storage.rules`), avaliadas
   pelos servidores do Google em cada leitura e escrita.
3. **Não são usadas chaves de conta de serviço** em lado nenhum.

## Quem pode fazer o quê

| Recurso | Cliente | Operador | Admin |
|---|---|---|---|
| Produtos / categorias activos | ler (também sem sessão) | ler tudo | ler + escrever |
| Métodos de pagamento | ler activos (com sessão) | ler | ler + escrever |
| Encomendas | ler as suas; criar, escolher método, enviar comprovativo e cancelar **só nas condições validadas** | ler todas; mudar estado nas transições permitidas | igual ao operador |
| Histórico / comprovativos (metadados) | das suas encomendas | todos; rever comprovativos | igual |
| Ficheiros dos comprovativos | enviar para a sua pasta; ver os seus | ver todos | ver todos; apagar |
| Notificações | ler/marcar lidas/apagar as suas; criar apenas automáticas das suas encomendas | enviar (incl. gerais) | igual |
| Perfis (`users`) | ver/editar o seu (nome, telefone, último ID) | ver todos | ver todos; bloquear |
| Papéis (`roles`) | ver o seu | ver | atribuir/remover |
| Definições | ler `settings/public` | ler tudo | escrever |
| Auditoria | — | escrever as próprias entradas | ler |

## Protecções verificadas pelas regras
- **Preço:** ao criar a encomenda, `total_kz`, `subtotal_kz`, o nome, a quantidade e o preço unitário do item
  têm de ser **iguais aos do documento do produto** activo. Uma app modificada não consegue pagar menos.
- **Código único:** o ID do documento é o código `KET-AAMMDD-XXXXXX`; criar sobre um código existente é recusado.
- **Dono:** `user_id` tem de ser o utilizador autenticado; contas bloqueadas e modo de manutenção bloqueiam encomendas.
- **Método de pagamento:** a cópia gravada na encomenda (IBAN, telefone, entidade, referência, titular,
  instruções) tem de ser **idêntica** ao método activo — impede mostrar ao cliente dados bancários falsos.
- **Comprovativo:** a passagem para "Comprovativo enviado" só é aceite se, **no mesmo commit**, for criado o
  documento do comprovativo, com caminho `proofs/<uid>/<encomenda>/…`, MIME de imagem e tamanho ≤ 5 MB.
- **Storage:** só o dono carrega para a sua pasta, só para encomenda sua em estado que aceita comprovativo,
  só `image/jpeg|png|webp` até 5 MB, sem sobrescrever ficheiros existentes; leitura apenas do dono e da equipa.
- **Estados:** o cliente só pode escolher o método, enviar comprovativo e cancelar enquanto
  "Pendente de pagamento"/"Pagamento rejeitado". A equipa só pode seguir as transições permitidas; rejeitar e
  cancelar exigem motivo; `processed_by` tem de ser quem faz a alteração. Ninguém apaga encomendas.
- **Histórico:** cada entrada tem de corresponder ao estado final da encomenda no mesmo commit e ao autor.
- **Notificações:** clientes não criam notificações "gerais" nem para outros clientes; só podem marcar como lidas.
- **Papéis:** só admins alteram `roles`; um admin não pode retirar o próprio papel de admin. O 1.º admin é
  criado na consola.
- **Perfil:** o cliente não altera `is_blocked`, e-mail nem data de criação.

Todas estas regras têm testes automáticos (`firebase/tests/rules.test.mjs`, 64 casos).

## Outras medidas
- **Sessão na app:** tokens em `SharedPreferences` privadas, excluídas do backup; renovação automática;
  HTTPS obrigatório (`network_security_config.xml`).
- **XSS no painel:** todo o conteúdo vindo de clientes passa por `KS.esc()` ou `textContent` (testado).
- **Auditoria:** o painel regista alterações de preços, produtos, métodos, papéis, bloqueios, definições,
  notificações e estados das encomendas.

## Recomendações de configuração
- *Authentication → Settings*: activar protecção contra enumeração de e-mails; considerar
  **App Check** (reCAPTCHA no painel, Play Integrity na app) para reduzir abuso automatizado.
- Definir **alertas de orçamento** no Google Cloud (plano Blaze).
- Uma conta por membro da equipa (a auditoria regista o autor de cada acção).

## Limitações conhecidas
- Sem Cloud Functions, o limite de **5 encomendas por pagar** é aplicado pela app, não pelas regras. Um cliente
  que use a API directamente pode criar mais encomendas por pagar (mas não alterar preços nem estados);
  a equipa pode cancelá-las e bloquear a conta.
- As notificações automáticas são escritas pelo cliente ou pela equipa no mesmo commit da mudança de estado.
  As regras impedem conteúdos para outros utilizadores, mas o texto de uma notificação automática do próprio
  cliente não é validado palavra a palavra.
- Os URLs de visualização de comprovativos no painel têm token de download (ver ADMIN_DEPLOYMENT.md §5).
- Um ficheiro carregado cujo registo falhe fica no Storage sem documento. A app repete o registo com o mesmo
  ficheiro; ficheiros órfãos podem ser apagados por um admin na consola.
