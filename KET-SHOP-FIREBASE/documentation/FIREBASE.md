# Firebase — instalação e referência

Tudo o que está aqui pode ser feito **só com o navegador** (consola Firebase), inclusive no telemóvel.
A Firebase CLI é opcional.

## 1. Criar o projecto
1. <https://console.firebase.google.com> → **Adicionar projecto** → nome `ketshop` (o Google Analytics é opcional).
2. **Plano:** o Firebase exige o plano **Blaze** (pagamento conforme a utilização) para usar o
   **Cloud Storage** em projectos novos, e é no Storage que ficam os comprovativos. O Blaze mantém uma quota
   gratuita mensal, mas pede um cartão. Confirme os valores actuais em <https://firebase.google.com/pricing>
   e defina um **alerta de orçamento** em *Utilização e faturação*.
   (Authentication e Firestore funcionam no plano gratuito Spark; sem Storage não há envio de comprovativos.)

## 2. Authentication
*Build → Authentication → Começar → Sign-in method → **Email/Password** → Activar.*
- *Settings → Authorized domains*: acrescente o domínio onde publicar o painel.
- *Templates*: pode traduzir os e-mails de verificação e de redefinição para português.
  A redefinição de palavra-passe usa a página do próprio Firebase (não é preciso alojar nada).

## 3. Cloud Firestore
*Build → Firestore Database → Criar base de dados* → modo **produção** → região próxima (ex.: `europe-west1`).
Depois, separador **Regras** → apagar o conteúdo → colar `firebase/firestore.rules` → **Publicar**.

### Índices
A app e o painel foram escritos para funcionar **sem índices compostos** (ordenam no próprio dispositivo
quando necessário). Dois índices tornam a leitura de notificações e de encomendas por estado mais eficiente
em lojas grandes; crie-os em *Firestore → Índices → Composto*:

| Colecção | Campos |
|---|---|
| `notifications` | `user_id` Ascendente, `created_at` Descendente |
| `orders` | `status` Ascendente, `created_at` Descendente |

(Ou `firebase deploy --only firestore:indexes` com o ficheiro `firebase/firestore.indexes.json`.)
Se o Firestore pedir outro índice, a mensagem de erro traz uma ligação que o cria com um clique.

## 4. Cloud Storage
*Build → Storage → Começar* (mesma região). Separador **Regras** → colar `firebase/storage.rules` → **Publicar**.
Anote o nome do bucket (ex.: `ketshop-xxxx.firebasestorage.app`).
As regras do Storage consultam o Firestore (`firestore.get`). Na primeira publicação a consola pode pedir
autorização para isso: aceite.

## 5. Primeiro administrador
1. Crie a sua conta (pela app ou em *Authentication → Users → Adicionar utilizador*).
2. Copie o **UID** do utilizador (coluna "ID do utilizador").
3. *Firestore → Dados → Iniciar colecção* → ID da colecção **`roles`** → ID do documento = **o seu UID** →
   campo `admin` (tipo **boolean**) = `true` → Guardar.
4. Entre no painel. Outros admins/operadores: **Clientes → abrir → Papéis**.

> A consola ignora as Security Rules, por isso este passo manual é a forma segura de criar o primeiro admin.
> Ninguém consegue tornar-se admin pela app ou pelo painel sem já ser admin.

## 6. Catálogo inicial
No painel: **Configurações → Carregar catálogo inicial**. Cria:
- categorias `diamantes` e `passes`;
- os 13 produtos Free Fire com os preços pedidos (8 de diamantes, incluindo 26.880 "por encomenda", e 5 passes);
- os 4 métodos de pagamento **inactivos e sem dados bancários**;
- `settings/public` e `settings/private`.

Depois: **Métodos de pagamento** → preencher IBAN/telefone/entidade reais → activar.
O mesmo conteúdo está em `firebase/seed/catalog.json` para referência.

