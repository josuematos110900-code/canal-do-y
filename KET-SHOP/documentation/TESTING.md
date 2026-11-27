# Testes

Este documento separa **o que foi verificado automaticamente durante o desenvolvimento** do que
**tem de ser testado por si** num telemóvel e num projecto Supabase real.

## 1. Verificações executadas (e como repetir)

### 1.1 Base de dados — PostgreSQL 16 com *stubs* de `auth` e `storage` do Supabase
- `INSTALL_ALL.sql` executado **duas vezes seguidas** numa base limpa sem erros (idempotente).
- Fluxo completo simulando JWT de 3 utilizadores (cliente A, cliente B, admin):
  - cliente vê 13 produtos e só métodos activos; cria encomenda (`ELT-AAMMDD-XXXXXX`, preço do servidor);
  - `UPDATE orders` directo → **negado**; `admin_update_order_status` por cliente → **negado**;
    `UPDATE profiles set is_blocked` pelo cliente → **negado**;
  - upload para pasta de outro utilizador → **negado (RLS Storage)**; extensão `.exe` → **negada**;
  - upload válido + `submit_payment_proof` → estado `proof_submitted`;
  - cliente B não vê encomendas, comprovativos nem ficheiros do cliente A;
  - admin vê ficheiros; rejeição sem motivo → **negada**; rejeição com motivo → `payment_rejected`;
  - cliente reenvia comprovativo; admin aprova → processamento → concluída;
  - histórico com 7 entradas, comprovativos com estados `rejected`/`approved`, 8 notificações geradas
    automaticamente para o cliente; relatório e dashboard com totais correctos;
  - `update_my_profile` e `cancel_my_order` (recusado em encomenda concluída).
- Limitação: os *stubs* imitam `auth.uid()`, `storage.objects`, `storage.foldername/extension`; o
  comportamento do Storage real (limite de tamanho e MIME do bucket) só é verificável no Supabase.

### 1.2 App Android
- `aapt` (Android 14) compilou **todos os recursos** (manifesto, 36 layouts, drawables, estilos, menus,
  animações, mipmaps) contra o `android.jar` da API 33 (Robolectric `android-all` 13) e gerou `R.java`.
- `javac` compilou os **68 ficheiros Java** (+ `R.java` gerado) contra a API 33 **sem erros**.
- Compilação contra a API 21 para detectar APIs novas: as únicas ocorrências são chamadas protegidas por
  `Build.VERSION.SDK_INT` (canais de notificação, `checkSelfPermission`, `requestPermissions`,
  `ExifInterface(InputStream)`, `FLAG_IMMUTABLE`) e os genéricos de `findViewById` (exigem `compileSdk ≥ 26`).
- Todas as 269 referências `@string`/`R.string` existem em `strings.xml` (sem chaves em falta ou sobrantes).
- **Não verificado:** compilação dentro do CodeAssist, conversão D8/APK final e execução num dispositivo
  ou emulador (não disponíveis no ambiente de desenvolvimento).

### 1.3 Painel Web
- `node --check` em todos os ficheiros JS.
- Playwright/Chromium: as 9 páginas protegidas abertas em **1366×900** e **390×844** com um cliente
  Supabase simulado → **0 erros de JavaScript** e **sem scroll horizontal** em telemóvel.
- Modal de encomenda: acções correctas para `proof_submitted`
  (`under_review, payment_approved, payment_rejected, cancelled`) e nickname `<b>Nick</b>` mostrado
  como texto (sem injecção HTML).
- **Não verificado:** chamadas reais ao Supabase (login, Realtime, URLs assinados).

## 2. Testes manuais obrigatórios antes de publicar

Marque cada item num telemóvel real ligado ao projecto Supabase de produção (ou de testes).

**Navegação e conta**
- [ ] Splash → Onboarding (deslizar e botões) → Login
- [ ] Registo com validação (nome sem apelido, e-mail inválido, palavra-passe fraca, confirmação diferente, termos)
- [ ] Registo com *Confirm email* ligado → mensagem → confirmar → login
- [ ] Login errado → mensagem "E-mail ou palavra-passe incorrectos"
- [ ] Recuperação → e-mail → `reset-password.html` → nova palavra-passe → login
- [ ] Barra inferior: Início, Loja, Pedidos, Alertas, Perfil
- [ ] Rodar o ecrã / tablet (layout sw600dp)

**Catálogo e encomenda**
- [ ] Produtos carregam do Supabase; alterar um preço no painel → aparece na app após actualizar
- [ ] Desactivar produto no painel → desaparece da app
- [ ] Pacote 26.880 mostra aviso "por encomenda"
- [ ] ID com letras / curto / confirmação diferente → erros
- [ ] Confirmar encomenda → código gerado → ecrã de pagamento
- [ ] Sem métodos activos → aviso; método sem dados → botão "Já paguei" desactivado
- [ ] Copiar IBAN / número / código

**Comprovativo**
- [ ] Galeria: JPG, PNG, WEBP aceites; PDF/GIF recusados
- [ ] Câmara: foto tirada, pré-visualização, rotação correcta
- [ ] Remover e substituir imagem
- [ ] Imagem > 5 MB → comprimida automaticamente (ver tamanho mostrado)
- [ ] Barra de progresso durante o envio; voltar atrás bloqueado durante o envio
- [ ] Sem Internet a meio → erro e botão para repetir
- [ ] Sucesso → ecrã de confirmação → estado "Comprovativo enviado"
- [ ] No Supabase Storage: ficheiro em `payment-proofs/<user>/<order>/`

**Painel e estados**
- [ ] Encomenda aparece no painel em tempo real com som
- [ ] Ver comprovativo (miniatura e original)
- [ ] Rejeitar com motivo → app mostra motivo e permite reenviar
- [ ] Aprovar → Processar → Concluir → app actualiza a linha temporal sozinha e recebe notificações
- [ ] Cancelar pela app (pendente) e pelo painel (com motivo)
- [ ] Conta de operador: não consegue alterar produtos/métodos/definições (erro de permissão)
- [ ] Bloquear cliente → não consegue entrar nem encomendar

**Segurança dos ficheiros**
- [ ] Com a sessão do cliente B, tentar abrir o caminho do comprovativo do cliente A → negado
- [ ] Abrir o URL público `.../storage/v1/object/public/payment-proofs/...` → negado (bucket privado)

**Notificações**
- [ ] Notificação geral do painel → aparece na lista e (com a app fechada) como alerta do sistema em ≤ ~15 min
- [ ] Android 13+: pedido de permissão de notificações

**Relatórios e definições**
- [ ] Relatório de 30 dias e exportação CSV
- [ ] Contactos de suporte definidos no painel aparecem na app; WhatsApp abre com o código da encomenda
- [ ] Modo de manutenção → app mostra aviso e o servidor recusa novas encomendas

## 3. Repetir os testes automáticos
Os scripts usados não fazem parte da entrega (dependem do ambiente). Resumo dos comandos:
```bash
# SQL (PostgreSQL local + stubs de auth/storage)
psql -d teste -f stubs.sql && psql -d teste -f supabase/INSTALL_ALL.sql
# Recursos Android
aapt package -f -m -J gen -M app/src/main/AndroidManifest.xml -S app/src/main/res -I android.jar
# Java
javac -source 8 -target 8 -classpath android.jar -d classes $(find app/src/main/java gen -name '*.java')
```
