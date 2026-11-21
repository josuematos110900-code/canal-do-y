package com.ketshop.models;

import org.json.JSONObject;

import java.io.Serializable;

public class OrderItem implements Serializable {
    public String id;
    public String productId;
    public String productName;
    public int quantity;
    public double unitPriceKz;
    public int totalAmount;
    public double lineTotalKz;
    public String unitLabel;

    public static OrderItem fromJson(JSONObject o) {
        OrderItem i = new OrderItem();
        i.id = JsonUtil.str(o, "id");
        i.productId = JsonUtil.str(o, "product_id");
        i.productName = JsonUtil.str(o, "product_name", "");
        i.quantity = o.optInt("quantity", 1);
        i.unitPriceKz = JsonUtil.dbl(o, "unit_price_kz");
        i.totalAmount = o.optInt("total_amount");
        i.lineTotalKz = JsonUtil.dbl(o, "line_total_kz");
        JSONObject snap = o.optJSONObject("product_snapshot");
        i.unitLabel = snap != null ? JsonUtil.str(snap, "unit_label", "") : "";
        return i;
    }
}
