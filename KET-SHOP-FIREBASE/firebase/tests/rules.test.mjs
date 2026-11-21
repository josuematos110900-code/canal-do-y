import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, writeBatch, collection, query, where, serverTimestamp, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import fs from 'fs';

const env = await initializeTestEnvironment({
  projectId: 'ketshop-test',
  firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  storage: { rules: fs.readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
});
let pass = 0, fail = 0;
async function t(name, p) { try { await p; pass++; console.log('  ok   ', name); } catch (e) { fail++; console.log('  FALHA', name, '-', e.message.split('\n')[0]); } }

// Dados iniciais (sem regras, como na consola)
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'roles/ADMIN'), { admin: true, operator: false });
  await setDoc(doc(db, 'roles/OPER'), { admin: false, operator: true });
  await setDoc(doc(db, 'categories/diamantes'), { name: 'Diamantes', slug: 'diamantes', is_active: true, sort_order: 1, game: 'Free Fire' });
  await setDoc(doc(db, 'products/p120'), { category_id: 'diamantes', name: '120 Diamantes', game: 'Free Fire', base_amount: 100, bonus_amount: 20, total_amount: 120,
    unit_label: 'diamantes', price_kz: 1050, is_active: true, is_on_demand: false, is_featured: true, sort_order: 2 });
  await setDoc(doc(db, 'products/off'), { category_id: 'diamantes', name: 'Off', game: 'Free Fire', base_amount: 1, bonus_amount: 0, total_amount: 1,
    unit_label: 'd', price_kz: 10, is_active: false, is_on_demand: false, is_featured: false, sort_order: 9 });
  await setDoc(doc(db, 'paymentMethods/iban'), { type: 'bank_transfer', name: 'IBAN', iban: 'AO06 0000 0000 0000 0000 0000 0', account_holder: 'TESTE', is_active: true, sort_order: 1, instructions: 'x' });
  await setDoc(doc(db, 'paymentMethods/inactive'), { type: 'paypay', name: 'PayPay', is_active: false, sort_order: 2 });
  await setDoc(doc(db, 'settings/public'), { maintenance_mode: false, store_name: 'KET SHOP' });
  await setDoc(doc(db, 'settings/private'), { secret_note: 'x' });
  for (const u of ['A', 'B']) await setDoc(doc(db, 'users/' + u), { full_name: 'Cliente ' + u, email: u + '@x.ao', is_blocked: false });
  await setDoc(doc(db, 'users/BLK'), { full_name: 'Bloqueado', email: 'b@x.ao', is_blocked: true });
});

const A = env.authenticatedContext('A', { email: 'A@x.ao' }).firestore();
const B = env.authenticatedContext('B', { email: 'B@x.ao' }).firestore();
const ADM = env.authenticatedContext('ADMIN').firestore();
const OPR = env.authenticatedContext('OPER').firestore();
const ANON = env.unauthenticatedContext().firestore();
const N = () => serverTimestamp();

function newOrder(code, uid, overrides = {}) {
  return Object.assign({ order_code: code, user_id: uid, status: 'pending_payment', game: 'Free Fire', player_id: '123456789', player_nickname: 'Nick',
    product_id: 'p120', order_items: [{ product_id: 'p120', product_name: '120 Diamantes', quantity: 1, unit_price_kz: 1050, line_total_kz: 1050, total_amount: 120,
      product_snapshot: { base_amount: 100, bonus_amount: 20, unit_label: 'diamantes' } }],
    subtotal_kz: 1050, total_kz: 1050, payment_method_id: null, payment_method_snapshot: null, customer_notes: null, is_on_demand: false,
    proof_count: 0, created_at: N(), updated_at: N() }, overrides);
}
function createOrderBatch(db, code, uid, ov) {
  const b = writeBatch(db);
  b.set(doc(db, 'orders/' + code), newOrder(code, uid, ov));
  b.set(doc(collection(db, 'orders/' + code + '/history')), { old_status: null, new_status: 'pending_payment', note: 'Encomenda criada', changed_by: uid, created_at: N() });
  b.set(doc(collection(db, 'notifications')), { user_id: uid, type: 'order_created', title: 'Encomenda recebida', body: 'x', order_id: code, is_read: false, created_by: uid, created_at: N() });
  return b.commit();
}
const C1 = 'KET-261121-ABC234';

