package com.ketshop.repositories;

import com.ketshop.managers.SessionManager;
import com.ketshop.models.Order;
import com.ketshop.models.StatusHistoryEntry;
import com.ketshop.network.ApiException;
import com.ketshop.network.SupabaseClient;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Encomendas. A criação e as mudanças de estado passam por funções RPC
 * no servidor (o preço é lido da base de dados, nunca enviado pela app).
 */
public final class OrderRepository {

    public static final int FILTER_ALL = 0;
    public static final int FILTER_ACTIVE = 1;
    public static final int FILTER_COMPLETED = 2;
    public static final int FILTER_CANCELLED = 3;

    private static final String ORDER_SELECT = "select=*,order_items(*)";

    private OrderRepository() { }

    public static Order create(String productId, String playerId, String nickname, String notes) throws ApiException {
        JSONObject args = new JSONObject();
        try {
            args.put("p_product_id", productId);
            args.put("p_player_id", playerId);
            args.put("p_player_nickname", nickname == null ? JSONObject.NULL : nickname);
            args.put("p_customer_notes", notes == null ? JSONObject.NULL : notes);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        JSONObject o = SupabaseClient.rpcObject("create_order", args);
        String id = o.optString("id", "");
        if (id.isEmpty()) throw ApiException.validation("Não foi possível criar a encomenda.");
        return get(id);
    }

    public static Order setPaymentMethod(String orderId, String methodId) throws ApiException {
        JSONObject args = new JSONObject();
        try {
            args.put("p_order_id", orderId);
            args.put("p_payment_method_id", methodId);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        SupabaseClient.rpcObject("set_order_payment_method", args);
        return get(orderId);
    }

    public static Order get(String orderId) throws ApiException {
        JSONArray a = SupabaseClient.select("orders?" + ORDER_SELECT + "&id=eq." + SupabaseClient.enc(orderId));
        if (a.length() == 0) throw ApiException.validation("Encomenda não encontrada.");
        return Order.fromJson(a.optJSONObject(0));
    }

    public static List<Order> myOrders(int filter, int limit) throws ApiException {
        String uid = SessionManager.get().getUserId();
        if (uid == null) throw ApiException.sessionExpired();
        String q = "orders?" + ORDER_SELECT + "&user_id=eq." + SupabaseClient.enc(uid)
                + "&order=created_at.desc&limit=" + limit;
        switch (filter) {
            case FILTER_ACTIVE:
                q += "&status=not.in.(completed,cancelled)";
                break;
            case FILTER_COMPLETED:
                q += "&status=eq.completed";
                break;
            case FILTER_CANCELLED:
                q += "&status=eq.cancelled";
                break;
            default:
                break;
        }
        JSONArray a = SupabaseClient.select(q);
        List<Order> out = new ArrayList<>();
        for (int i = 0; i < a.length(); i++) out.add(Order.fromJson(a.optJSONObject(i)));
        return out;
    }

    /** Encomenda activa mais recente (para o cartão da Home), ou null. */
    public static Order latestActive() throws ApiException {
        List<Order> l = myOrders(FILTER_ACTIVE, 1);
        return l.isEmpty() ? null : l.get(0);
    }

    public static List<StatusHistoryEntry> history(String orderId) throws ApiException {
        JSONArray a = SupabaseClient.select("order_status_history?select=*&order_id=eq."
                + SupabaseClient.enc(orderId) + "&order=created_at.asc");
        List<StatusHistoryEntry> out = new ArrayList<>();
        for (int i = 0; i < a.length(); i++) out.add(StatusHistoryEntry.fromJson(a.optJSONObject(i)));
        return out;
    }

    public static Order cancel(String orderId, String reason) throws ApiException {
        JSONObject args = new JSONObject();
        try {
            args.put("p_order_id", orderId);
            args.put("p_reason", reason == null ? JSONObject.NULL : reason);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        SupabaseClient.rpcObject("cancel_my_order", args);
        return get(orderId);
    }
}
