package com.ketshop.repositories;

import com.ketshop.models.Order;
import com.ketshop.models.OrderStatus;
import com.ketshop.models.Product;
import com.ketshop.models.StatusHistoryEntry;
import com.ketshop.network.ApiException;
import com.ketshop.network.Firestore;
import com.ketshop.network.Json;

import org.json.JSONObject;

import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/**
 * Encomendas no Firestore. Cada alteração é um commit atómico que inclui o
 * histórico de estados e a notificação. As Security Rules validam preço,
 * dono, estado e transições — a app não consegue contorná-las.
 */
public final class OrderRepository {

    public static final int FILTER_ALL = 0;
    public static final int FILTER_ACTIVE = 1;
    public static final int FILTER_COMPLETED = 2;
    public static final int FILTER_CANCELLED = 3;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private OrderRepository() { }

    /** KET-AAMMDD-XXXXXX (data de Luanda). É também o ID do documento. */
    static String newOrderCode() {
        SimpleDateFormat f = new SimpleDateFormat("yyMMdd", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("Africa/Luanda"));
        StringBuilder sb = new StringBuilder("KET-").append(f.format(new Date())).append('-');
        for (int i = 0; i < 6; i++) sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
        return sb.toString();
    }

    static Firestore.Write historyWrite(String orderId, String oldStatus, String newStatus, String note) throws ApiException {
        return Firestore.Write.create("orders/" + orderId + "/history/" + Firestore.newId(), Json.of(
                "old_status", oldStatus, "new_status", newStatus, "note", note,
                "changed_by", ProfileRepository.uid())).serverTime("created_at");
    }

    static Firestore.Write notificationWrite(String type, String title, String body, String orderId) throws ApiException {
        String uid = ProfileRepository.uid();
        return Firestore.Write.create("notifications/" + Firestore.newId(), Json.of(
                "user_id", uid, "type", type, "title", title, "body", body, "order_id", orderId,
                "is_read", false, "created_by", uid)).serverTime("created_at");
    }

    public static Order create(String productId, String playerId, String nickname, String notes) throws ApiException {
        // Pré-verificações para mensagens claras (as regras voltam a verificar tudo no servidor)
        Map<String, Object> settings = SettingsRepository.publicSettings(true);
        if (SettingsRepository.getBool(settings, "maintenance_mode")) {
            String msg = SettingsRepository.getString(settings, "maintenance_message");
            throw ApiException.validation(msg.isEmpty() ? "A loja está em manutenção. Tente mais tarde." : msg);
        }
        if (ProfileRepository.getMyProfile().blocked) {
            throw ApiException.validation("A sua conta está bloqueada. Contacte o suporte.");
        }
        int open = 0;
        for (Order o : myOrders(FILTER_ACTIVE, 500)) if (o.status.cancellableByCustomer()) open++;
        if (open >= 5) throw ApiException.validation("Tem demasiadas encomendas por pagar. Pague ou cancele uma antes de criar outra.");

        Product p = ProductRepository.product(productId);
        String code = newOrderCode();
        JSONObject item = Json.of(
                "product_id", p.id, "product_name", p.name, "quantity", 1,
                "unit_price_kz", p.priceKz, "line_total_kz", p.priceKz, "total_amount", p.totalAmount,
                "product_snapshot", Json.of("base_amount", p.baseAmount, "bonus_amount", p.bonusAmount,
                        "unit_label", p.unitLabel, "category", p.categoryName));
        JSONObject order = Json.of(
                "order_code", code, "user_id", ProfileRepository.uid(), "status", OrderStatus.PENDING_PAYMENT.code,
                "game", p.game, "player_id", playerId, "player_nickname", Json.nullIfEmpty(nickname),
                "product_id", p.id, "order_items", Json.arr(item),
                "subtotal_kz", p.priceKz, "total_kz", p.priceKz,
                "payment_method_id", null, "payment_method_snapshot", null,
                "customer_notes", Json.nullIfEmpty(notes), "is_on_demand", p.onDemand, "proof_count", 0);
        try {
            Firestore.commit(
                    Firestore.Write.create("orders/" + code, order).serverTime("created_at", "updated_at"),
                    historyWrite(code, null, OrderStatus.PENDING_PAYMENT.code, "Encomenda criada"),
                    notificationWrite("order_created", "Encomenda recebida",
                            "A encomenda " + code + " (" + p.name + ") foi registada. Efectue o pagamento e envie o comprovativo na app.", code));
        } catch (ApiException e) {
            if (e.isPermissionDenied()) {
                throw ApiException.validation("Não foi possível criar a encomenda: o preço ou a disponibilidade do produto mudou. Actualize e tente novamente.");
            }
            throw e;
        }
        ProfileRepository.saveLastPlayerId(playerId);
        return get(code);
    }

