# Testes (versão Firebase)

Separação clara entre **o que foi verificado automaticamente** e **o que tem de testar** num telemóvel e num
projecto Firebase real.

## 1. Verificações executadas

Todas correram no **Firebase Emulator Suite oficial** (firebase-tools 13, Auth + Firestore + Storage) com as
Security Rules deste projecto activas.

### 1.1 Security Rules — `firebase/tests/rules.test.mjs` — **64/64**
Catálogo e definições (leitura anónima só de activos, só admin altera preços, operador não), perfil e papéis
(cliente não se desbloqueia nem se torna admin, admin não retira o próprio admin), encomendas (preço
adulterado, produto inactivo, ID inválido, encomenda em nome de outro, conta bloqueada, código duplicado,
isolamento entre clientes, cliente não altera total nem se auto-aprova, método inactivo, **IBAN falsificado**),
comprovativos (pasta de outro, encomenda de outro, PDF, > 5 MB, **sobrescrita**, leitura por outro cliente,
estado sem documento do comprovativo, caminho falso), equipa (rejeição sem motivo, transição inválida, fluxo
completo até concluída, ninguém apaga), notificações e auditoria.
Os testes encontraram e permitiram corrigir dois erros nas regras (caminho de documento mal construído e
sobrescrita de ficheiros permitida).

### 1.2 Código Java real da app — `firebase/tests/android/` — **36/36**
O código de produção (`network/`, `repositories/`, `managers/`, `models/`) foi compilado com uma variante do
`FirebaseConfig` apontada para o emulador e executado na JVM:
registo + perfil, logout/login, palavra-passe errada, renovação do token, editar perfil, catálogo ordenado,
destaques, produto inactivo, métodos activos, definições, **criar encomenda**, preço adulterado recusado,
histórico, comprovativo sem método recusado, escolher método, **upload multipart para o Storage com progresso**,
registar comprovativo, descarregar o próprio, cancelamento recusado após envio, notificações (lista, não lidas,
marcar todas, apagar), cancelar outra encomenda, filtros/estatísticas, isolamento entre clientes (encomenda e
ficheiro), mudar palavra-passe, eliminar conta, recuperação de palavra-passe.
Este teste encontrou um problema real: o upload "media" simples não transmite o tipo do ficheiro às regras;
foi substituído por upload *multipart* (o protocolo do SDK oficial).

### 1.3 Painel Web — `firebase/tests/admin-e2e.mjs` (Playwright + Chromium) — **37/37**
Redireccionamento sem sessão, login errado/certo, **carregar catálogo inicial** (21 registos), 13 produtos com
preços em Kz, activar método IBAN, cliente cria encomenda e envia comprovativo, encomenda aparece em
"Por verificar", nickname `<b>Nick</b>` mostrado como texto, **imagem do comprovativo carregada do Storage
privado**, rejeitar com motivo (encomenda, comprovativo e notificação do cliente actualizados), reenvio,
aprovar → processar → concluir, histórico, as 9 páginas em 1366 px e 390 px **sem erros de JavaScript e sem
scroll horizontal**, relatório com a receita correcta, auditoria e lista de clientes.
Este teste encontrou um bug real no painel (o detalhe aberto deixava de se actualizar em tempo real), já corrigido.

### 1.4 Compilação Android
`aapt` (Android 14) compilou todos os recursos e `javac` compilou todo o código contra a API 33 sem erros.
As APIs acima da 21 continuam protegidas por `Build.VERSION.SDK_INT`.

### Não verificado
- Compilação **dentro do CodeAssist**, geração do APK final e execução num telemóvel/emulador Android.
- Um projecto Firebase **real** (produção): o emulador segue as mesmas regras, mas quotas, plano Blaze,
  e-mails reais e domínios autorizados só se confirmam na consola.

## 2. Repetir os testes
```bash
cd firebase/tests
npm install                 # firebase-tools, firebase, @firebase/rules-unit-testing, playwright
npm run test:rules          # 64 casos
npm run test:admin          # 37 casos (precisa de Chromium do Playwright)
# App (JVM): precisa de um android.jar (ANDROID_JAR) e do R.java gerado pelo aapt (GEN_DIR)
ANDROID_JAR=/caminho/android.jar GEN_DIR=/caminho/gen npm run test:android
```

## 3. Testes manuais obrigatórios antes de publicar

**Conta**
- [ ] Onboarding → registo (validações) → e-mail de verificação recebido
- [ ] Login certo/errado; recuperação de palavra-passe pela página do Firebase
- [ ] Barra inferior; ecrã rodado / tablet

**Catálogo e encomenda**
- [ ] Produtos carregam; alterar preço no painel → app mostra o novo preço após actualizar
- [ ] Desactivar produto → desaparece; 26.880 mostra aviso "por encomenda"
- [ ] ID inválido/diferente → erro; confirmar → código gerado → pagamento
- [ ] Sem métodos activos → aviso; copiar IBAN/número/código

**Comprovativo**
- [ ] Galeria JPG/PNG/WEBP aceites; PDF/GIF recusados; câmara com rotação correcta
- [ ] Remover/substituir; > 5 MB comprimida; progresso; sem rede → erro e repetir
- [ ] Ficheiro aparece em Storage → `proofs/<uid>/<encomenda>/`

**Painel e estados**
- [ ] Encomenda aparece em tempo real com som; comprovativo visível
- [ ] Rejeitar com motivo → app mostra motivo e permite reenviar
- [ ] Aprovar → Processar → Concluir → linha temporal da app actualiza sozinha; notificações recebidas
- [ ] Operador não altera produtos/métodos/definições; cliente bloqueado não encomenda

**Notificações**
- [ ] Notificação geral → lista da app e alerta do sistema com a app fechada (≤ ~15 min)
- [ ] Android 13+: pedido de permissão de notificações

**Relatórios e definições**
- [ ] Relatório e CSV; contactos de suporte e WhatsApp com o código; modo de manutenção bloqueia encomendas
