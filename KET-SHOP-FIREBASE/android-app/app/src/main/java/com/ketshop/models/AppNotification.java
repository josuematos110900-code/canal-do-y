package com.ketshop.models;

import org.json.JSONObject;

import java.io.Serializable;

public class AppNotification implements Serializable {
    public String id;
    public String type;
    public String title;
    public String body;
    public String orderId;
    public boolean read;
    public String createdAt;

    public static AppNotification fromJson(JSONObject o) {
        AppNotification n = new AppNotification();
        n.id = JsonUtil.str(o, "id", "");
        n.type = JsonUtil.str(o, "type", "general");
        n.title = JsonUtil.str(o, "title", "");
        n.body = JsonUtil.str(o, "body", "");
        n.orderId = JsonUtil.str(o, "order_id");
        n.read = o.optBoolean("is_read");
        n.createdAt = JsonUtil.str(o, "created_at", "");
        return n;
    }
}
