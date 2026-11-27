package com.ketshop.repositories;

import com.ketshop.models.PaymentMethod;
import com.ketshop.network.ApiException;
import com.ketshop.network.Firestore;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class PaymentRepository {

    private PaymentRepository() { }

    /** Métodos activos configurados no painel. */
    public static List<PaymentMethod> activeMethods() throws ApiException {
        List<JSONObject> docs = Firestore.query(new Firestore.Query("paymentMethods").whereEq("is_active", true));
        Collections.sort(docs, (a, b) -> Integer.compare(a.optInt("sort_order"), b.optInt("sort_order")));
        List<PaymentMethod> out = new ArrayList<>();
        for (JSONObject o : docs) out.add(PaymentMethod.fromJson(o));
        return out;
    }
}
