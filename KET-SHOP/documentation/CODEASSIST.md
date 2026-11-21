# Abrir e compilar no CodeAssist (Android)

## Porque é que o projecto é compatível

| Decisão | Motivo |
|---|---|
| **Zero dependências externas** (`dependencies {}` vazio) | O CodeAssist não precisa de descarregar nada do Maven; evita falhas de resolução de bibliotecas no telemóvel. |
| Tema `android:Theme.Material.NoActionBar` (framework) | Material Design sem AppCompat/MaterialComponents. |
| `ListView`/`GridView` + `BaseAdapter` | Sem RecyclerView (AndroidX). |
| `HttpURLConnection` + `org.json` | Sem OkHttp/Retrofit/Gson. |
| `ProofFileProvider` próprio | Sem `androidx.core.content.FileProvider` para a câmara. |
| `JobScheduler` (API 21) | Sem WorkManager. |
| Java 8 (lambdas) | O CodeAssist compila com D8, que converte lambdas para Android. |
| Layouts XML, ícones vectoriais simples, sem gradientes em vectores | Compatível com API 21. |

Requisitos de compilação: **`compileSdk` 26 ou superior** (o projecto declara 33). As chamadas a APIs
mais recentes que a 21 estão todas protegidas por `Build.VERSION.SDK_INT`.

## 1. Copiar o projecto para o telemóvel

1. Transfira `KET-SHOP-COMPLETO.zip` para o telemóvel.
2. Extraia com um gestor de ficheiros que suporte ZIP (ex.: ZArchiver, MiXplorer ou o gestor do sistema),
   ou no Termux:
   ```bash
   termux-setup-storage
   cd ~/storage/downloads && unzip KET-SHOP-COMPLETO.zip
   ```
3. Copie a pasta **`KET-SHOP/android-app`** para a pasta de projectos do CodeAssist
   (normalmente `Armazenamento interno/CodeAssistProjects/`). Pode renomeá-la para `KetShop`.

## 2. Configurar o Supabase (obrigatório)

Edite `app/src/main/java/com/ketshop/network/SupabaseConfig.java`:

```java
public static final String SUPABASE_URL = "https://abcdefghijkl.supabase.co";   // Project URL
public static final String SUPABASE_ANON_KEY = "eyJhbGciOi...";                  // anon public
public static final String PASSWORD_RESET_REDIRECT_URL = "https://o-seu-painel/reset-password.html";
```

- Valores em **Supabase → Project Settings → API** (pode aparecer como *Data API* / *API Keys*).
- Use a chave **anon / publishable**. **Nunca** a `service_role` / *secret*.
- Enquanto estes valores não forem preenchidos, a app mostra no arranque uma mensagem a explicar.

## 3. Abrir e compilar

1. Abra o CodeAssist → abrir projecto existente → escolha a pasta `android-app` (ou `KetShop`).
2. Aguarde a indexação. Como não há dependências, não deve haver downloads.
3. Use **Run / Build** para gerar o APK de depuração e instalar.

Os nomes exactos dos menus mudam entre versões do CodeAssist. Se a sua versão pedir um módulo,
o módulo é `app`, o pacote é `com.ketshop` e a Activity de arranque é `.activities.SplashActivity`.

## 4. Problemas frequentes

| Sintoma | Causa provável / solução |
|---|---|
| `cannot find symbol NotificationChannel` ou erros em `findViewById` | O `android.jar` do CodeAssist é inferior a API 26. Actualize o CodeAssist/SDK interno ou use `compileSdk` ≥ 26. |
| Erro em lambdas (`->`) | Versão muito antiga do CodeAssist sem D8. Actualize o CodeAssist. |
| `namespace` não reconhecido em `app/build.gradle` | Versões antigas do plugin ignoram `namespace`; pode remover essa linha (o pacote está no `AndroidManifest.xml`). |
| A app abre e diz "não está ligada ao Supabase" | Preencha `SupabaseConfig.java` e recompile. |
| "Recurso não encontrado" ao entrar | O SQL não foi instalado no Supabase (ver SUPABASE.md). |
| Login funciona mas a app diz "Perfil não encontrado" | A conta foi criada antes de instalar o SQL; execute no SQL Editor: `insert into public.profiles(id,email) select id,email from auth.users on conflict do nothing; insert into public.user_roles(user_id,role) select id,'customer' from auth.users on conflict do nothing;` |
| A câmara não abre | O telemóvel não tem app de câmara compatível com `ACTION_IMAGE_CAPTURE`; use a Galeria. |

## 5. Ficheiros que normalmente vai editar

| Ficheiro | Para quê |
|---|---|
| `network/SupabaseConfig.java` | URL e chave anon |
| `res/values/colors.xml` | Cores (preto, roxo escuro, neon) |
| `res/values/strings.xml` | Todos os textos da interface |
| `app/build.gradle` | `versionCode`/`versionName` a cada nova versão |
| `assets/terms.txt`, `assets/privacy.txt` | Textos legais de reserva (o painel pode substituí-los) |

> Preços, produtos, métodos de pagamento, contactos de suporte e avisos **não** estão no APK:
> alteram-se no painel e a app lê-os do Supabase.
