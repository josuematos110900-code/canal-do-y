# Abrir, testar e publicar a app no Android Studio

## Configuração do projecto
| Item | Valor |
|---|---|
| Pasta a abrir | `android-app/` |
| Gradle (wrapper) | 8.14.3 (`gradlew`, já incluído) |
| Android Gradle Plugin | 8.13.0 |
| compileSdk / targetSdk | 36 (Android 16) |
| minSdk | 21 (Android 5.0) |
| JDK | 17 ou superior (o Android Studio traz o seu) |
| Bibliotecas externas | nenhuma |
| Supabase | já configurado em `network/SupabaseConfig.java` |

## 1. Abrir
1. Instalar o **Android Studio** (versão recente).
2. **File → Open** → escolher a pasta **`android-app`** (não a pasta `KET-SHOP`).
3. Aguardar o *Gradle Sync*. Na primeira vez o Android Studio descarrega o Gradle, o plugin e a plataforma
   Android 36 (pode demorar). Se pedir para instalar o *SDK Platform 36*, aceite.
4. Se o Android Studio sugerir actualizar o plugin (AGP Upgrade Assistant), pode aceitar.

## 2. Executar num telemóvel
1. No telemóvel: **Definições → Sobre o telefone → tocar 7 vezes em "Número de compilação"** → activa as
   Opções de programador → activar **Depuração USB**.
2. Ligar por cabo ao computador e aceitar a autorização no telemóvel.
3. No Android Studio escolher o telemóvel na barra superior → **Run ▶**.

Também pode usar um emulador: **Device Manager → Create device** (ex.: Pixel, Android 16).

## 3. Testar o fluxo completo
Antes de testar, a base de dados tem de estar instalada (ver `PASSO-A-PASSO-BASE-DE-DADOS.md`).
Registo → produtos → encomenda → pagamento → comprovativo → aprovar no painel → ver estado e notificação na app.
Lista completa em `TESTING.md`.

## 4. Gerar o ficheiro para a Play Store (AAB)
1. **Build → Generate Signed App Bundle or APK… → Android App Bundle**.
2. **Create new…** keystore (primeira vez):
   - guarde o ficheiro `.jks` e as palavras-passe em local seguro e com cópia de segurança;
   - **se perder a chave não consegue actualizar a app** (a não ser com a *Play App Signing* activa).
3. Escolher **release** → Finish. O ficheiro fica em `app/release/app-release.aab`.
4. Na Play Console, activar a **Play App Signing** (recomendado) e carregar o `.aab`.

Alternativa sem janelas: criar `android-app/keystore.properties` (nunca o envie para o Git):
```
storeFile=/caminho/ketshop-release.jks
storePassword=...
keyAlias=ketshop
keyPassword=...
```
e executar `./gradlew bundleRelease` (Windows: `gradlew.bat bundleRelease`).

## 5. A cada nova versão
Em `app/build.gradle` aumentar `versionCode` (1, 2, 3…) e `versionName` ("1.0.1"…).
Para obrigar os clientes a actualizar: Painel → Configurações → versionCode mínimo.

## O que foi adaptado para o Android 15/16
- **Ecrã de ponta a ponta:** a partir do Android 15 a app desenha por baixo das barras do sistema;
  `BaseActivity` afasta o conteúdo da barra de estado, da barra de navegação e do teclado.
- **Gesto "voltar" preditivo:** activado; durante o envio do comprovativo o gesto fica bloqueado.
- **Manifesto:** sem atributo `package` (o pacote é o `namespace` do Gradle) e sem bloqueio de orientação
  (o Android 16 ignora-o em tablets).

## Problemas frequentes
| Sintoma | Solução |
|---|---|
| `SDK location not found` | Abrir pela opção File → Open (o Studio cria `local.properties`) |
| `Unsupported class file major version` / erro de JDK | File → Settings → Build Tools → Gradle → Gradle JDK = versão 17+ (a do Studio) |
| `Failed to find target android-36` | Tools → SDK Manager → instalar *Android 16 (API 36)* |
| A app diz "Recurso não encontrado" ao entrar | A base de dados não foi instalada nesse projecto Supabase |
| Login funciona mas "Perfil não encontrado" | Ver a solução em `PASSO-A-PASSO-BASE-DE-DADOS.md` (erros comuns) |