    /** Escolhe o método e grava uma cópia exacta dos dados (as regras comparam com o original). */
    public static Order setPaymentMethod(String orderId, String methodId) throws ApiException {
        JSONObject pm = Firestore.get("paymentMethods/" + methodId);
        if (pm == null || !pm.optBoolean("is_active")) throw ApiException.validation("Método de pagamento indisponível.");
        JSONObject snapshot = Json.of("id", methodId, "type", pm.optString("type"), "name", pm.optString("name"));
        String[] keys = {"iban", "phone_number", "entity", "reference", "account_number", "account_holder", "bank_name", "instructions"};
        for (String k : keys) {
            Object v = pm.opt(k);
            try {
                snapshot.put(k, v == null ? JSONObject.NULL : v);
            } catch (Exception ignored) {
                // chave fixa
            }
        }
        Firestore.commit(Firestore.Write.update("orders/" + orderId,
                Json.of("payment_method_id", methodId, "payment_method_snapshot", snapshot)).serverTime("updated_at"));
        return get(orderId);
    }

    public static Order get(String orderId) throws ApiException {
        JSONObject o = Firestore.get("orders/" + orderId);
        if (o == null) throw ApiException.validation("Encomenda não encontrada.");
        return Order.fromJson(o);
    }

    /** Encomendas do utilizador (filtro e ordenação no telemóvel: sem índices compostos). */
    public static List<Order> myOrders(int filter, int limit) throws ApiException {
        List<Order> out = new ArrayList<>();
        for (JSONObject o : Firestore.query(new Firestore.Query("orders").whereEq("user_id", ProfileRepository.uid()))) {
            Order order = Order.fromJson(o);
            boolean keep;
            switch (filter) {
                case FILTER_ACTIVE: keep = order.status.isActive(); break;
                case FILTER_COMPLETED: keep = order.status == OrderStatus.COMPLETED; break;
                case FILTER_CANCELLED: keep = order.status == OrderStatus.CANCELLED; break;
                default: keep = true;
            }
            if (keep) out.add(order);
        }
        Collections.sort(out, (a, b) -> b.createdAt.compareTo(a.createdAt));
        return out.size() > limit ? new ArrayList<>(out.subList(0, limit)) : out;
    }

    public static Order latestActive() throws ApiException {
        List<Order> l = myOrders(FILTER_ACTIVE, 1);
        return l.isEmpty() ? null : l.get(0);
    }

    public static List<StatusHistoryEntry> history(String orderId) throws ApiException {
        List<StatusHistoryEntry> out = new ArrayList<>();
        for (JSONObject o : Firestore.query(new Firestore.Query("history").parent("orders/" + orderId).orderBy("created_at", false))) {
            out.add(StatusHistoryEntry.fromJson(o));
        }
        return out;
    }

    public static Order cancel(String orderId, String reason) throws ApiException {
        Order current = get(orderId);
        if (!current.status.cancellableByCustomer()) {
            throw ApiException.validation("Esta encomenda já não pode ser cancelada pelo cliente.");
        }
        String r = reason == null || reason.trim().isEmpty() ? "Cancelada pelo cliente" : reason.trim();
        if (r.length() > 500) r = r.substring(0, 500);
        Firestore.commit(
                Firestore.Write.update("orders/" + orderId, Json.of("status", OrderStatus.CANCELLED.code, "cancel_reason", r))
                        .serverTime("updated_at", "cancelled_at"),
                historyWrite(orderId, current.status.code, OrderStatus.CANCELLED.code, r),
                notificationWrite("order_status", "Encomenda cancelada", "A encomenda " + orderId + " foi cancelada. Motivo: " + r + ".", orderId));
        return get(orderId);
    }
}
