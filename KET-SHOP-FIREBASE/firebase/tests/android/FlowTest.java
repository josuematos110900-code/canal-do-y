package test;

import android.content.SharedPreferences;
import com.ketshop.managers.SessionManager;
import com.ketshop.models.*;
import com.ketshop.network.*;
import com.ketshop.repositories.*;
import com.ketshop.utils.ImageUtils;
import org.json.JSONObject;
import java.lang.reflect.*;
import java.util.*;

public class FlowTest {
    static int pass = 0, fail = 0;
    interface Step { void run() throws Exception; }
    static void t(String name, Step s) {
        try { s.run(); pass++; System.out.println("  ok    " + name); }
        catch (Throwable e) { fail++; System.out.println("  FALHA " + name + " - " + e); }
    }
    static void expectFail(String name, Step s) {
        try { s.run(); fail++; System.out.println("  FALHA " + name + " - devia ter sido recusado"); }
        catch (Throwable e) { pass++; System.out.println("  ok    " + name + "  [" + e.getMessage() + "]"); }
    }
    static void check(boolean c, String msg) { if (!c) throw new AssertionError(msg); }

    /** SharedPreferences em memória (substitui o Android). */
    static class MemPrefs implements SharedPreferences {
        final Map<String, Object> m = new HashMap<>();
        public Map<String, ?> getAll() { return m; }
        public String getString(String k, String d) { return m.containsKey(k) ? (String) m.get(k) : d; }
        public Set<String> getStringSet(String k, Set<String> d) { return d; }
        public int getInt(String k, int d) { return m.containsKey(k) ? (Integer) m.get(k) : d; }
        public long getLong(String k, long d) { return m.containsKey(k) ? (Long) m.get(k) : d; }
        public float getFloat(String k, float d) { return d; }
        public boolean getBoolean(String k, boolean d) { return m.containsKey(k) ? (Boolean) m.get(k) : d; }
        public boolean contains(String k) { return m.containsKey(k); }
        public Editor edit() {
            return new Editor() {
                public Editor putString(String k, String v) { m.put(k, v); return this; }
                public Editor putStringSet(String k, Set<String> v) { return this; }
                public Editor putInt(String k, int v) { m.put(k, v); return this; }
                public Editor putLong(String k, long v) { m.put(k, v); return this; }
                public Editor putFloat(String k, float v) { return this; }
                public Editor putBoolean(String k, boolean v) { m.put(k, v); return this; }
                public Editor remove(String k) { m.remove(k); return this; }
                public Editor clear() { m.clear(); return this; }
                public boolean commit() { return true; }
                public void apply() { }
            };
        }
        public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener l) { }
        public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener l) { }
    }

    static void installSession() throws Exception {
        Field uf = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe"); uf.setAccessible(true);
        Object unsafe = uf.get(null);
        Object sm = unsafe.getClass().getMethod("allocateInstance", Class.class).invoke(unsafe, SessionManager.class);
        for (String f : new String[]{"prefs", "lock"}) {
            Field fl = SessionManager.class.getDeclaredField(f); fl.setAccessible(true);
            fl.set(sm, f.equals("prefs") ? new MemPrefs() : new Object());
        }
        Field inst = SessionManager.class.getDeclaredField("instance"); inst.setAccessible(true); inst.set(null, sm);
    }

    static ImageUtils.PreparedImage image(byte[] bytes, String mime, String ext) throws Exception {
        Constructor<ImageUtils.PreparedImage> c = ImageUtils.PreparedImage.class.getDeclaredConstructor(
            byte[].class, String.class, String.class, String.class, android.graphics.Bitmap.class);
        c.setAccessible(true);
        return c.newInstance(bytes, mime, ext, "comprovativo." + ext, null);
    }

    public static void main(String[] a) throws Exception {
        installSession();
        SessionManager s = SessionManager.get();

        System.out.println("Conta");
        t("registo cria conta + perfil users/{uid}", () -> {
            check(AuthRepository.signUp("Cliente Teste", "+244923456789", "cliente@teste.ao", "Senha1234"), "signUp");
            Profile p = ProfileRepository.getMyProfile();
            check(p.fullName.equals("Cliente Teste") && !p.blocked, "perfil " + p.fullName);
        });
        t("terminar e iniciar sessão", () -> { AuthRepository.signOut(); check(!s.isLoggedIn(), "logout");
            AuthRepository.signIn("cliente@teste.ao", "Senha1234"); check(s.isLoggedIn(), "login"); });
        expectFail("palavra-passe errada", () -> AuthRepository.signIn("cliente@teste.ao", "errada999"));
        t("re-login", () -> AuthRepository.signIn("cliente@teste.ao", "Senha1234"));
        t("renovação do token (refresh)", () -> check(s.forceRefresh() != null, "refresh"));
        t("editar perfil", () -> check(ProfileRepository.updateMyProfile("Cliente Editado", "+244 912345678").fullName.equals("Cliente Editado"), "nome"));

        System.out.println("Catálogo");
        final List<Product> prods = new ArrayList<>();
        t("produtos activos carregados e ordenados", () -> { prods.addAll(ProductRepository.products(null));
            check(prods.size() == 2 && prods.get(0).name.equals("78 Diamantes") && prods.get(0).categoryName.equals("Diamantes"), "lista " + prods.size()); });
        t("destaques", () -> check(ProductRepository.featured().size() == 1, "featured"));
        t("categorias", () -> check(ProductRepository.categories().size() == 1, "cats"));
        expectFail("produto inactivo não é devolvido", () -> ProductRepository.product("off"));
        t("métodos activos", () -> check(PaymentRepository.activeMethods().size() == 1, "pm"));
        t("definições públicas", () -> check(SettingsRepository.getString(SettingsRepository.publicSettings(true), "store_name").equals("KET SHOP"), "settings"));

        System.out.println("Encomenda e comprovativo");
        final Order[] ord = new Order[1];
        t("criar encomenda (preço do servidor, código KET-…)", () -> {
            ord[0] = OrderRepository.create("p120", "123456789", "Nick", "obs");
            check(ord[0].orderCode.matches("KET-\\d{6}-[A-Z0-9]{6}") && ord[0].totalKz == 1050 && ord[0].status == OrderStatus.PENDING_PAYMENT, "ordem");
            check(ord[0].items.size() == 1 && ord[0].items.get(0).totalAmount == 120, "itens");
        });
        expectFail("preço adulterado directamente na API é recusado", () -> {
            JSONObject o = new JSONObject(); o.put("order_code", "KET-261121-ZZZZZZ"); o.put("user_id", s.getUserId());
            o.put("status", "pending_payment"); o.put("game", "Free Fire"); o.put("player_id", "123456789"); o.put("product_id", "p120");
            o.put("order_items", Json.arr(Json.of("product_id", "p120", "product_name", "120 Diamantes", "quantity", 1, "unit_price_kz", 1, "line_total_kz", 1, "total_amount", 120)));
            o.put("subtotal_kz", 1); o.put("total_kz", 1); o.put("payment_method_id", JSONObject.NULL); o.put("payment_method_snapshot", JSONObject.NULL);
            o.put("is_on_demand", false); o.put("proof_count", 0);
            Firestore.commit(Firestore.Write.create("orders/KET-261121-ZZZZZZ", o).serverTime("created_at", "updated_at"));
        });
        t("histórico inicial", () -> check(OrderRepository.history(ord[0].id).size() == 1, "hist"));
        expectFail("submeter comprovativo sem método é recusado", () -> ProofRepository.submit(ord[0].id, "proofs/x/y/z.jpg", image(new byte[]{1}, "image/jpeg", "jpg")));
        t("escolher método (snapshot validado pelas regras)", () -> {
            Order o = OrderRepository.setPaymentMethod(ord[0].id, "iban");
            check(o.paymentMethod() != null && o.paymentMethod().iban.startsWith("AO06"), "snapshot");
        });
        final String[] path = new String[1];
        final ImageUtils.PreparedImage img = image(new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, 1, 2, 3, 4}, "image/jpeg", "jpg");
        t("upload para Storage privado com progresso", () -> {
            final long[] last = {0};
            path[0] = ProofRepository.upload(ord[0].id, img, (sent, total) -> last[0] = sent);
            check(path[0].startsWith("proofs/" + s.getUserId() + "/" + ord[0].id + "/") && last[0] == 7, "upload " + last[0]);
        });
        t("registar comprovativo -> Comprovativo enviado", () -> {
            ProofRepository.submit(ord[0].id, path[0], img);
            check(OrderRepository.get(ord[0].id).status == OrderStatus.PROOF_SUBMITTED, "estado");
            check(ProofRepository.forOrder(ord[0].id).size() == 1, "proofs");
            check(OrderRepository.history(ord[0].id).size() == 2, "hist2");
        });
        t("descarregar o próprio comprovativo", () -> check(ProofRepository.download(path[0]).length == 7, "download"));
        expectFail("cancelar após envio é recusado", () -> OrderRepository.cancel(ord[0].id, "x"));

        System.out.println("Notificações e histórico");
        t("2 notificações automáticas (recebida + comprovativo)", () -> check(NotificationRepository.list(50).size() == 2, "n=" + NotificationRepository.list(50).size()));
        t("contagem de não lidas = 2", () -> check(NotificationRepository.unreadCount() == 2, "unread"));
        t("unreadSince para o serviço em segundo plano", () -> check(NotificationRepository.unreadSince("", 5).size() == 2, "since"));
        t("marcar todas como lidas", () -> { NotificationRepository.markAllRead(); check(NotificationRepository.unreadCount() == 0, "0"); });
        t("apagar notificação", () -> { NotificationRepository.delete(NotificationRepository.list(50).get(0).id); check(NotificationRepository.list(50).size() == 1, "del"); });
        final Order[] o2 = new Order[1];
        t("segunda encomenda + cancelar", () -> { o2[0] = OrderRepository.create("p78", "987654321", null, null);
            check(OrderRepository.cancel(o2[0].id, null).status == OrderStatus.CANCELLED, "cancel"); });
        t("histórico filtrado e estatísticas", () -> {
            check(OrderRepository.myOrders(OrderRepository.FILTER_ALL, 10).size() == 2, "all");
            check(OrderRepository.myOrders(OrderRepository.FILTER_CANCELLED, 10).size() == 1, "cancelled");
            int[] st = ProfileRepository.myOrderStats(); check(st[0] == 2 && st[2] == 1, Arrays.toString(st));
            check(OrderRepository.latestActive().id.equals(ord[0].id), "latest");
        });

        System.out.println("Segurança entre clientes");
        final String orderA = ord[0].id, pathA = path[0];
        t("segundo cliente regista-se", () -> { AuthRepository.signOut(); AuthRepository.signUp("Outro Cliente", "", "outro@teste.ao", "Senha5678"); });
        expectFail("B não lê a encomenda de A", () -> OrderRepository.get(orderA));
        expectFail("B não descarrega o comprovativo de A", () -> ProofRepository.download(pathA));
        t("B não vê encomendas de A na sua lista", () -> check(OrderRepository.myOrders(0, 10).isEmpty(), "lista"));
        t("mudar palavra-passe", () -> { AuthRepository.changePassword("NovaSenha99"); AuthRepository.signOut(); AuthRepository.signIn("outro@teste.ao", "NovaSenha99"); });
        t("eliminar conta (perfil + autenticação)", () -> { AuthRepository.deleteAccount(); check(!s.isLoggedIn(), "sessão"); });
        expectFail("conta eliminada já não entra", () -> AuthRepository.signIn("outro@teste.ao", "NovaSenha99"));
        t("recuperação de palavra-passe (e-mail enviado)", () -> AuthRepository.sendPasswordReset("cliente@teste.ao"));

        System.out.println("\n" + pass + " passaram, " + fail + " falharam");
        System.exit(fail == 0 ? 0 : 1);
    }
}
