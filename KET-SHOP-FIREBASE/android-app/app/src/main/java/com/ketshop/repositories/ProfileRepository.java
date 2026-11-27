package com.ketshop.repositories;

import com.ketshop.managers.SessionManager;
import com.ketshop.models.Order;
import com.ketshop.models.Profile;
import com.ketshop.network.ApiException;
import com.ketshop.network.Firestore;
import com.ketshop.network.Json;

import org.json.JSONObject;

import java.util.List;

public final class ProfileRepository {

    private ProfileRepository() { }

    static String uid() throws ApiException {
        String uid = SessionManager.get().getUserId();
        if (uid == null) throw ApiException.sessionExpired();
        return uid;
    }

    /** Cria users/{uid} (as regras exigem is_blocked=false e o e-mail do token). */
    static void createProfile(String fullName, String phone, String email) throws ApiException {
        Firestore.commit(Firestore.Write.create("users/" + uid(), Json.of(
                "full_name", fullName == null ? "" : fullName,
                "email", email,
                "phone", Json.nullIfEmpty(phone),
                "is_blocked", false)).serverTime("created_at", "updated_at"));
    }

    /** Lê o perfil; se não existir (conta criada na consola), cria-o. */
    public static Profile getMyProfile() throws ApiException {
        String uid = uid();
        JSONObject doc = Firestore.get("users/" + uid);
        if (doc == null) {
            createProfile("", null, SessionManager.get().getEmail());
            doc = Firestore.get("users/" + uid);
            if (doc == null) throw ApiException.validation("Não foi possível criar o perfil.");
        }
        return Profile.fromJson(doc);
    }

    public static Profile updateMyProfile(String fullName, String phone) throws ApiException {
        String uid = uid();
        Firestore.commit(Firestore.Write.update("users/" + uid,
                Json.of("full_name", fullName.trim(), "phone", Json.nullIfEmpty(phone))).serverTime("updated_at"));
        return Profile.fromJson(Firestore.get("users/" + uid));
    }

    /** Guarda o último ID de jogador no perfil (melhor esforço). */
    static void saveLastPlayerId(String playerId) {
        try {
            Firestore.commit(Firestore.Write.update("users/" + uid(), Json.of("last_player_id", playerId)).serverTime("updated_at"));
        } catch (Exception ignored) {
            // não é crítico
        }
    }

    /** [total, concluídas, em curso] */
    public static int[] myOrderStats() throws ApiException {
        List<Order> all = OrderRepository.myOrders(OrderRepository.FILTER_ALL, 1000);
        int done = 0, active = 0;
        for (Order o : all) {
            if (o.status == com.ketshop.models.OrderStatus.COMPLETED) done++;
            else if (o.status != com.ketshop.models.OrderStatus.CANCELLED) active++;
        }
        return new int[]{all.size(), done, active};
    }
}
