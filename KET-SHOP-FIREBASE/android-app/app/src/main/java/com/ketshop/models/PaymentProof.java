package com.ketshop.models;

import org.json.JSONObject;

import java.io.Serializable;

public class PaymentProof implements Serializable {
    public String id;
    public String orderId;
    public String storagePath;
    public String fileName;
    public String mimeType;
    public int sizeBytes;
    public String status;
    public String reviewNotes;
    public String createdAt;

    public static PaymentProof fromJson(JSONObject o) {
        PaymentProof p = new PaymentProof();
        p.id = JsonUtil.str(o, "id");
        p.orderId = JsonUtil.str(o, "order_id");
        p.storagePath = JsonUtil.str(o, "storage_path", "");
        p.fileName = JsonUtil.str(o, "file_name", "comprovativo");
        p.mimeType = JsonUtil.str(o, "mime_type", "");
        p.sizeBytes = o.optInt("size_bytes");
        p.status = JsonUtil.str(o, "status", "pending");
        p.reviewNotes = JsonUtil.str(o, "review_notes");
        p.createdAt = JsonUtil.str(o, "created_at", "");
        return p;
    }

    public String statusLabel() {
        if ("approved".equals(status)) return "Aprovado";
        if ("rejected".equals(status)) return "Rejeitado";
        return "Em análise";
    }
}
