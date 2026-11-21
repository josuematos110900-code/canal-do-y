/* =====================================================================
   KET SHOP — Configuração do painel (Firebase)
   Consola Firebase -> ⚙ Definições do projecto -> Geral -> "As suas apps"
   -> app Web (</>) -> copiar o objecto firebaseConfig.
   Estes valores são públicos por definição; a segurança está nas
   Security Rules (firebase/firestore.rules e storage.rules).
   NUNCA coloque aqui chaves de conta de serviço (service account).
   ===================================================================== */
window.KETSHOP_CONFIG = {
  firebase: {
    apiKey: "COLE_AQUI_A_API_KEY",
    authDomain: "seu-projecto-id.firebaseapp.com",
    projectId: "seu-projecto-id",
    storageBucket: "seu-projecto-id.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000"
  },
  // Apenas para testes locais com o Firebase Emulator Suite
  USE_EMULATORS: false
};