console.log('Catálogo e definições');
await t('anónimo lê produtos activos', getDocs(query(collection(ANON, 'products'), where('is_active', '==', true))));
await t('anónimo NÃO lista todos os produtos', assertFails(getDocs(collection(ANON, 'products'))));
await t('cliente NÃO altera preço', assertFails(updateDoc(doc(A, 'products/p120'), { price_kz: 1 })));
await t('admin altera preço', assertSucceeds(updateDoc(doc(ADM, 'products/p120'), { price_kz: 1100 })));
await t('operador NÃO altera preço', assertFails(updateDoc(doc(OPR, 'products/p120'), { price_kz: 1050 })));
await t('admin repõe preço', assertSucceeds(updateDoc(doc(ADM, 'products/p120'), { price_kz: 1050 })));
await t('cliente só lista métodos activos', assertSucceeds(getDocs(query(collection(A, 'paymentMethods'), where('is_active', '==', true)))));
await t('anónimo NÃO lê métodos de pagamento', assertFails(getDocs(query(collection(ANON, 'paymentMethods'), where('is_active', '==', true)))));
await t('cliente lê settings/public', assertSucceeds(getDoc(doc(A, 'settings/public'))));
await t('cliente NÃO lê settings/private', assertFails(getDoc(doc(A, 'settings/private'))));
await t('cliente NÃO escreve settings', assertFails(updateDoc(doc(A, 'settings/public'), { maintenance_mode: true })));

console.log('Perfil e papéis');
await t('cliente NÃO se auto-desbloqueia/bloqueia', assertFails(updateDoc(doc(A, 'users/A'), { is_blocked: true })));
await t('cliente edita nome', assertSucceeds(updateDoc(doc(A, 'users/A'), { full_name: 'Cliente A Novo', updated_at: N() })));
await t('cliente NÃO lê perfil de B', assertFails(getDoc(doc(A, 'users/B'))));
await t('cliente NÃO se torna admin', assertFails(setDoc(doc(A, 'roles/A'), { admin: true, updated_by: 'A' })));
await t('admin NÃO retira o próprio admin', assertFails(setDoc(doc(ADM, 'roles/ADMIN'), { admin: false, operator: false, updated_by: 'ADMIN' })));
await t('admin cria operador', assertSucceeds(setDoc(doc(ADM, 'roles/B'), { admin: false, operator: false, updated_by: 'ADMIN' })));

console.log('Encomendas');
await t('preço adulterado é recusado', assertFails(createOrderBatch(A, 'KET-261121-AAAAA1', 'A', { total_kz: 1, subtotal_kz: 1 })));
await t('produto inactivo recusado', assertFails(createOrderBatch(A, 'KET-261121-AAAAA2', 'A', { product_id: 'off' })));
await t('ID de jogador inválido recusado', assertFails(createOrderBatch(A, 'KET-261121-AAAAA3', 'A', { player_id: 'abc' })));
await t('encomenda em nome de outro recusada', assertFails(createOrderBatch(A, 'KET-261121-AAAAA4', 'B')));
await t('conta bloqueada não encomenda', assertFails(createOrderBatch(env.authenticatedContext('BLK').firestore(), 'KET-261121-AAAAA5', 'BLK')));
await t('encomenda válida criada (com histórico e notificação)', assertSucceeds(createOrderBatch(A, C1, 'A')));
await t('código duplicado recusado', assertFails(createOrderBatch(A, C1, 'A')));
await t('B NÃO lê encomenda de A', assertFails(getDoc(doc(B, 'orders/' + C1))));
await t('B NÃO lista encomendas de A', assertFails(getDocs(query(collection(B, 'orders'), where('user_id', '==', 'A')))));
await t('A lista as suas encomendas', assertSucceeds(getDocs(query(collection(A, 'orders'), where('user_id', '==', 'A')))));
await t('A NÃO muda total', assertFails(updateDoc(doc(A, 'orders/' + C1), { total_kz: 1, updated_at: N() })));
await t('A NÃO aprova a própria encomenda', assertFails(updateDoc(doc(A, 'orders/' + C1), { status: 'payment_approved', updated_at: N() })));
await t('método inactivo recusado', assertFails(updateDoc(doc(A, 'orders/' + C1), { payment_method_id: 'inactive',
  payment_method_snapshot: { id: 'inactive', type: 'paypay', name: 'PayPay' }, updated_at: N() })));
