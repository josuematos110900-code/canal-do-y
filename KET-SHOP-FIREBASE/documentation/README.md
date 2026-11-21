# KET SHOP — Plataforma completa (Android + Painel Web + Firebase)

Loja de diamantes, passes e assinaturas **Free Fire** com pagamento em Kwanzas, envio de comprovativo
dentro da app e verificação pela equipa num painel Web.

```
┌────────────────────────┐   HTTPS REST (sem bibliotecas)   ┌──────────────────────────────┐
│  App Android (Java/XML)│ ───────────────────────────────▶ │           FIREBASE           │
│  clientes              │  Auth · Firestore · Storage      │  Authentication (e-mail)     │
└────────────────────────┘                                  │  Cloud Firestore + Rules     │
                                                            │  Cloud Storage + Rules       │
┌────────────────────────┐  SDK Web modular + onSnapshot    │  (comprovativos privados)    │
│  Painel Admin (HTML/JS)│ ───────────────────────────────▶ └──────────────────────────────┘
│  admin / operador      │
└────────────────────────┘
```

Os dois clientes usam apenas as chaves públicas do projecto. Toda a autorização (quem vê o quê, preço de
cada encomenda, transições de estado, aprovação de pagamentos, acesso aos comprovativos) está nas
**Security Rules** do Firestore e do Storage, testadas no emulador oficial.

> Esta é a versão **Firebase**. A versão Supabase continua disponível em separado (`KET-SHOP/`).
## Estrutura

```
KET-SHOP/
├── android-app/                  Projecto Android (abrir no CodeAssist)
│   ├── settings.gradle
│   ├── build.gradle
│   ├── store-assets/             Ícone 512 px para a loja
│   └── app/
│       ├── build.gradle          sem dependências externas
│       ├── proguard-rules.pro
│       └── src/main/
│           ├── AndroidManifest.xml
│           ├── assets/           terms.txt, privacy.txt (modelos)
│           ├── java/com/ketshop/
│           │   ├── KetShopApp.java
│           │   ├── activities/   21 Activities + BaseActivity
│           │   ├── adapters/     Produto, Encomenda, Notificação, Pagamento, Histórico
│           │   ├── models/       Product, Order, OrderStatus, PaymentProof, …
│           │   ├── network/      FirebaseConfig, FirebaseAuthApi, Firestore, StorageApi, HttpClient, Async
│           │   ├── repositories/ Auth, Product, Order, Proof, Payment, Notification, Profile, Settings
│           │   ├── managers/     Sessão, preferências, notificações, JobScheduler, polling
│           │   └── utils/        Validação, formatação Kz, imagens, ProofFileProvider, UI
│           └── res/              layout (36), drawable (83), values, values-sw600dp, menu, anim, mipmap, xml
├── admin-web/                    Painel administrativo (site estático, módulos ES)
│   ├── index.html  login.html
│   ├── dashboard.html  orders.html  products.html  customers.html  payments.html
│   ├── notifications.html  reports.html  settings.html  audit.html
│   ├── css/admin.css   js/*.js (core, páginas, seed-data)   assets/
├── firebase/
│   ├── firestore.rules           Security Rules do Firestore (colar na consola)
│   ├── storage.rules             Security Rules do Storage
│   ├── firestore.indexes.json    2 índices opcionais
│   ├── firebase.json             para quem usar a Firebase CLI (deploy/hosting/emuladores)
│   ├── seed/catalog.json         catálogo inicial (o painel carrega-o com um botão)
│   └── tests/                    testes das regras, da app (JVM) e do painel (Playwright) no emulador
└── documentation/                este ficheiro + CODEASSIST, FIREBASE, BUILD_APK, ADMIN_DEPLOYMENT, SECURITY, TESTING
```

