package com.ketshop.repositories;

import com.ketshop.managers.SessionManager;
import com.ketshop.models.PaymentProof;
import com.ketshop.network.ApiException;
import com.ketshop.network.HttpClient;
import com.ketshop.network.SupabaseClient;
import com.ketshop.network.SupabaseConfig;
import com.ketshop.utils.ImageUtils;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Comprovativos: upload para o bucket PRIVADO payment-proofs no caminho
 * <user_id>/<order_id>/<ficheiro> e registo dos metadados via RPC.
 */
public final class ProofRepository {

    private ProofRepository() { }

    /** Faz upload e devolve o caminho no Storage. */
    public static String upload(String orderId, ImageUtils.PreparedImage image,
                                HttpClient.ProgressListener listener) throws ApiException {
        String uid = SessionManager.get().getUserId();
        if (uid == null) throw ApiException.sessionExpired();
        if (image.bytes.length > SupabaseConfig.PROOF_MAX_BYTES) {
            throw ApiException.validation("O ficheiro excede 5 MB.");
        }
        String path = uid + "/" + orderId + "/comprovativo_" + System.currentTimeMillis() + "." + image.extension;
        SupabaseClient.storageUpload(SupabaseConfig.PROOF_BUCKET, path, image.bytes, image.mimeType, listener);
        return path;
    }

    /** Regista o comprovativo na base de dados e muda o estado da encomenda. */
    public static PaymentProof submit(String orderId, String storagePath, ImageUtils.PreparedImage image)
            throws ApiException {
        JSONObject args = new JSONObject();
        try {
            args.put("p_order_id", orderId);
            args.put("p_storage_path", storagePath);
            args.put("p_file_name", image.fileName);
            args.put("p_mime_type", image.mimeType);
            args.put("p_size_bytes", image.bytes.length);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        return PaymentProof.fromJson(SupabaseClient.rpcObject("submit_payment_proof", args));
    }

    public static List<PaymentProof> forOrder(String orderId) throws ApiException {
        JSONArray a = SupabaseClient.select("payment_proofs?select=*&order_id=eq."
                + SupabaseClient.enc(orderId) + "&order=created_at.desc");
        List<PaymentProof> out = new ArrayList<>();
        for (int i = 0; i < a.length(); i++) out.add(PaymentProof.fromJson(a.optJSONObject(i)));
        return out;
    }

    /** Descarrega o ficheiro (apenas o dono ou a equipa têm acesso, via RLS do Storage). */
    public static byte[] download(String storagePath) throws ApiException {
        return SupabaseClient.storageDownload(SupabaseConfig.PROOF_BUCKET, storagePath);
    }
}
