# Gerar o APK

## A) No CodeAssist (telemóvel)
1. Siga [CODEASSIST.md](CODEASSIST.md) (copiar projecto + `FirebaseConfig.java`).
2. **Build / Run** → o CodeAssist compila, assina com chave de depuração e instala.
3. O APK de depuração serve para testes. Para distribuir a clientes, gere um APK **assinado com a sua
   chave de release** (secção C), porque um APK de depuração não pode ser actualizado por cima
   de forma fiável noutros dispositivos e não é aceite pela Play Store.

Antes de cada versão nova, aumente `versionCode` (e `versionName`) em `app/build.gradle`. Se quiser
obrigar os clientes a actualizar, coloque o novo `versionCode` em **Painel → Configurações →
versionCode mínimo**.

## B) Num computador (Android Studio ou Gradle)
O projecto também é um projecto Gradle normal.
1. Android Studio → *Open* → pasta `android-app`. O Android Studio cria o *Gradle wrapper* e
   descarrega o plugin indicado em `build.gradle` (AGP 7.4.2; pode actualizar se o Studio sugerir).
2. *Build → Generate Signed Bundle / APK* → APK → crie/escolha o *keystore* → *release*.

## C) Assinar um APK manualmente (Termux ou computador)
```bash
# 1x: criar keystore (guarde-o e à palavra-passe em local seguro!)
keytool -genkeypair -v -keystore ketshop-release.jks -alias ketshop -keyalg RSA -keysize 2048 -validity 10000

# alinhar e assinar
zipalign -v -p 4 app-release-unsigned.apk app-aligned.apk
apksigner sign --ks ketshop-release.jks --out KET-SHOP-1.0.0.apk app-aligned.apk
apksigner verify KET-SHOP-1.0.0.apk
```
No Termux: `pkg install openjdk-17 aapt apksigner` (os nomes dos pacotes podem variar).

## Lista de verificação antes de distribuir
- [ ] `FirebaseConfig.java` com a chave da API Web, o ID do projecto e o bucket de produção
- [ ] Security Rules do Firestore e do Storage publicadas; primeiro admin em `roles/{uid}`
- [ ] Catálogo inicial carregado no painel e preços revistos
- [ ] Métodos de pagamento com dados reais e activos
- [ ] Contactos de suporte preenchidos no painel
- [ ] Termos e Privacidade revistos e publicados no painel
- [ ] `versionCode` incrementado
- [ ] Teste completo da [TESTING.md](TESTING.md) num telemóvel real
