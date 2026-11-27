package com.ketshop.models;

import com.ketshop.R;

/** Estados da encomenda (iguais ao enum public.order_status do Firebase). */
public enum OrderStatus {
    PENDING_PAYMENT("pending_payment", "Pendente de pagamento", R.color.status_warning, 0),
    PROOF_SUBMITTED("proof_submitted", "Comprovativo enviado", R.color.status_info, 1),
    UNDER_REVIEW("under_review", "Em verificação", R.color.status_info, 2),
    PAYMENT_APPROVED("payment_approved", "Pagamento aprovado", R.color.status_success, 3),
    PAYMENT_REJECTED("payment_rejected", "Pagamento rejeitado", R.color.status_error, 2),
    PROCESSING("processing", "Em processamento", R.color.status_processing, 4),
    COMPLETED("completed", "Concluída", R.color.status_success, 5),
    CANCELLED("cancelled", "Cancelada", R.color.status_neutral, -1);

    public final String code;
    public final String label;
    public final int colorRes;
    /** Posição na linha temporal (0..5); -1 = fora do fluxo. */
    public final int step;

    OrderStatus(String code, String label, int colorRes, int step) {
        this.code = code;
        this.label = label;
        this.colorRes = colorRes;
        this.step = step;
    }

    public static OrderStatus from(String code) {
        for (OrderStatus s : values()) if (s.code.equals(code)) return s;
        return PENDING_PAYMENT;
    }

    /** O cliente pode (re)enviar comprovativo? */
    public boolean acceptsProof() { return this == PENDING_PAYMENT || this == PAYMENT_REJECTED; }

    /** O cliente pode cancelar? */
    public boolean cancellableByCustomer() { return this == PENDING_PAYMENT || this == PAYMENT_REJECTED; }

    public boolean isFinal() { return this == COMPLETED || this == CANCELLED; }

    public boolean isActive() { return !isFinal(); }

    /** Etapas mostradas na linha temporal de acompanhamento. */
    public static final OrderStatus[] TIMELINE = {
            PENDING_PAYMENT, PROOF_SUBMITTED, UNDER_REVIEW, PAYMENT_APPROVED, PROCESSING, COMPLETED
    };
}
