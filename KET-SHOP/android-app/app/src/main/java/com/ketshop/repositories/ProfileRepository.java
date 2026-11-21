package com.ketshop.repositories;

import com.ketshop.managers.SessionManager;
import com.ketshop.models.Profile;
import com.ketshop.network.ApiException;
import com.ketshop.network.SupabaseClient;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class ProfileRepository {

    private ProfileRepository() { }

    public static Profile getMyProfile() throws ApiException {
        String uid = SessionManager.get().getUserId();
        if (uid == null) throw ApiException.sessionExpired();
        JSONArray a = SupabaseClient.select("profiles?select=*&id=eq." + SupabaseClient.enc(uid));
        if (a.length() == 0) throw ApiException.validation("Perfil não encontrado. Verifique se o SQL do Supabase foi instalado.");
        return Profile.fromJson(a.optJSONObject(0));
    }

    public static Profile updateMyProfile(String fullName, String phone) throws ApiException {
        JSONObject args = new JSONObject();
        try {
            args.put("p_full_name", fullName);
            args.put("p_phone", phone);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        return Profile.fromJson(SupabaseClient.rpcObject("update_my_profile", args));
    }

    /** Estatísticas simples para o perfil: [total, concluídas, em curso]. */
    public static int[] myOrderStats() throws ApiException {
        String uid = SessionManager.get().getUserId();
        JSONArray a = SupabaseClient.select("orders?select=status&user_id=eq." + SupabaseClient.enc(uid));
        int total = a.length(), done = 0, active = 0;
        for (int i = 0; i < a.length(); i++) {
            String s = a.optJSONObject(i).optString("status");
            if ("completed".equals(s)) done++;
            else if (!"cancelled".equals(s)) active++;
        }
        return new int[]{total, done, active};
    }
}
