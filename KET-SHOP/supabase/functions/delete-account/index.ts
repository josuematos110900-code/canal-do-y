// =====================================================================
// KET SHOP — Edge Function: delete-account
// Permite ao cliente eliminar a sua conta a partir da app.
// A chave service_role existe APENAS aqui (variável de ambiente do
// Supabase Edge Runtime) e nunca é enviada para a app ou para o painel.
//
// Regras:
//  * Requer JWT válido do próprio utilizador (Authorization: Bearer ...).
//  * Recusa se existir encomenda em curso (paga ou em verificação).
//  * Recusa contas da equipa (admin/operator).
//  * Encomendas concluídas/canceladas são mantidas para fins contabilísticos,
//    com user_id = NULL (ON DELETE SET NULL). Notificações e perfil são apagados.
//
// Deploy:  supabase functions deploy delete-account
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "SERVER_MISCONFIGURED" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "AUTH_REQUIRED" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return json(401, { error: "INVALID_SESSION" });
  const userId = userData.user.id;

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch (_) { /* corpo vazio */ }
  if (body.confirm !== "ELIMINAR") return json(400, { error: "CONFIRMATION_REQUIRED" });

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if ((roles ?? []).some((r) => r.role === "admin" || r.role === "operator")) {
    return json(403, { error: "STAFF_ACCOUNT", message: "Contas da equipa não podem ser eliminadas pela app." });
  }

  const { count, error: countError } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["proof_submitted", "under_review", "payment_approved", "processing"]);
  if (countError) return json(500, { error: "QUERY_FAILED" });
  if ((count ?? 0) > 0) {
    return json(409, { error: "OPEN_ORDERS", message: "Tem encomendas em curso. Aguarde a conclusão antes de eliminar a conta." });
  }

  // Cancela encomendas por pagar
  await admin.from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "Conta eliminada pelo cliente" })
    .eq("user_id", userId)
    .in("status", ["pending_payment", "payment_rejected"]);

  const { error: delError } = await admin.auth.admin.deleteUser(userId);
  if (delError) return json(500, { error: "DELETE_FAILED" });

  await admin.from("audit_logs").insert({
    actor_id: null, action: "user.self_deleted", entity: "profiles", entity_id: userId, details: {},
  });

  return json(200, { ok: true });
});
