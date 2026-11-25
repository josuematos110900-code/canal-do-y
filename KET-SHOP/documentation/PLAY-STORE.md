# O que falta para publicar na Google Play

## Técnico (pode ser feito no código)
1. ✅ **Target SDK actual** — feito: targetSdk 36 (Android 16), com ecrã de ponta a ponta e gesto "voltar" tratados.
   Confirmar na Play Console o nível exigido na data da publicação.
2. ✅ **Formato AAB** — gerado no Android Studio (ver `ANDROID_STUDIO.md`, secção 4).
3. **Eliminação de conta por endereço web** (além da opção dentro da app).
4. **Política de Privacidade num URL público**.
5. **Gráfico de destaque 1024×500** (o ícone 512 px está em `android-app/store-assets/`).
6. **Textos da loja** (descrição curta e completa) e **capturas reais** do telemóvel.

## Só a equipa pode fazer
7. **Autorização da Garena / canal legítimo de compra dos diamantes** — o mais importante.
   O uso da marca "Free Fire" sem autorização pode levar à remoção da app e suspensão da conta.
   Consultar um advogado.
8. Confirmar que o modelo de pagamento (transferência, Multicaixa Express…) é aceite pela política de
   pagamentos da Google Play.
9. **Conta de programador Google Play** (25 USD, verificação de identidade). Contas pessoais novas:
   teste fechado com **12 testadores durante 14 dias** antes da produção.
10. Backend real configurado (ver PASSO-A-PASSO-BASE-DE-DADOS.md) e dados bancários reais no painel.
11. **Teste completo num telemóvel real** (ver TESTING.md).
12. Questionários da Play Console: **Segurança dos dados**, **Classificação de conteúdo**, **Público-alvo**.
13. Aspectos legais em Angola: empresa, facturação, revisão dos Termos/Privacidade, protecção de dados.

## Recomendado
Notificações push instantâneas (FCM), protecção contra abuso (App Check / CAPTCHA), relatórios de falhas.
