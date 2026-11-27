package com.ketshop.utils;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;

import com.ketshop.network.ApiException;
import com.ketshop.network.FirebaseConfig;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;

/**
 * Preparação do comprovativo: leitura, validação de MIME (pelos bytes,
 * não só pela extensão), correcção de rotação e compressão se exceder 5 MB.
 */
public final class ImageUtils {

    /** Limite de leitura bruta (antes de compressão) para evitar falta de memória. */
    private static final long MAX_RAW_BYTES = 25L * 1024L * 1024L;
    private static final int MAX_DIMENSION = 2400;

    public static final class PreparedImage {
        public final byte[] bytes;
        public final String mimeType;
        public final String extension;
        public final String fileName;
        public final Bitmap preview;

        PreparedImage(byte[] bytes, String mimeType, String extension, String fileName, Bitmap preview) {
            this.bytes = bytes;
            this.mimeType = mimeType;
            this.extension = extension;
            this.fileName = fileName;
            this.preview = preview;
        }
    }

    private ImageUtils() { }

    /**
     * Lê e valida a imagem. Executar fora da thread principal.
     * @param localFile ficheiro da câmara (para ler EXIF), ou null
     */
    public static PreparedImage prepare(Context ctx, Uri uri, File localFile) throws ApiException {
        ContentResolver cr = ctx.getContentResolver();
        String name = displayName(ctx, uri);
        byte[] raw;
        try {
            raw = readAll(cr.openInputStream(uri));
        } catch (IOException e) {
            throw ApiException.validation("Não foi possível ler a imagem seleccionada.");
        } catch (SecurityException e) {
            throw ApiException.validation("Sem permissão para ler a imagem. Escolha outra.");
        }
        if (raw.length == 0) throw ApiException.validation("A imagem está vazia.");

        String mime = sniffMime(raw);
        String declared = cr.getType(uri);
        if (mime == null) {
            throw ApiException.validation("Formato não suportado. Use JPG, JPEG, PNG ou WEBP.");
        }
        if (declared != null && declared.startsWith("image/") && !isAllowedMime(declared)) {
            throw ApiException.validation("Formato não suportado (" + declared + "). Use JPG, PNG ou WEBP.");
        }
        String ext = extensionFor(mime);
        if (name != null && name.contains(".")) {
            String nameExt = name.substring(name.lastIndexOf('.') + 1).toLowerCase();
            if (!nameExt.matches("jpg|jpeg|png|webp")) name = null; // extensão inválida -> renomear
        }

        int rotation = readRotation(ctx, uri, localFile, mime);
        byte[] finalBytes = raw;
        String finalMime = mime;

        if (rotation != 0 || raw.length > FirebaseConfig.PROOF_MAX_BYTES) {
            Bitmap full = decodeSampled(raw, MAX_DIMENSION);
            if (full == null) throw ApiException.validation("A imagem está corrompida ou não é suportada.");
            if (rotation != 0) {
                Matrix m = new Matrix();
                m.postRotate(rotation);
                Bitmap rotated = Bitmap.createBitmap(full, 0, 0, full.getWidth(), full.getHeight(), m, true);
                if (rotated != full) full.recycle();
                full = rotated;
            }
            finalBytes = compressToLimit(full);
            full.recycle();
            finalMime = "image/jpeg";
            ext = "jpg";
            if (finalBytes.length > FirebaseConfig.PROOF_MAX_BYTES) {
                throw ApiException.validation("A imagem continua acima de 5 MB após compressão. Escolha outra.");
            }
        }

        Bitmap preview = decodeSampled(finalBytes, 1200);
        if (preview == null) throw ApiException.validation("A imagem está corrompida ou não é suportada.");
        if (rotation != 0 && finalBytes == raw) {
            preview = rotate(preview, rotation);
        }
        String fileName = name != null ? name : "comprovativo." + ext;
        if (!finalMime.equals(mime)) fileName = stripExt(fileName) + ".jpg";
        return new PreparedImage(finalBytes, finalMime, ext, fileName, preview);
    }

