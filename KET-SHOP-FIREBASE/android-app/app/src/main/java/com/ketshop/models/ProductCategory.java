package com.ketshop.models;

import org.json.JSONObject;

import java.io.Serializable;

public class ProductCategory implements Serializable {
    public String id;
    public String slug;
    public String name;
    public String description;
    public String icon;
    public int sortOrder;

    public static ProductCategory fromJson(JSONObject o) {
        ProductCategory c = new ProductCategory();
        c.id = JsonUtil.str(o, "id");
        c.slug = JsonUtil.str(o, "slug", "");
        c.name = JsonUtil.str(o, "name", "");
        c.description = JsonUtil.str(o, "description", "");
        c.icon = JsonUtil.str(o, "icon", "");
        c.sortOrder = o.optInt("sort_order");
        return c;
    }
}
