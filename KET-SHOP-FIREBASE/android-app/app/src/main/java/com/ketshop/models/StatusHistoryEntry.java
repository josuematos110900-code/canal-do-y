package com.ketshop.models;

import org.json.JSONObject;

import java.io.Serializable;

public class StatusHistoryEntry implements Serializable {
    public OrderStatus oldStatus;
    public OrderStatus newStatus;
    public String note;
    public String createdAt;

    public static StatusHistoryEntry fromJson(JSONObject o) {
        StatusHistoryEntry e = new StatusHistoryEntry();
        String old = JsonUtil.str(o, "old_status");
        e.oldStatus = old == null ? null : OrderStatus.from(old);
        e.newStatus = OrderStatus.from(JsonUtil.str(o, "new_status", "pending_payment"));
        e.note = JsonUtil.str(o, "note");
        e.createdAt = JsonUtil.str(o, "created_at", "");
        return e;
    }
}
