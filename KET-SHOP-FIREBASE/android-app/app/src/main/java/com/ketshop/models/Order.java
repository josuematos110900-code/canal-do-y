package com.ketshop.models;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class Order implements Serializable {
    public String id;
    public String orderCode;
    public OrderStatus status;
    public String game;
    public String playerId;
    public String playerNickname;
    public double totalKz;
    public String paymentMethodId;
    public String paymentSnapshotJson;
    public String customerNotes;
    public String rejectionReason;
    public String cancelReason;
    public boolean onDemand;
    public String createdAt;
    public String updatedAt;
    public final List<OrderItem> items = new ArrayList<>();

    public static Order fromJson(JSONObject o) {
        Order r = new Order();
        r.id = JsonUtil.str(o, "id");
        r.orderCode = JsonUtil.str(o, "order_code", "");
        r.status = OrderStatus.from(JsonUtil.str(o, "status", "pending_payment"));
        r.game = JsonUtil.str(o, "game", "Free Fire");
        r.playerId = JsonUtil.str(o, "player_id", "");
        r.playerNickname = JsonUtil.str(o, "player_nickname");
        r.totalKz = JsonUtil.dbl(o, "total_kz");
        r.paymentMethodId = JsonUtil.str(o, "payment_method_id");
        JSONObject snap = o.optJSONObject("payment_method_snapshot");
        r.paymentSnapshotJson = snap != null ? snap.toString() : null;
        r.customerNotes = JsonUtil.str(o, "customer_notes");
        r.rejectionReason = JsonUtil.str(o, "rejection_reason");
        r.cancelReason = JsonUtil.str(o, "cancel_reason");
        r.onDemand = o.optBoolean("is_on_demand");
        r.createdAt = JsonUtil.str(o, "created_at", "");
        r.updatedAt = JsonUtil.str(o, "updated_at", "");
        JSONArray items = o.optJSONArray("order_items");
        if (items != null) {
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                if (it != null) r.items.add(OrderItem.fromJson(it));
            }
        }
        return r;
    }

    public String productTitle() {
        return items.isEmpty() ? "Encomenda" : items.get(0).productName;
    }

    /** Dados do método de pagamento escolhido (snapshot no momento da escolha). */
    public PaymentMethod paymentMethod() {
        if (paymentSnapshotJson == null) return null;
        try {
            return PaymentMethod.fromJson(new JSONObject(paymentSnapshotJson));
        } catch (Exception e) {
            return null;
        }
    }
}