> **Ajuste em relação à estrutura pedida:** o `AndroidManifest.xml` está em `android-app/app/src/main/`
> (e não na raiz de `android-app/`), que é onde o CodeAssist e o Gradle o procuram. A pasta `supabase/`
> foi substituída por `firebase/`.

## Arranque rápido

1. **Firebase** — criar projecto (plano Blaze para o Storage), activar Email/Password, Firestore e Storage,
   colar as regras → [FIREBASE.md](FIREBASE.md)
2. **Primeiro administrador** — documento `roles/{o-seu-UID}` com `admin: true` na consola
3. **Painel** — colar o `firebaseConfig` em `admin-web/js/config.js`, publicar, entrar e carregar o catálogo
   inicial → [ADMIN_DEPLOYMENT.md](ADMIN_DEPLOYMENT.md)
4. **Métodos de pagamento** — no painel, preencher IBAN/números reais e activar
5. **App** — preencher `FirebaseConfig.java`, abrir no CodeAssist e compilar → [CODEASSIST.md](CODEASSIST.md), [BUILD_APK.md](BUILD_APK.md)

## Funcionalidades

**App Android (cliente):** splash animado, onboarding, registo/login/recuperação, catálogo dinâmico com
pesquisa e categorias, detalhe do produto (base + bónus), ID do jogador com confirmação e ID guardado,
resumo e confirmação, código único `KET-AAMMDD-XXXXXX`, escolha do método de pagamento com dados
copiáveis, **envio de comprovativo** (galeria ou câmara, pré-visualização, remover/substituir, validação
de MIME pelos bytes, compressão automática acima de 5 MB, barra de progresso, upload para Storage
privado, registo na base de dados), acompanhamento com linha temporal e actualização automática,
histórico com filtros, detalhes com visualização do próprio comprovativo, cancelamento, notificações
(lista + alertas do sistema), perfil editável, suporte (contactos definidos no painel + FAQ),
definições (alertas, intervalo, mudar palavra-passe, eliminar conta), termos e privacidade.

**Painel Web (admin/operador):** login com verificação de papel no servidor, dashboard com estatísticas
e gráfico, encomendas com filtros/pesquisa/exportação CSV e **tempo real** (som + aviso), detalhe com
comprovativos carregados do Storage privado, aprovar / rejeitar com motivo / processar / concluir /
cancelar (num único commit com histórico, notificação e auditoria), notas internas, histórico; produtos, preços e categorias; clientes (papéis, bloqueio);
métodos de pagamento; notificações gerais ou individuais; relatórios por período/produto/método;
configurações (suporte, aviso, manutenção, textos legais, versão mínima); auditoria.

**Firebase:** Authentication, Firestore (9 colecções + sub-colecções de histórico e comprovativos — equivalentes às 12 tabelas pedidas),
Storage privado, Security Rules completas e testadas, catálogo inicial carregado pelo painel.

## Limitações conhecidas (ler antes de publicar)

- **Tempo real na app Android:** os *listeners* do Firestore exigem o SDK oficial (bibliotecas externas). A app
  usa **actualização automática** de 15–60 s nos ecrãs abertos e **JobScheduler** (~15 min, limite do
  Android) em segundo plano. O painel Web usa tempo real (`onSnapshot`). Push instantâneo exigiria FCM +
  Cloud Functions (não incluído).
- **Plano Blaze** necessário para o Cloud Storage (comprovativos) — ver [FIREBASE.md](FIREBASE.md).
- **Não existe integração automática com Multicaixa Express, PayPay ou bancos.** A confirmação do
  pagamento é feita manualmente pela equipa com base no comprovativo.
- **A entrega dos diamantes é manual** (a equipa carrega o ID e marca como concluída). Não há API
  oficial da Garena integrada.
- Os textos de Termos e Privacidade são **modelos** e precisam de revisão jurídica.
- A compilação no CodeAssist e a execução num telemóvel **não foram testadas** — ver [TESTING.md](TESTING.md) para o que foi
  verificado e como.
