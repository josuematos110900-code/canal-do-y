import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, writeBatch, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, ref, uploadBytes } from 'firebase/storage';

const ROOT = new URL('../../admin-web', import.meta.url).pathname;
const FB = new URL('./node_modules/firebase', import.meta.url).pathname;
const SHOTS = process.argv[2];
const cfg = { apiKey: 'fake-api-key-for-emulator-000', authDomain: 'ketshop-test.firebaseapp.com', projectId: 'ketshop-test', storageBucket: 'ketshop-test.appspot.com', appId: '1:1:web:1' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok    ' + m); } else { fail++; console.log('  FALHA ' + m); } };

// --- admin no Auth + roles (como o 1.º admin criado na consola)
const R = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@ketshop.ao', password: 'Admin12345', returnSecureToken: true }) }).then((r) => r.json());
await fetch(`http://127.0.0.1:8080/v1/projects/ketshop-test/databases/(default)/documents/roles/${R.localId}`, { method: 'PATCH',
  headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { admin: { booleanValue: true } } }) });
await fetch(`http://127.0.0.1:8080/v1/projects/ketshop-test/databases/(default)/documents/users/${R.localId}`, { method: 'PATCH',
  headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { full_name: { stringValue: 'Admin Teste' }, email: { stringValue: 'admin@ketshop.ao' }, is_blocked: { booleanValue: false } } }) });