## 7. Chaves para a app e o painel
*⚙ Definições do projecto → Geral*:
- **App Android:** "Chave da API Web", "ID do projecto" e o bucket → `FirebaseConfig.java`.
  (A app usa a API REST; **não** precisa de `google-services.json`.)
- **Painel:** *As suas apps → Adicionar app → Web (</>)* → copiar `firebaseConfig` → `admin-web/js/config.js`.

Estas chaves identificam o projecto e são públicas por natureza; quem protege os dados são as regras.
**Nunca** use ficheiros de conta de serviço (service account) na app ou no painel.

## 8. Modelo de dados

| Colecção | Documento | Conteúdo |
|---|---|---|
| `users` | `{uid}` | nome, e-mail, telefone, último ID de jogador, bloqueio |
| `roles` | `{uid}` | `admin: bool`, `operator: bool` (só existe para a equipa) |
| `categories` | `{slug}` | nome, jogo, ordem, activa |
| `products` | `{id}` | base, bónus, `total_amount`, `price_kz`, activo, por encomenda, destaque |
| `paymentMethods` | `{id}` | tipo, IBAN, telefone, entidade/referência, instruções, activo |
| `orders` | `{código KET-AAMMDD-XXXXXX}` | cliente, estado, ID do jogador, item, total, cópia do método de pagamento, motivos |
| `orders/{id}/history` | auto | cada mudança de estado (de → para, nota, autor) |
| `orders/{id}/proofs` | auto | caminho no Storage, MIME, tamanho, estado da revisão |
| `notifications` | auto | notificações por cliente (automáticas e gerais) |
| `settings` | `public`, `private` | contactos, aviso, manutenção, textos legais, versão mínima / som do painel |
| `auditLogs` | auto | acções da equipa (estados, preços, métodos, papéis, definições, bloqueios) |

Storage: `proofs/{uid}/{orderId}/comprovativo_{timestamp}.{jpg|png|webp}`.

Correspondência com as 12 "tabelas" pedidas:

| Pedido | No Firestore |
|---|---|
| profiles | `users` |
| user_roles | `roles` |
| products / product_categories | `products` / `categories` |
| payment_methods | `paymentMethods` |
| orders | `orders` |
| order_items | campo `order_items` dentro de cada encomenda (cópia do produto e preço no momento da compra) |
| payment_proofs | `orders/{id}/proofs` (metadados) + ficheiro no Storage |
| notifications | `notifications` |
| app_settings | `settings/public` e `settings/private` |
| order_status_history | `orders/{id}/history` |
| audit_logs | `auditLogs` |

## 9. Estados e transições

```
pending_payment ──(cliente envia comprovativo)──▶ proof_submitted ──▶ under_review
      │                                               │                  │
      │                                               ├──▶ payment_approved ──▶ processing ──▶ completed
      │                                               └──▶ payment_rejected ──(novo comprovativo)──▶ proof_submitted
      └──▶ cancelled  (cliente: só por pagar/rejeitada · equipa: qualquer estado não final, com motivo)
```
As transições, o motivo obrigatório para rejeitar/cancelar e o preço de cada encomenda são **verificados nas
Security Rules**. Cada mudança é gravada num único commit atómico com o histórico e a notificação do cliente.

## 10. Porque não há Cloud Functions
Para funcionar sem servidor próprio e sem a Firebase CLI, toda a lógica sensível está nas Security Rules
(validação de preço contra o produto, cópia exacta do método de pagamento, transições permitidas, existência
do comprovativo no mesmo commit, etc.). As notificações automáticas são escritas pela app ou pelo painel no
mesmo commit da mudança de estado, e as regras validam-nas.
O que **não** é possível sem Functions: notificações push instantâneas (FCM) e um limite de encomendas por
pagar garantido no servidor (a app aplica o limite de 5, mas um cliente que use a API directamente pode
contorná-lo; não consegue, porém, alterar preços nem estados).
