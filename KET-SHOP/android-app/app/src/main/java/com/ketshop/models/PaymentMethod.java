package com.ketshop.models;

import org.json.JSONObject;

import java.io.Serializable;

public class PaymentMethod implements Serializable {
    public String id;
    public String type;
    public String name;
    public String description;
    public String instructions;
    public String accountHolder;
    public String bankName;
    public String iban;
    public String accountNumber;
    public String phoneNumber;
    public String entity;
    public String reference;

    public static PaymentMethod fromJson(JSONObject o) {
        PaymentMethod m = new PaymentMethod();
        m.id = JsonUtil.str(o, "id");
        m.type = JsonUtil.str(o, "type", "");
        m.name = JsonUtil.str(o, "name", "");
        m.description = JsonUtil.str(o, "description", "");
        m.instructions = JsonUtil.str(o, "instructions", "");
        m.accountHolder = JsonUtil.str(o, "account_holder");
        m.bankName = JsonUtil.str(o, "bank_name");
        m.iban = JsonUtil.str(o, "iban");
        m.accountNumber = JsonUtil.str(o, "account_number");
        m.phoneNumber = JsonUtil.str(o, "phone_number");
        m.entity = JsonUtil.str(o, "entity");
        m.reference = JsonUtil.str(o, "reference");
        return m;
    }

    public String typeLabel() {
        switch (type == null ? "" : type) {
            case "bank_transfer": return "Transferência bancária";
            case "multicaixa_express": return "Multicaixa Express";
            case "paypay": return "PayPay AO";
            case "reference": return "Pagamento por referência";
            default: return "Pagamento";
        }
    }
}
