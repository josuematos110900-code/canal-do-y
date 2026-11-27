package com.ketshop.models;

import org.json.JSONObject;

import java.io.Serializable;

public class Product implements Serializable {
    public String id;
    public String categoryId;
    public String categoryName;
    public String categorySlug;
    public String name;
    public String description;
    public String game;
    public Integer baseAmount;
    public int bonusAmount;
    public int totalAmount;
    public String unitLabel;
    public double priceKz;
    public boolean onDemand;
    public boolean featured;
    public String imageUrl;
    public int sortOrder;

    public boolean isDiamond() {
        return baseAmount != null && baseAmount > 0;
    }

    public static Product fromJson(JSONObject o) {
        Product p = new Product();
        p.id = JsonUtil.str(o, "id");
        p.categoryId = JsonUtil.str(o, "category_id");
        p.name = JsonUtil.str(o, "name", "");
        p.description = JsonUtil.str(o, "description", "");
        p.game = JsonUtil.str(o, "game", "Free Fire");
        p.baseAmount = JsonUtil.intOrNull(o, "base_amount");
        p.bonusAmount = o.optInt("bonus_amount");
        p.totalAmount = o.optInt("total_amount");
        p.unitLabel = JsonUtil.str(o, "unit_label", "");
        p.priceKz = JsonUtil.dbl(o, "price_kz");
        p.onDemand = o.optBoolean("is_on_demand");
        p.featured = o.optBoolean("is_featured");
        p.imageUrl = JsonUtil.str(o, "image_url");
        p.sortOrder = o.optInt("sort_order");
        JSONObject cat = o.optJSONObject("product_categories");
        if (cat != null) {
            p.categoryName = JsonUtil.str(cat, "name", "");
            p.categorySlug = JsonUtil.str(cat, "slug", "");
        }
        return p;
    }
}
