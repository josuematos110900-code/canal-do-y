package com.ketshop.repositories;

import com.ketshop.models.Product;
import com.ketshop.models.ProductCategory;
import com.ketshop.network.ApiException;
import com.ketshop.network.Firestore;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Catálogo dinâmico lido do Firestore (sem preços no APK). As consultas usam
 * apenas igualdade (is_active == true) e ordenam no telemóvel, para não exigir
 * índices compostos.
 */
public final class ProductRepository {

    private ProductRepository() { }

    public static List<ProductCategory> categories() throws ApiException {
        List<ProductCategory> out = new ArrayList<>();
        for (JSONObject o : Firestore.query(new Firestore.Query("categories").whereEq("is_active", true).allowAnonymous())) {
            out.add(ProductCategory.fromJson(o));
        }
        Collections.sort(out, (a, b) -> Integer.compare(a.sortOrder, b.sortOrder));
        return out;
    }

    /** @param categoryId null = todos os produtos activos */
    public static List<Product> products(String categoryId) throws ApiException {
        Map<String, ProductCategory> cats = new HashMap<>();
        for (ProductCategory c : categories()) cats.put(c.id, c);
        List<Product> out = new ArrayList<>();
        for (JSONObject o : Firestore.query(new Firestore.Query("products").whereEq("is_active", true).allowAnonymous())) {
            Product p = Product.fromJson(o);
            ProductCategory c = cats.get(p.categoryId);
            if (c == null) continue; // categoria inactiva
            p.categoryName = c.name;
            p.categorySlug = c.slug;
            if (categoryId == null || categoryId.equals(p.categoryId)) out.add(p);
        }
        Collections.sort(out, (a, b) -> Integer.compare(a.sortOrder, b.sortOrder));
        return out;
    }

    public static List<Product> featured() throws ApiException {
        List<Product> out = new ArrayList<>();
        for (Product p : products(null)) if (p.featured && out.size() < 6) out.add(p);
        return out;
    }

    /** Lê sempre do servidor (preço actual). */
    public static Product product(String id) throws ApiException {
        JSONObject o;
        try {
            o = Firestore.get("products/" + id, true);
        } catch (ApiException e) {
            if (e.isPermissionDenied()) o = null; // inactivo -> as regras escondem-no
            else throw e;
        }
        if (o == null || !o.optBoolean("is_active")) throw ApiException.validation("Este produto já não está disponível.");
        Product p = Product.fromJson(o);
        JSONObject c = Firestore.get("categories/" + p.categoryId, true);
        if (c != null) {
            p.categoryName = c.optString("name");
            p.categorySlug = c.optString("slug");
        }
        return p;
    }
}