await t('snapshot falsificado (IBAN diferente) recusado', assertFails(updateDoc(doc(A, 'orders/' + C1), { payment_method_id: 'iban',
  payment_method_snapshot: { id: 'iban', type: 'bank_transfer', name: 'IBAN', iban: 'AO06 9999 9999 9999 9999 9999 9', account_holder: 'TESTE', instructions: 'x' }, updated_at: N() })));
await t('método de pagamento escolhido', assertSucceeds(updateDoc(doc(A, 'orders/' + C1), { payment_method_id: 'iban',
  payment_method_snapshot: { id: 'iban', type: 'bank_transfer', name: 'IBAN', iban: 'AO06 0000 0000 0000 0000 0000 0', account_holder: 'TESTE', instructions: 'x',
    phone_number: null, entity: null, reference: null, account_number: null, bank_name: null }, updated_at: N() })));

console.log('Comprovativos (Storage + Firestore)');
const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const SA = env.authenticatedContext('A', { email: 'A@x.ao' }).storage();
const SB = env.authenticatedContext('B').storage();
const SADM = env.authenticatedContext('ADMIN').storage();
await t('A NÃO carrega na pasta de B', assertFails(uploadBytes(ref(SA, `proofs/B/${C1}/x.jpg`), img, { contentType: 'image/jpeg' })));
await t('B NÃO carrega para a encomenda de A', assertFails(uploadBytes(ref(SB, `proofs/B/${C1}/x.jpg`), img, { contentType: 'image/jpeg' })));
await t('PDF recusado', assertFails(uploadBytes(ref(SA, `proofs/A/${C1}/x.pdf`), img, { contentType: 'application/pdf' })));
await t('> 5 MB recusado', assertFails(uploadBytes(ref(SA, `proofs/A/${C1}/big.jpg`), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'image/jpeg' })));
await t('A carrega comprovativo JPG', assertSucceeds(uploadBytes(ref(SA, `proofs/A/${C1}/c1.jpg`), img, { contentType: 'image/jpeg' })));
await t('A NÃO sobrescreve o ficheiro', assertFails(uploadBytes(ref(SA, `proofs/A/${C1}/c1.jpg`), img, { contentType: 'image/jpeg' })));
await t('B NÃO lê o comprovativo de A', assertFails(getBytes(ref(SB, `proofs/A/${C1}/c1.jpg`))));
await t('admin lê o comprovativo', assertSucceeds(getBytes(ref(SADM, `proofs/A/${C1}/c1.jpg`))));

function submitProofBatch(db, uid, proofId, count, extra = {}) {
  const b = writeBatch(db);
  b.set(doc(db, `orders/${C1}/proofs/${proofId}`), Object.assign({ storage_path: `proofs/${uid}/${C1}/${proofId}.jpg`, file_name: 'c.jpg', mime_type: 'image/jpeg',
    size_bytes: 7, status: 'pending', user_id: uid, created_at: N() }, extra));
  b.update(doc(db, 'orders/' + C1), { status: 'proof_submitted', updated_at: N(), payment_submitted_at: N(), last_proof_id: proofId, proof_count: count, rejection_reason: null });
  b.set(doc(collection(db, `orders/${C1}/history`)), { old_status: 'pending_payment', new_status: 'proof_submitted', note: 'Comprovativo enviado', changed_by: uid, created_at: N() });
  return b.commit();
}
await t('estado alterado sem documento do comprovativo recusado', assertFails(updateDoc(doc(A, 'orders/' + C1),
  { status: 'proof_submitted', updated_at: N(), payment_submitted_at: N(), last_proof_id: 'nao-existe', proof_count: 1 })));
await t('comprovativo com caminho de outro utilizador recusado', assertFails(submitProofBatch(A, 'A', 'c1', 1, { storage_path: `proofs/B/${C1}/c1.jpg` })));
await t('comprovativo submetido', assertSucceeds(submitProofBatch(A, 'A', 'c1', 1)));

