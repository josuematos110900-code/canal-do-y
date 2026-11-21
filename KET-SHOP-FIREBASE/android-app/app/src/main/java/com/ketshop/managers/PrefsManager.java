package com.ketshop.managers;

import android.content.Context;
import android.content.SharedPreferences;

/** Preferências locais (não sensíveis) da app. */
public final class PrefsManager {

    private static final String PREFS = "ketshop_prefs";
    private static final String K_ONBOARDING = "onboarding_done";
    private static final String K_PLAYER_ID = "last_player_id";
    private static final String K_PLAYER_NICK = "last_player_nick";
    private static final String K_NOTIF_ENABLED = "notifications_enabled";
    private static final String K_POLL_SECONDS = "poll_seconds";
    private static final String K_LAST_NOTIF_TS = "last_notification_ts";
    private static final String K_NOTIF_PERMISSION_ASKED = "notif_permission_asked";

    private final SharedPreferences prefs;

    public PrefsManager(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public boolean isOnboardingDone() { return prefs.getBoolean(K_ONBOARDING, false); }
    public void setOnboardingDone() { prefs.edit().putBoolean(K_ONBOARDING, true).apply(); }

    public String getLastPlayerId() { return prefs.getString(K_PLAYER_ID, ""); }
    public String getLastPlayerNick() { return prefs.getString(K_PLAYER_NICK, ""); }
    public void setLastPlayer(String id, String nick) {
        prefs.edit().putString(K_PLAYER_ID, id).putString(K_PLAYER_NICK, nick == null ? "" : nick).apply();
    }
    public void clearLastPlayer() { prefs.edit().remove(K_PLAYER_ID).remove(K_PLAYER_NICK).apply(); }

    public boolean isNotificationsEnabled() { return prefs.getBoolean(K_NOTIF_ENABLED, true); }
    public void setNotificationsEnabled(boolean v) { prefs.edit().putBoolean(K_NOTIF_ENABLED, v).apply(); }

    /** Intervalo de actualização automática nos ecrãs abertos (segundos). */
    public int getPollSeconds() { return prefs.getInt(K_POLL_SECONDS, 20); }
    public void setPollSeconds(int s) { prefs.edit().putInt(K_POLL_SECONDS, s).apply(); }

    /** Data (ISO) da última notificação já mostrada no sistema. */
    public String getLastNotificationTs() { return prefs.getString(K_LAST_NOTIF_TS, ""); }
    public void setLastNotificationTs(String iso) { prefs.edit().putString(K_LAST_NOTIF_TS, iso).apply(); }

    public boolean wasNotificationPermissionAsked() { return prefs.getBoolean(K_NOTIF_PERMISSION_ASKED, false); }
    public void setNotificationPermissionAsked() { prefs.edit().putBoolean(K_NOTIF_PERMISSION_ASKED, true).apply(); }

    public void clearUserData() {
        prefs.edit().remove(K_PLAYER_ID).remove(K_PLAYER_NICK).remove(K_LAST_NOTIF_TS).apply();
    }
}
