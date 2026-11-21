package com.ketshop.utils;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Fornecedor de ficheiros minimalista (substitui androidx FileProvider) para
 * que a app da câmara possa gravar a fotografia no cache privado da KET SHOP.
 * Não é exportado: o acesso é concedido apenas por URI temporária.
 */
public class ProofFileProvider extends ContentProvider {

    public static final String AUTHORITY = "com.ketshop.proofprovider";
    private static final String DIR = "proofs";

    public static File proofDir(Context ctx) {
        File d = new File(ctx.getCacheDir(), DIR);
        if (!d.exists()) d.mkdirs();
        return d;
    }

    public static Uri uriFor(File file) {
        return Uri.parse("content://" + AUTHORITY + "/" + DIR + "/" + file.getName());
    }

    private File fileFor(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || !name.matches("[A-Za-z0-9_.-]+") || name.contains("..")) {
            throw new FileNotFoundException("Nome inválido");
        }
        return new File(proofDir(getContext()), name);
    }

    @Override
    public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = fileFor(uri);
        int m = ParcelFileDescriptor.parseMode(mode);
        return ParcelFileDescriptor.open(f, m);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        try {
            File f = fileFor(uri);
            MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
            c.addRow(new Object[]{f.getName(), f.length()});
            return c;
        } catch (FileNotFoundException e) {
            return null;
        }
    }

    @Override
    public String getType(Uri uri) { return "image/jpeg"; }

    @Override
    public Uri insert(Uri uri, ContentValues values) { return null; }

    @Override
    public int delete(Uri uri, String selection, String[] args) { return 0; }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] args) { return 0; }
}
