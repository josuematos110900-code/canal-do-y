package com.ketshop.repositories;

import com.ketshop.managers.SessionManager;
import com.ketshop.models.AppNotification;
import com.ketshop.network.ApiException;
import com.ketshop.network.SupabaseClient;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public final class NotificationRepository {

    private NotificationRepository() { }

    public static List<AppNotification> list(int limit) throws ApiException {
        String uid = SessionManager.get().getUserId();
        if (uid == null) throw ApiException.sessionExpired();
        return parse(SupabaseClient.select("notifications?select=*&user_id=eq." + SupabaseClient.enc(uid)
                + "&order=created_at.desc&limit=" + limit));
    }

    /** Notificações não lidas criadas depois de {@code sinceIso} (vazio = últimas). */
    public static List<AppNotification> unreadSince(String sinceIso, int limit) throws ApiException {
        String uid = SessionManager.get().getUserId();
        if (uid == null) return new ArrayList<>();
        String q = "notifications?select=*&user_id=eq." + SupabaseClient.enc(uid)
                + "&is_read=eq.false&order=created_at.asc&limit=" + limit;
        if (sinceIso != null && !sinceIso.isEmpty()) q += "&created_at=gt." + SupabaseClient.enc(sinceIso);
        return parse(SupabaseClient.select(q));
    }

    public static int unreadCount() throws ApiException {
        String t = SupabaseClient.rpc("unread_notifications_count", new JSONObject()).trim();
        try {
            return Integer.parseInt(t);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    public static void markRead(String id) throws ApiException {
        JSONObject args = new JSONObject();
        try {
            args.put("p_id", id);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        SupabaseClient.rpc("mark_notification_read", args);
    }

    public static void markAllRead() throws ApiException {
        SupabaseClient.rpc("mark_all_notifications_read", new JSONObject());
    }

    public static void delete(String id) throws ApiException {
        SupabaseClient.delete("notifications?id=eq." + SupabaseClient.enc(id));
    }

    private static List<AppNotification> parse(JSONArray a) {
        List<AppNotification> out = new ArrayList<>();
        for (int i = 0; i < a.length(); i++) out.add(AppNotification.fromJson(a.optJSONObject(i)));
        return out;
    }
}