const browser = await chromium.launch({ args: ['--no-proxy-server', '--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults'] });
const errors = [];
async function newCtx(vp) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.route(/gstatic\.com\/firebasejs\//, (route) => {
    const m = route.request().url().match(/firebasejs\/[\d.]+\/(firebase-[a-z]+\.js)/);
    return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(FB, m[1])) });
  });
  await ctx.route('http://127.0.0.1:5055/**', (route) => {
    const p = route.request().url().replace('http://127.0.0.1:5055/', '').split('?')[0] || 'index.html';
    if (p === 'js/config.js') return route.fulfill({ contentType: 'application/javascript', body: `window.KETSHOP_CONFIG={firebase:${JSON.stringify(cfg)},USE_EMULATORS:true};` });
    const type = p.endsWith('.css') ? 'text/css' : p.endsWith('.js') ? 'application/javascript' : p.endsWith('.svg') ? 'image/svg+xml' : p.endsWith('.png') ? 'image/png' : 'text/html';
    return route.fulfill({ contentType: type, body: fs.readFileSync(path.join(ROOT, p)) });
  });
  return ctx;
}
const ctx = await newCtx({ width: 1366, height: 900 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', (d) => d.accept());

console.log('Painel');
await page.goto('http://127.0.0.1:5055/dashboard.html');
await page.waitForURL(/login\.html/);
ok(true, 'sem sessão → redireccionado para login');
await page.fill('#email', 'admin@ketshop.ao'); await page.fill('#password', 'errada1234'); await page.click('#login-btn');
await page.waitForSelector('#login-alert:not(.hidden)'); ok((await page.textContent('#login-alert')).includes('incorrectos'), 'palavra-passe errada mostra erro');
await page.fill('#password', 'Admin12345'); await page.click('#login-btn');
await page.waitForURL(/dashboard\.html/); await page.waitForTimeout(800);
ok((await page.textContent('#dash-hello')).includes('Admin'), 'login admin → dashboard');

await page.goto('http://127.0.0.1:5055/settings.html'); await page.waitForSelector('#seed-btn');
await page.click('#seed-btn'); await page.click('.modal [data-act="yes"]');
await page.waitForSelector('.toast.success', { timeout: 15000 });
ok((await page.textContent('.toast.success')).includes('21 registo'), 'catálogo inicial criado (21 registos: 2 categorias, 13 produtos, 4 métodos, 2 definições)');
await page.fill('#s-support_whatsapp', '244900000000'); await page.click('#set-save'); await page.waitForTimeout(800);

await page.goto('http://127.0.0.1:5055/products.html'); await page.waitForSelector('#prod-body tr td b');
ok((await page.$$('#prod-body tr')).length === 13, '13 produtos listados');
const p120 = await page.textContent('#prod-body');
ok(p120.includes('191.100 Kz') && p120.includes('1.050 Kz'), 'preços formatados em Kz');

await page.goto('http://127.0.0.1:5055/payments.html'); await page.waitForSelector('[data-edit="bank_transfer"]');
await page.click('[data-edit="bank_transfer"]');
await page.fill('input[name="iban"]', 'AO06 0000 0000 0000 0000 0000 0'); await page.fill('input[name="account_holder"]', 'KET SHOP TESTE');
await page.check('input[name="is_active"]'); await page.click('#mf-save'); await page.waitForTimeout(800);
ok((await page.textContent('#pm-body')).includes('activo'), 'método IBAN preenchido e activado');

// --- cliente (SDK, mesmas escritas que a app Android)
console.log('Cliente cria encomenda e envia comprovativo');
const capp = initializeApp(cfg, 'cliente'); const cauth = getAuth(capp); connectAuthEmulator(cauth, 'http://127.0.0.1:9099', { disableWarnings: true });
const cdb = getFirestore(capp); connectFirestoreEmulator(cdb, '127.0.0.1', 8080);
const cst = getStorage(capp); connectStorageEmulator(cst, '127.0.0.1', 9199);
const cu = (await createUserWithEmailAndPassword(cauth, 'cli@teste.ao', 'Senha1234')).user;
await setDoc(doc(cdb, 'users', cu.uid), { full_name: 'Cliente Teste', email: 'cli@teste.ao', phone: null, is_blocked: false, created_at: serverTimestamp(), updated_at: serverTimestamp() });
const prod = (await getDoc(doc(cdb, 'products/ff-dia-120'))).data();
const code = 'KET-261121-TST234';
let b = writeBatch(cdb);
b.set(doc(cdb, 'orders', code), { order_code: code, user_id: cu.uid, status: 'pending_payment', game: prod.game, player_id: '123456789', player_nickname: '<b>Nick</b>',
  product_id: 'ff-dia-120', order_items: [{ product_id: 'ff-dia-120', product_name: prod.name, quantity: 1, unit_price_kz: prod.price_kz, line_total_kz: prod.price_kz,
  total_amount: prod.total_amount, product_snapshot: { base_amount: 100, bonus_amount: 20, unit_label: 'diamantes' } }],
  subtotal_kz: prod.price_kz, total_kz: prod.price_kz, payment_method_id: null, payment_method_snapshot: null, customer_notes: null, is_on_demand: false, proof_count: 0,
  created_at: serverTimestamp(), updated_at: serverTimestamp() });
b.set(doc(collection(cdb, `orders/${code}/history`)), { old_status: null, new_status: 'pending_payment', note: 'Encomenda criada', changed_by: cu.uid, created_at: serverTimestamp() });
await b.commit();
const pm = (await getDoc(doc(cdb, 'paymentMethods/bank_transfer'))).data();
b = writeBatch(cdb);
b.update(doc(cdb, 'orders', code), { payment_method_id: 'bank_transfer', updated_at: serverTimestamp(), payment_method_snapshot: { id: 'bank_transfer', type: pm.type, name: pm.name,
  iban: pm.iban, phone_number: pm.phone_number, entity: pm.entity, reference: pm.reference, account_number: pm.account_number, account_holder: pm.account_holder,
  bank_name: pm.bank_name, instructions: pm.instructions } });
await b.commit();
const png = fs.readFileSync(new URL('../../android-app/store-assets/ic_launcher_512.png', import.meta.url));
await uploadBytes(ref(cst, `proofs/${cu.uid}/${code}/comprovativo_1.png`), png, { contentType: 'image/png' });
b = writeBatch(cdb);
b.set(doc(cdb, `orders/${code}/proofs/p1`), { storage_path: `proofs/${cu.uid}/${code}/comprovativo_1.png`, file_name: 'c.png', mime_type: 'image/png', size_bytes: png.length,
  status: 'pending', user_id: cu.uid, created_at: serverTimestamp() });
b.update(doc(cdb, 'orders', code), { status: 'proof_submitted', updated_at: serverTimestamp(), payment_submitted_at: serverTimestamp(), last_proof_id: 'p1', proof_count: 1, rejection_reason: null });
await b.commit();
ok(true, 'encomenda + método + comprovativo submetidos pelo cliente');

console.log('Admin revê e aprova');
await page.goto('http://127.0.0.1:5055/orders.html?filter=review'); await page.waitForSelector(`tr[data-id="${code}"]`, { timeout: 10000 });
ok(true, 'encomenda aparece em "Por verificar"');
await page.click(`tr[data-id="${code}"]`); await page.waitForSelector('#order-actions [data-status]');
ok(await page.evaluate(() => document.querySelector('.modal').innerText.includes('<b>Nick</b>') && !document.querySelector('.modal dd b b')), 'nickname escapado (sem injecção HTML)');
await page.waitForSelector('.proof-thumb img', { timeout: 10000 });
const loaded = await page.$eval('.proof-thumb img', (img) => new Promise((r) => img.complete ? r(img.naturalWidth) : (img.onload = () => r(img.naturalWidth), img.onerror = () => r(0))));
ok(loaded === 512, 'imagem do comprovativo carregada do Storage privado (' + loaded + 'px)');
if (SHOTS) await page.screenshot({ path: SHOTS + '/fb-order-modal.png' });
await page.click('#order-actions [data-status="payment_rejected"]');
await page.fill('.modal textarea:not(#admin-notes)', 'Valor incorrecto'); await page.click('.modal [data-act="yes"]');
await page.waitForSelector('.toast.success', { timeout: 10000 });
let o = (await getDoc(doc(cdb, 'orders', code))).data();
ok(o.status === 'payment_rejected' && o.rejection_reason === 'Valor incorrecto', 'rejeitado com motivo (cliente vê o estado)');
const notifs = (await getDocs(query(collection(cdb, 'notifications'), where('user_id', '==', cu.uid)))).docs.map((d) => d.data());
ok(notifs.some((n) => n.type === 'payment_rejected' && n.body.includes('Valor incorrecto')), 'cliente recebeu notificação de rejeição');
ok((await getDoc(doc(cdb, `orders/${code}/proofs/p1`))).data().status === 'rejected', 'comprovativo marcado como rejeitado');
// cliente reenvia
await uploadBytes(ref(cst, `proofs/${cu.uid}/${code}/comprovativo_2.png`), png, { contentType: 'image/png' });
b = writeBatch(cdb);
b.set(doc(cdb, `orders/${code}/proofs/p2`), { storage_path: `proofs/${cu.uid}/${code}/comprovativo_2.png`, file_name: 'c2.png', mime_type: 'image/png', size_bytes: png.length,
  status: 'pending', user_id: cu.uid, created_at: serverTimestamp() });
b.update(doc(cdb, 'orders', code), { status: 'proof_submitted', updated_at: serverTimestamp(), payment_submitted_at: serverTimestamp(), last_proof_id: 'p2', proof_count: 2, rejection_reason: null });
await b.commit();
await page.waitForTimeout(1500);
for (const s of ['payment_approved', 'processing', 'completed']) {
  await page.waitForSelector(`#order-actions [data-status="${s}"]`, { timeout: 10000 });
  await page.click(`#order-actions [data-status="${s}"]`); await page.click('.modal-backdrop:last-child [data-act="yes"]');
  await page.waitForFunction((s) => document.querySelector('.modal .pill') && document.querySelector('.modal .pill').className.includes(s), s, { timeout: 10000 });
}
o = (await getDoc(doc(cdb, 'orders', code))).data();
ok(o.status === 'completed' && o.approved_at && o.completed_at, 'aprovado → processamento → concluído');
const hist = (await getDocs(collection(cdb, `orders/${code}/history`))).size;
ok(hist === 5, 'histórico com 5 entradas do painel e da criação (' + hist + ')');

console.log('Outras páginas (sem erros JS, sem scroll horizontal no telemóvel)');
for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
  const p2 = vp.width === 1366 ? page : await (async () => { const c2 = await newCtx(vp); const pg = await c2.newPage();
    pg.on('pageerror', (e) => errors.push(e.message)); pg.on('dialog', (d) => d.accept());
    await pg.goto('http://127.0.0.1:5055/login.html'); await pg.fill('#email', 'admin@ketshop.ao'); await pg.fill('#password', 'Admin12345'); await pg.click('#login-btn');
    await pg.waitForURL(/dashboard/); return pg; })();
  for (const pg of ['dashboard', 'orders', 'products', 'customers', 'payments', 'notifications', 'reports', 'settings', 'audit']) {
    const before = errors.length;
    await p2.goto(`http://127.0.0.1:5055/${pg}.html`); await p2.waitForTimeout(1200);
    const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(errors.length === before && !overflow, `${vp.width}px ${pg}` + (errors.length > before ? ' ' + errors.slice(before).join(' | ') : '') + (overflow ? ' [overflow]' : ''));
    if (SHOTS && ['dashboard', 'customers', 'reports'].includes(pg)) await p2.screenshot({ path: `${SHOTS}/fb-${vp.width}-${pg}.png` });
  }
}
ok((await page.goto('http://127.0.0.1:5055/reports.html'), await page.waitForTimeout(1500), (await page.textContent('#rep-revenue')).includes('1.050 Kz')), 'relatório: receita 1.050 Kz');
await page.goto('http://127.0.0.1:5055/audit.html'); await page.waitForTimeout(1200);
ok((await page.$$('#aud-body tr')).length >= 6, 'auditoria regista as acções');
await page.goto('http://127.0.0.1:5055/customers.html'); await page.waitForTimeout(1200);
ok((await page.textContent('#cust-body')).includes('Cliente Teste'), 'cliente listado com total gasto');

console.log(`\n${pass} passaram, ${fail} falharam`);
if (errors.length) console.log('ERRCONSOLE ' + JSON.stringify(errors.slice(0, 8)));
await browser.close();
process.exit(fail ? 1 : 0);
