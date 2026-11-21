package com.ketshop.repositories;

import com.ketshop.managers.SessionManager;
import com.ketshop.models.AppNotification;
import com.ketshop.network.ApiException;
import com.ketshop.network.Firestore;
import com.ketshop.network.Json;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class NotificationRepository {

    private NotificationRepository() { }

    /**
     * Últimas notificações. Usa o índice (user_id, created_at desc); se ainda
     * não existir no projecto, faz a consulta simples e ordena no telemóvel.
     */
    public static List<AppNotification> list(int limit) throws ApiException {
        String uid = ProfileRepository.uid();
        List<JSONObject> docs;
        try {
            docs = Firestore.query(new Firestore.Query("notifications").whereEq("user_id", uid)
                    .orderBy("created_at", true).limit(limit));
        } catch (ApiException e) {
            if (!"FAILED_PRECONDITION".equals(e.getErrorCode())) throw e;
            docs = Firestore.query(new Firestore.Query("notifications").whereEq("user_id", uid));
        }
        List<AppNotification> out = parse(docs);
        Collections.sort(out, (a, b) -> b.createdAt.compareTo(a.createdAt));
        return out.size() > limit ? new ArrayList<>(out.subList(0, limit)) : out;
    }

    private static List<AppNotification> unread() throws ApiException {
        String uid = SessionManager.get().getUserId();
        if (uid == null) return new ArrayList<>();
        return parse(Firestore.query(new Firestore.Query("notifications").whereEq("user_id", uid).whereEq("is_read", false)));
    }

    /** Não lidas criadas depois de {@code sinceIso} (mais antigas primeiro). */
    public static List<AppNotification> unreadSince(String sinceIso, int limit) throws ApiException {
        List<AppNotification> out = new ArrayList<>();
        for (AppNotification n : unread()) {
            if (sinceIso == null || sinceIso.isEmpty() || n.createdAt.compareTo(sinceIso) > 0) out.add(n);
        }
        Collections.sort(out, (a, b) -> a.createdAt.compareTo(b.createdAt));
        return out.size() > limit ? new ArrayList<>(out.subList(out.size() - limit, out.size())) : out;
    }

    public static int unreadCount() throws ApiException {
        return unread().size();
    }

    public static void markRead(String id) throws ApiException {
        Firestore.commit(Firestore.Write.update("notifications/" + id, Json.of("is_read", true)).serverTime("read_at"));
    }

    public static void markAllRead() throws ApiException {
        List<Firestore.Write> writes = new ArrayList<>();
        for (AppNotification n : unread()) {
            writes.add(Firestore.Write.update("notifications/" + n.id, Json.of("is_read", true)).serverTime("read_at"));
            if (writes.size() == 400) { Firestore.commit(writes); writes = new ArrayList<>(); }
        }
        if (!writes.isEmpty()) Firestore.commit(writes);
    }

    public static void delete(String id) throws ApiException {
        Firestore.commit(Firestore.Write.delete("notifications/" + id));
    }

    private static List<AppNotification> parse(List<JSONObject> docs) {
        List<AppNotification> out = new ArrayList<>();
        for (JSONObject o : docs) out.add(AppNotification.fromJson(o));
        return out;
    }
}
