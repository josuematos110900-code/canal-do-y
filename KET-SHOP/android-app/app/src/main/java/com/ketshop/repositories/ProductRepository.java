package com.ketshop.repositories;

import com.ketshop.models.Product;
import com.ketshop.models.ProductCategory;
import com.ketshop.network.ApiException;
import com.ketshop.network.SupabaseClient;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;

/** Catálogo dinâmico: tudo vem do Supabase (sem preços fixos no APK). */
public final class ProductRepository {

    private static final String PRODUCT_SELECT =
            "select=id,category_id,name,description,game,base_amount,bonus_amount,total_amount,unit_label,"
                    + "price_kz,is_on_demand,is_featured,image_url,sort_order,product_categories(name,slug)";

    private ProductRepository() { }

    public static List<ProductCategory> categories() throws ApiException {
        JSONArray a = SupabaseClient.select("product_categories?select=*&is_active=eq.true&order=sort_order.asc");
        List<ProductCategory> out = new ArrayList<>();
        for (int i = 0; i < a.length(); i++) out.add(ProductCategory.fromJson(a.optJSONObject(i)));
        return out;
    }

    /** @param categoryId null = todos os produtos activos */
    public static List<Product> products(String categoryId) throws ApiException {
        String q = "products?" + PRODUCT_SELECT + "&is_active=eq.true&order=sort_order.asc";
        if (categoryId != null) q += "&category_id=eq." + SupabaseClient.enc(categoryId);
        return parse(SupabaseClient.select(q));
    }

    public static List<Product> featured() throws ApiException {
        return parse(SupabaseClient.select("products?" + PRODUCT_SELECT
                + "&is_active=eq.true&is_featured=eq.true&order=sort_order.asc&limit=6"));
    }

    public static Product product(String id) throws ApiException {
        List<Product> l = parse(SupabaseClient.select("products?" + PRODUCT_SELECT
                + "&id=eq." + SupabaseClient.enc(id) + "&is_active=eq.true"));
        if (l.isEmpty()) throw ApiException.validation("Este produto já não está disponível.");
        return l.get(0);
    }

    private static List<Product> parse(JSONArray a) {
        List<Product> out = new ArrayList<>();
        for (int i = 0; i < a.length(); i++) out.add(Product.fromJson(a.optJSONObject(i)));
        return out;
    }
}