console.log('Equipa');
await t('admin vê todas as encomendas', assertSucceeds(getDocs(collection(ADM, 'orders'))));
await t('rejeição sem motivo recusada', assertFails(updateDoc(doc(OPR, 'orders/' + C1), { status: 'payment_rejected', processed_by: 'OPER', updated_at: N() })));
await t('transição inválida (→ concluída) recusada', assertFails(updateDoc(doc(OPR, 'orders/' + C1), { status: 'completed', processed_by: 'OPER', updated_at: N() })));
await t('operador rejeita com motivo', assertSucceeds((async () => { const b = writeBatch(OPR);
  b.update(doc(OPR, 'orders/' + C1), { status: 'payment_rejected', rejection_reason: 'Valor incorrecto', processed_by: 'OPER', updated_at: N() });
  b.update(doc(OPR, `orders/${C1}/proofs/c1`), { status: 'rejected', reviewed_by: 'OPER', reviewed_at: N(), review_notes: 'Valor incorrecto' });
  b.set(doc(collection(OPR, `orders/${C1}/history`)), { old_status: 'proof_submitted', new_status: 'payment_rejected', note: 'Valor incorrecto', changed_by: 'OPER', created_at: N() });
  b.set(doc(collection(OPR, 'notifications')), { user_id: 'A', type: 'payment_rejected', title: 'Pagamento rejeitado', body: 'x', order_id: C1, is_read: false, created_by: 'OPER', created_at: N() });
  await b.commit(); })()));
await t('A carrega novo comprovativo', assertSucceeds(uploadBytes(ref(SA, `proofs/A/${C1}/c2.jpg`), img, { contentType: 'image/jpeg' })));
await t('A reenvia comprovativo', assertSucceeds(submitProofBatch(A, 'A', 'c2', 2)));
for (const s of ['payment_approved', 'processing', 'completed'])
  await t('operador → ' + s, assertSucceeds(updateDoc(doc(OPR, 'orders/' + C1), { status: s, processed_by: 'OPER', updated_at: N() })));
await t('encomenda concluída não pode ser cancelada pelo cliente', assertFails(updateDoc(doc(A, 'orders/' + C1), { status: 'cancelled', cancel_reason: 'x', cancelled_at: N(), updated_at: N() })));
await t('ninguém apaga encomendas', assertFails((async () => { const { deleteDoc } = await import('firebase/firestore'); await deleteDoc(doc(ADM, 'orders/' + C1)); })()));

console.log('Notificações e auditoria');
await t('cliente NÃO cria notificação geral', assertFails(setDoc(doc(collection(A, 'notifications')), { user_id: 'A', type: 'general', title: 't', body: 'b', is_read: false, created_by: 'A', created_at: N() })));
await t('cliente NÃO notifica outro cliente', assertFails(setDoc(doc(collection(A, 'notifications')), { user_id: 'B', type: 'order_status', title: 't', body: 'b', is_read: false, created_by: 'A', created_at: N() })));
await t('operador envia notificação geral', assertSucceeds(setDoc(doc(collection(OPR, 'notifications')), { user_id: 'B', type: 'general', title: 'Promo', body: 'b', order_id: null, is_read: false, created_by: 'OPER', created_at: N() })));
const mine = await getDocs(query(collection(A, 'notifications'), where('user_id', '==', 'A')));
await t('A tem 2 notificações (criada + rejeitada)', mine.size === 2 ? Promise.resolve() : Promise.reject(new Error('tem ' + mine.size)));
await t('A marca como lida', assertSucceeds(updateDoc(mine.docs[0].ref, { is_read: true, read_at: N() })));
await t('A NÃO altera o texto', assertFails(updateDoc(mine.docs[0].ref, { title: 'hack' })));
await t('B NÃO lê notificações de A', assertFails(getDocs(query(collection(B, 'notifications'), where('user_id', '==', 'A')))));
await t('operador regista auditoria', assertSucceeds(setDoc(doc(collection(OPR, 'auditLogs')), { actor_id: 'OPER', action: 'order.status_changed', entity: 'orders', entity_id: C1, details: {}, created_at: N() })));
await t('operador NÃO lê auditoria', assertFails(getDocs(collection(OPR, 'auditLogs'))));
await t('admin lê auditoria', assertSucceeds(getDocs(collection(ADM, 'auditLogs'))));

console.log(`\n${pass} passaram, ${fail} falharam`);
await env.cleanup();
process.exit(fail ? 1 : 0);
