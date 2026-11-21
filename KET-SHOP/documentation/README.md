# KET SHOP — Plataforma completa (Android + Painel Web + Supabase)

Loja de diamantes, passes e assinaturas **Free Fire** com pagamento em Kwanzas, envio de comprovativo
dentro da app e verificação pela equipa num painel Web.

```
┌────────────────────────┐        HTTPS (REST)        ┌──────────────────────────────┐
│  App Android (Java/XML)│ ─────────────────────────▶ │           SUPABASE           │
│  clientes              │  Auth · PostgREST · RPC    │  Auth (e-mail + palavra-passe)│
│  sem bibliotecas       │  Storage (upload privado)  │  PostgreSQL + RLS + funções   │
└────────────────────────┘                            │  Storage: payment-proofs      │
                                                      │  Realtime (orders, …)         │
┌────────────────────────┐   supabase-js + Realtime   │  Edge Function: delete-account│
│  Painel Admin (HTML/JS)│ ─────────────────────────▶ └──────────────────────────────┘
│  admin / operador      │
└────────────────────────┘
```

Ambos os clientes usam **apenas a chave `anon`** + o JWT do utilizador. Todas as regras de segurança
(quem vê o quê, preços, transições de estado, aprovação de pagamentos) são aplicadas **no servidor**
por políticas RLS e funções SQL `SECURITY DEFINER`.

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
│           │   ├── network/      SupabaseConfig, SupabaseClient, HttpClient, Async, ApiException
│           │   ├── repositories/ Auth, Product, Order, Proof, Payment, Notification, Profile, Settings
│           │   ├── managers/     Sessão, preferências, notificações, JobScheduler, polling
│           │   └── utils/        Validação, formatação Kz, imagens, ProofFileProvider, UI
│           └── res/              layout (36), drawable (83), values, values-sw600dp, menu, anim, mipmap, xml
├── admin-web/                    Painel administrativo (site estático)
│   ├── index.html  login.html  reset-password.html
│   ├── dashboard.html  orders.html  products.html  customers.html  payments.html
│   ├── notifications.html  reports.html  settings.html  audit.html
│   ├── css/admin.css   js/*.js   assets/
├── supabase/
│   ├── INSTALL_ALL.sql           tudo num só ficheiro (colar no SQL Editor)
│   ├── migrations/               001 tipos · 002 tabelas · 003 índices · 004 funções · 005 triggers · 006 realtime/grants
│   ├── policies/                 001_rls_policies.sql
│   ├── storage/                  001_storage_bucket_and_policies.sql
│   ├── seed/                     001 catálogo + definições · 002 promover 1.º admin
│   └── functions/delete-account/ Edge Function (única operação que exige service_role)
└── documentation/                este ficheiro + CODEASSIST, SUPABASE, BUILD_APK, ADMIN_DEPLOYMENT, SECURITY, TESTING
```

> **Ajuste em relação à estrutura pedida:** o `AndroidManifest.xml` está em `android-app/app/src/main/`
> (e não na raiz de `android-app/`). É essa a localização que o CodeAssist e o Gradle esperam;
> um manifesto na raiz seria ignorado. Foram ainda acrescentados `reset-password.html` (necessário para a
> recuperação de palavra-passe dos clientes) e `audit.html` (auditoria).

## Arranque rápido

1. **Supabase** — criar projecto e executar `supabase/INSTALL_ALL.sql` no SQL Editor → [SUPABASE.md](SUPABASE.md)
2. **Primeiro administrador** — criar a conta e executar `supabase/seed/002_promote_first_admin.sql`
3. **Painel** — preencher `admin-web/js/config.js` e publicar a pasta → [ADMIN_DEPLOYMENT.md](ADMIN_DEPLOYMENT.md)
4. **Métodos de pagamento** — no painel, preencher IBAN/números reais e activar
5. **App** — preencher `SupabaseConfig.java`, abrir no CodeAssist e compilar → [CODEASSIST.md](CODEASSIST.md), [BUILD_APK.md](BUILD_APK.md)

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
comprovativos (URLs assinados de 10 min), aprovar / rejeitar com motivo / processar / concluir /
cancelar, notas internas, histórico; produtos, preços e categorias; clientes (papéis, bloqueio);
métodos de pagamento; notificações gerais ou individuais; relatórios por período/produto/método;
configurações (suporte, aviso, manutenção, textos legais, versão mínima); auditoria.

**Supabase:** 12 tabelas pedidas, enums, constraints, índices, RLS em todas as tabelas, bucket privado
com políticas, triggers de histórico/notificações/auditoria, Realtime, RPCs seguras, Edge Function.

## Limitações conhecidas (ler antes de publicar)

- **Realtime na app Android:** o Supabase Realtime usa WebSockets, que o Android SDK não oferece sem
  bibliotecas externas. A app usa **actualização automática (polling)** de 15–60 s nos ecrãs abertos e
  **JobScheduler** (~15 min, limite do Android) em segundo plano. O painel Web usa Realtime real.
  Para notificações push instantâneas seria necessário Firebase Cloud Messaging (não incluído).
- **Não existe integração automática com Multicaixa Express, PayPay ou bancos.** A confirmação do
  pagamento é feita manualmente pela equipa com base no comprovativo.
- **A entrega dos diamantes é manual** (a equipa carrega o ID e marca como concluída). Não há API
  oficial da Garena integrada.
- Os textos de Termos e Privacidade são **modelos** e precisam de revisão jurídica.
- Compilação no CodeAssist **não foi testada num dispositivo** — ver [TESTING.md](TESTING.md) para o que foi
  verificado e como.