    public static boolean isAllowedMime(String m) {
        return "image/jpeg".equals(m) || "image/jpg".equals(m) || "image/png".equals(m) || "image/webp".equals(m);
    }

    /** Identifica o formato pelos "magic bytes". */
    public static String sniffMime(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        return null;
    }

    private static String extensionFor(String mime) {
        if ("image/png".equals(mime)) return "png";
        if ("image/webp".equals(mime)) return "webp";
        return "jpg";
    }

    public static Bitmap decodeSampled(byte[] data, int maxDim) {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(data, 0, data.length, o);
        if (o.outWidth <= 0 || o.outHeight <= 0) return null;
        int sample = 1;
        while (o.outWidth / sample > maxDim * 2 || o.outHeight / sample > maxDim * 2) sample *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = sample;
        Bitmap b = BitmapFactory.decodeByteArray(data, 0, data.length, o2);
        if (b == null) return null;
        int w = b.getWidth(), h = b.getHeight();
        float scale = Math.min(1f, (float) maxDim / Math.max(w, h));
        if (scale < 1f) {
            Bitmap s = Bitmap.createScaledBitmap(b, Math.round(w * scale), Math.round(h * scale), true);
            if (s != b) b.recycle();
            b = s;
        }
        return b;
    }

    private static byte[] compressToLimit(Bitmap bmp) {
        int quality = 90;
        byte[] out;
        do {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, quality, bos);
            out = bos.toByteArray();
            quality -= 10;
        } while (out.length > FirebaseConfig.PROOF_MAX_BYTES && quality >= 40);
        return out;
    }

    private static Bitmap rotate(Bitmap b, int degrees) {
        Matrix m = new Matrix();
        m.postRotate(degrees);
        Bitmap r = Bitmap.createBitmap(b, 0, 0, b.getWidth(), b.getHeight(), m, true);
        if (r != b) b.recycle();
        return r;
    }

    private static int readRotation(Context ctx, Uri uri, File localFile, String mime) {
        if (!"image/jpeg".equals(mime)) return 0;
        try {
            ExifInterface exif = null;
            if (localFile != null && localFile.exists()) {
                exif = new ExifInterface(localFile.getAbsolutePath());
            } else if (Build.VERSION.SDK_INT >= 24) {
                InputStream is = ctx.getContentResolver().openInputStream(uri);
                if (is != null) {
                    try {
                        exif = new ExifInterface(is);
                    } finally {
                        is.close();
                    }
                }
            }
            if (exif == null) return 0;
            int o = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            if (o == ExifInterface.ORIENTATION_ROTATE_90) return 90;
            if (o == ExifInterface.ORIENTATION_ROTATE_180) return 180;
            if (o == ExifInterface.ORIENTATION_ROTATE_270) return 270;
        } catch (Exception ignored) {
            // sem EXIF
        }
        return 0;
    }

    private static String displayName(Context ctx, Uri uri) {
        Cursor c = null;
        try {
            c = ctx.getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (c != null && c.moveToFirst()) {
                String n = c.getString(0);
                if (n != null) return n.replaceAll("[^A-Za-z0-9._-]", "_");
            }
        } catch (Exception ignored) {
            // alguns fornecedores não suportam query
        } finally {
            if (c != null) c.close();
        }
        return null;
    }

    private static String stripExt(String n) {
        int i = n.lastIndexOf('.');
        return i > 0 ? n.substring(0, i) : n;
    }

    private static byte[] readAll(InputStream is) throws IOException, ApiException {
        if (is == null) throw new IOException("stream nulo");
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            long total = 0;
            while ((n = is.read(buf)) != -1) {
                total += n;
                if (total > MAX_RAW_BYTES) {
                    throw ApiException.validation("A imagem é demasiado grande (mais de 25 MB).");
                }
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        } finally {
            is.close();
        }
    }
}
