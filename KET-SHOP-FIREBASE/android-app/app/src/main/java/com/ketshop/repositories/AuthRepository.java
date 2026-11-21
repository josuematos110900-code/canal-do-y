package com.ketshop.repositories;

import com.ketshop.managers.SessionManager;
import com.ketshop.models.Order;
import com.ketshop.network.ApiException;
import com.ketshop.network.FirebaseAuthApi;
import com.ketshop.network.Firestore;

import org.json.JSONObject;

import java.util.List;

/** Firebase Authentication + documento users/{uid}. Métodos síncronos. */
public final class AuthRepository {

    private AuthRepository() { }

    public static void signIn(String email, String password) throws ApiException {
        JSONObject res = FirebaseAuthApi.signIn(email.trim().toLowerCase(), password);
        SessionManager.get().saveSession(res);
    }

    /**
     * Cria a conta, o perfil (users/{uid}) e envia o e-mail de verificação.
     * Devolve true (o Firebase inicia sessão de imediato).
     */
    public static boolean signUp(String fullName, String phone, String email, String password) throws ApiException {
        String mail = email.trim().toLowerCase();
        JSONObject res = FirebaseAuthApi.signUp(mail, password);
        SessionManager.get().saveSession(res);
        ProfileRepository.createProfile(fullName.trim(), phone, res.optString("email", mail));
        try {
            FirebaseAuthApi.sendEmailVerification();
        } catch (ApiException ignored) {
            // não impede o registo
        }
        return true;
    }

    public static void sendPasswordReset(String email) throws ApiException {
        try {
            FirebaseAuthApi.sendPasswordReset(email.trim().toLowerCase());
        } catch (ApiException e) {
            // Não revelar se o e-mail existe
            if (!"EMAIL_NOT_FOUND".equals(e.getErrorCode())) throw e;
        }
    }

    public static void changePassword(String newPassword) throws ApiException {
        SessionManager.get().saveSession(FirebaseAuthApi.changePassword(newPassword));
    }

    /** O Firebase não tem "logout" no servidor: apaga-se a sessão local. */
    public static void signOut() {
        SessionManager.get().clear();
    }

    /**
     * Elimina a conta: recusa contas da equipa e encomendas em curso, cancela as
     * encomendas por pagar, apaga o perfil e depois a conta de autenticação.
     */
    public static void deleteAccount() throws ApiException {
        String uid = SessionManager.get().getUserId();
        JSONObject roles = Firestore.get("roles/" + uid);
        if (roles != null && (roles.optBoolean("admin") || roles.optBoolean("operator"))) {
            throw ApiException.validation("Contas da equipa não podem ser eliminadas pela app.");
        }
        List<Order> orders = OrderRepository.myOrders(OrderRepository.FILTER_ACTIVE, 500);
        for (Order o : orders) {
            if (!o.status.cancellableByCustomer()) {
                throw ApiException.validation("Tem encomendas em curso. Aguarde a conclusão antes de eliminar a conta.");
            }
        }
        for (Order o : orders) OrderRepository.cancel(o.id, "Conta eliminada pelo cliente");
        Firestore.commit(Firestore.Write.delete("users/" + uid));
        FirebaseAuthApi.deleteAccount();
        SessionManager.get().clear();
    }

}
