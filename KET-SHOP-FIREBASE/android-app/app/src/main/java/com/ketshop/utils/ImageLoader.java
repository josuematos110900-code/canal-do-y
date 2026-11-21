package com.ketshop.utils;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.LruCache;
import android.widget.ImageView;

import com.ketshop.network.Async;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Carregamento simples de imagens remotas (imagens de produtos) com cache em memória. */
public final class ImageLoader {

    private static final LruCache<String, Bitmap> CACHE = new LruCache<String, Bitmap>(8 * 1024 * 1024) {
        @Override
        protected int sizeOf(String key, Bitmap value) {
            return value.getByteCount();
        }
    };

    private ImageLoader() { }

    public static void load(final ImageView view, final String url, final int placeholderRes) {
        view.setTag(url);
        if (url == null || !url.startsWith("https://")) {
            view.setImageResource(placeholderRes);
            return;
        }
        Bitmap cached = CACHE.get(url);
        if (cached != null) {
            view.setImageBitmap(cached);
            return;
        }
        view.setImageResource(placeholderRes);
        Async.run(() -> download(url), bmp -> {
            if (bmp != null) {
                CACHE.put(url, bmp);
                if (url.equals(view.getTag())) view.setImageBitmap(bmp);
            }
        }, err -> { });
    }

    private static Bitmap download(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        try {
            InputStream is = c.getInputStream();
            try {
                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inSampleSize = 1;
                return BitmapFactory.decodeStream(is, null, o);
            } finally {
                is.close();
            }
        } finally {
            c.disconnect();
        }
    }
}
