package com.ketshop.repositories;

import com.ketshop.models.Order;
import com.ketshop.models.OrderStatus;
import com.ketshop.models.PaymentProof;
import com.ketshop.network.ApiException;
import com.ketshop.network.FirebaseConfig;
import com.ketshop.network.Firestore;
import com.ketshop.network.HttpClient;
import com.ketshop.network.Json;
import com.ketshop.network.StorageApi;
import com.ketshop.utils.ImageUtils;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Comprovativos: ficheiro no Cloud Storage privado em
 * proofs/<uid>/<orderId>/<ficheiro> + metadados em orders/{id}/proofs/{proofId}.
 */
public final class ProofRepository {

    private ProofRepository() { }

    /** Envia o ficheiro e devolve o caminho no Storage. */
    public static String upload(String orderId, ImageUtils.PreparedImage image,
                                HttpClient.ProgressListener listener) throws ApiException {
        if (image.bytes.length > FirebaseConfig.PROOF_MAX_BYTES) throw ApiException.validation("O ficheiro excede 5 MB.");
        String path = "proofs/" + ProfileRepository.uid() + "/" + orderId + "/comprovativo_"
                + System.currentTimeMillis() + "." + image.extension;
        try {
            StorageApi.upload(path, image.bytes, image.mimeType, listener);
        } catch (ApiException e) {
            if (e.isPermissionDenied()) {
                throw ApiException.validation("O envio foi recusado: confirme que a encomenda ainda aceita comprovativos e que a imagem tem até 5 MB (JPG, PNG ou WEBP).");
            }
            throw e;
        }
        return path;
    }

    /** Regista o comprovativo e muda a encomenda para "Comprovativo enviado" (commit atómico). */
    public static PaymentProof submit(String orderId, String storagePath, ImageUtils.PreparedImage image) throws ApiException {
        Order order = OrderRepository.get(orderId);
        if (!order.status.acceptsProof()) {
            throw ApiException.validation("Esta encomenda já não aceita comprovativos (" + order.status.label + ").");
        }
        JSONObject raw = Firestore.get("orders/" + orderId);
        int count = raw == null ? 0 : raw.optInt("proof_count", 0);
        String proofId = Firestore.newId();
        JSONObject proof = Json.of(
                "storage_path", storagePath, "file_name", image.fileName, "mime_type", image.mimeType,
                "size_bytes", image.bytes.length, "status", "pending", "user_id", ProfileRepository.uid());
        Firestore.commit(
                Firestore.Write.create("orders/" + orderId + "/proofs/" + proofId, proof).serverTime("created_at"),
                Firestore.Write.update("orders/" + orderId, Json.of(
                        "status", OrderStatus.PROOF_SUBMITTED.code, "last_proof_id", proofId,
                        "proof_count", count + 1, "rejection_reason", null))
                        .serverTime("updated_at", "payment_submitted_at"),
                OrderRepository.historyWrite(orderId, order.status.code, OrderStatus.PROOF_SUBMITTED.code, "Comprovativo enviado pelo cliente"),
                OrderRepository.notificationWrite("proof_received", "Comprovativo recebido",
                        "Recebemos o comprovativo da encomenda " + orderId + ". A nossa equipa vai verificá-lo em breve.", orderId));
        PaymentProof p = PaymentProof.fromJson(proof);
        p.id = proofId;
        p.orderId = orderId;
        return p;
    }

    public static List<PaymentProof> forOrder(String orderId) throws ApiException {
        List<PaymentProof> out = new ArrayList<>();
        for (JSONObject o : Firestore.query(new Firestore.Query("proofs").parent("orders/" + orderId).orderBy("created_at", true))) {
            out.add(PaymentProof.fromJson(o));
        }
        return out;
    }

    public static byte[] download(String storagePath) throws ApiException {
        return StorageApi.download(storagePath);
    }
}
