package com.ketshop.repositories;

import com.ketshop.models.PaymentMethod;
import com.ketshop.network.ApiException;
import com.ketshop.network.SupabaseClient;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;

public final class PaymentRepository {

    private PaymentRepository() { }

    /** Métodos activos configurados pelo administrador no painel. */
    public static List<PaymentMethod> activeMethods() throws ApiException {
        JSONArray a = SupabaseClient.select("payment_methods?select=*&is_active=eq.true&order=sort_order.asc");
        List<PaymentMethod> out = new ArrayList<>();
        for (int i = 0; i < a.length(); i++) out.add(PaymentMethod.fromJson(a.optJSONObject(i)));
        return out;
    }
}
