package com.ketshop.models;

import org.json.JSONObject;

import java.io.Serializable;

public class Profile implements Serializable {
    public String id;
    public String fullName;
    public String email;
    public String phone;
    public String lastPlayerId;
    public boolean blocked;
    public String blockedReason;
    public String createdAt;

    public static Profile fromJson(JSONObject o) {
        Profile p = new Profile();
        p.id = JsonUtil.str(o, "id");
        p.fullName = JsonUtil.str(o, "full_name", "");
        p.email = JsonUtil.str(o, "email", "");
        p.phone = JsonUtil.str(o, "phone", "");
        p.lastPlayerId = JsonUtil.str(o, "last_player_id", "");
        p.blocked = o.optBoolean("is_blocked");
        p.blockedReason = JsonUtil.str(o, "blocked_reason");
        p.createdAt = JsonUtil.str(o, "created_at", "");
        return p;
    }

    public String firstName() {
        if (fullName == null || fullName.trim().isEmpty()) return "Jogador";
        return fullName.trim().split("\\s+")[0];
    }
}
