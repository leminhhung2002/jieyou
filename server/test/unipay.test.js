import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { adminStore } from '../src/services/adminStore.js';
import { accountStore } from '../src/services/accountStore.js';
import { userStore } from '../src/services/userStore.js';
import { _resetOtps } from '../src/services/otpService.js';
import { encrypt, decrypt, unipay, cleanPaymentUrl, bvbankVerifyUrl } from '../src/services/unipay.js';
import { reconcilePending } from '../src/services/topupPayments.js';

/* ---------------- UniPay giả lập: body `{ data: hex(IV+AES-256-CBC) }`, response JSON thường ---------------- */

const AES = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const fake = { requests: [], qrTxs: [], logins: 0, ecomError: null };

const provider = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const send = (status, o) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(o));
    };
    let body = null;
    if (raw) {
      try {
        body = JSON.parse(decrypt(JSON.parse(raw).data, Buffer.from(AES, 'hex')));
      } catch {
        return send(401, { error: 'failed to decrypt body' });
      }
    }
    const url = new URL(req.url, 'http://x');
    fake.requests.push({ path: url.pathname, headers: req.headers, body });
    if (req.headers['partner-code'] !== 'KH_TEST') return send(400, { message: 'bad partner' });
    if (url.pathname === '/openapi/v1/auth/login') {
      if (body.username !== 'u' || body.client_secret !== 'cs') return send(401, { message: 'bad creds' });
      fake.logins++;
      return send(200, { access_token: `tok${fake.logins}`, expires_in: 3600, token_type: 'Bearer' });
    }
    if (!/^Bearer tok\d+$/.test(req.headers.authorization || '')) return send(401, { code: 'AUTHEN_FAIL', message: 'Unauthorized' });
    switch (url.pathname) {
      case '/openapi/v1/transaction/qr/generate':
        assert.equal(req.headers['x-service-code'], 'vccb-qr');
        return send(200, { qr_content: `QR-${body.order_id}-${body.amount}`, image_png_base64: 'iVBORw0KGgo=', checkout_url: `https://checkout.test/${body.order_id}` });
      case '/openapi/v1/ecom/payments/link':
        if (fake.ecomError) return send(400, { code: 400, message: fake.ecomError });
        return send(200, { payment_id: 'P1', status: 'created', order_id: body.order_id, payment_url: `https://pay.test/${body.order_id}?paymentId=P1&amp;amp;sign=abc` });
      case '/openapi/v1/transaction/qr':
        return send(200, { data: fake.qrTxs, pagination: { page: 1, limit: 100, total_items: fake.qrTxs.length, total_pages: 1 } });
      default:
        return send(404, { message: 'not found' });
    }
  });
});

const saved = { ...config.unipay };
let server;
let base;

before(async () => {
  provider.listen(0);
  await new Promise((r) => provider.once('listening', r));
  Object.assign(config.unipay, {
    baseUrl: `http://127.0.0.1:${provider.address().port}`,
    partnerCode: 'KH_TEST',
    username: 'u',
    password: 'p',
    clientId: 'cid',
    clientSecret: 'cs',
    aesKey: AES,
    bankAccountNo: '31050911',
    bincode: '970454',
    qrServiceCode: 'vccb-qr',
    ecomServiceCode: 'ecom',
  });
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => {
  server.close();
  provider.close();
  Object.assign(config.unipay, saved);
});
beforeEach(async () => {
  userStore._reset();
  _resetOtps();
  await adminStore.seed();
  accountStore.seed();
  Object.assign(fake, { requests: [], qrTxs: [], ecomError: null });
  unipay._resetToken();
});

const call = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

async function loginAnPhat() {
  const r = await call('POST', '/auth/otp/request', { phone: '0912345678', purpose: 'login' });
  const v = await call('POST', '/auth/otp/verify', { phone: '0912345678', purpose: 'login', code: r.body.data.devCode });
  return v.body.data.token;
}
const balanceOf = () => userStore.findByPhone('0912345678').balance;
const ipn = (payload) => call('POST', '/payments/unipay/ipn', { data: encrypt(JSON.stringify(payload), Buffer.from(AES, 'hex')) });

test('mã hóa AES-256-CBC: IV ngẫu nhiên, giải mã lại đúng', () => {
  const k = Buffer.from(AES, 'hex');
  const a = encrypt('{"order_id":"222","amount":"10000"}', k);
  const b = encrypt('{"order_id":"222","amount":"10000"}', k);
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]+$/);
  assert.equal(decrypt(a, k), '{"order_id":"222","amount":"10000"}');
  assert.throws(() => decrypt('zz', k));
});

test('nạp QR: tạo đơn chờ, chưa cộng tiền; IPN hợp lệ mới cộng, gửi lại không cộng hai lần', async () => {
  const token = await loginAnPhat();
  const before = balanceOf();
  const r = await call('POST', '/account/topups', { amount: 500_000, method: 'qr' }, token);
  assert.equal(r.status, 201);
  const p = r.body.data.payment;
  assert.equal(p.status, 'pending');
  assert.equal(p.method, 'qr');
  assert.ok(p.orderId.length <= 30);
  assert.equal(p.qrContent, `QR-${p.orderId}-500000`);
  assert.equal(p.checkoutUrl, `https://checkout.test/${p.orderId}`);
  assert.equal(balanceOf(), before);

  const gen = fake.requests.find((x) => x.path.endsWith('/qr/generate'));
  assert.equal(gen.body.va, '31050911');
  assert.equal(gen.body.bincode, '970454');
  assert.equal(gen.headers.authorization, 'Bearer tok1');

  // Khách chỉ thấy giao dịch đã thành công trong lịch sử
  const hist = await call('GET', '/account/transactions', undefined, token);
  assert.ok(!hist.body.data.some((t) => t.id === p.id));

  // IPN giả mạo (sai khóa) bị từ chối
  const forged = await call('POST', '/payments/unipay/ipn', { data: encrypt(JSON.stringify({ order_id: p.orderId, amount: 500_000 }), Buffer.alloc(32, 7)) });
  assert.equal(forged.status, 400);
  assert.equal((await call('POST', '/payments/unipay/ipn', { data: 'abc' })).status, 400);
  assert.equal(balanceOf(), before);

  const ok = await ipn({ order_id: p.orderId, amount: 500_000, payment_type: 'QR', retrieval_ref_no: 'FT123' });
  assert.equal(ok.status, 200);
  assert.equal(balanceOf(), before + 500_000);
  assert.equal((await ipn({ order_id: p.orderId, amount: 500_000, retrieval_ref_no: 'FT123' })).status, 200);
  assert.equal(balanceOf(), before + 500_000);

  const st = await call('GET', `/account/topups/${p.id}`, undefined, token);
  assert.equal(st.body.data.status, 'success');
  assert.equal(st.body.data.qrImage, null);
  assert.equal(st.body.data.balance, before + 500_000);
  const tx = adminStore.listTransactions().find((t) => t.id === p.id);
  assert.equal(tx.bvRef, 'FT123');
  assert.equal(tx.reconciled, true);
  const hist2 = await call('GET', '/account/transactions', undefined, token);
  assert.match(hist2.body.data.find((t) => t.id === p.id).description, /UniPay/);
});

test('IPN chuyển thiếu không cộng tiền; đơn lạ trả 404', async () => {
  const token = await loginAnPhat();
  const before = balanceOf();
  const { body } = await call('POST', '/account/topups', { amount: 1_000_000 }, token);
  const p = body.data.payment;
  assert.equal((await ipn({ order_id: p.orderId, amount: 100_000 })).status, 200);
  assert.equal(balanceOf(), before);
  assert.match(adminStore.listTransactions().find((t) => t.id === p.id).note, /cần kiểm tra/);
  assert.equal((await ipn({ order_id: 'KHONGCO', amount: 1 })).status, 404);
});

test('đối soát qua API tra cứu khi IPN không tới', async () => {
  const token = await loginAnPhat();
  const before = balanceOf();
  const { body } = await call('POST', '/account/topups', { amount: 200_000 }, token);
  const p = body.data.payment;
  assert.equal(await reconcilePending(), 0);
  fake.qrTxs = [{ trn_ref_no: 'FT999', amount: '200000', order_id: p.orderId, txn_init_dt: '2026-11-11 10:00:00' }];
  // Trang chờ hỏi trạng thái → server tra cứu UniPay và cộng tiền
  const st = await call('GET', `/account/topups/${p.id}`, undefined, token);
  assert.equal(st.body.data.status, 'success');
  assert.equal(balanceOf(), before + 200_000);
  assert.equal(await reconcilePending(), 0);
});

test('thẻ ECOM: trả link thanh toán; UniPay lỗi → 502, giao dịch đánh dấu thất bại', async () => {
  const token = await loginAnPhat();
  const r = await call('POST', '/account/topups', { amount: 300_000, method: 'card' }, token);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.payment.paymentUrl, `https://pay.test/${r.body.data.payment.orderId}?paymentId=P1&sign=abc`);
  const link = fake.requests.find((x) => x.path.endsWith('/ecom/payments/link'));
  assert.equal(link.headers['x-service-code'], 'ecom');
  assert.match(link.body.ipn_url, /\/api\/payments\/unipay\/ipn$/);

  fake.ecomError = 'Decryption error';
  const bad = await call('POST', '/account/topups', { amount: 300_000, method: 'card' }, token);
  assert.equal(bad.status, 502);
  assert.match(bad.body.error.message, /QR/);
  assert.equal(adminStore.listTransactions()[0].status, 'failed');
  assert.equal((await call('POST', '/account/topups', { amount: 300_000, method: 'baoviet' }, token)).status, 400);
});

test('IPN thẻ báo thất bại → lệnh nạp thất bại, không cộng tiền', async () => {
  const token = await loginAnPhat();
  const before = balanceOf();
  const { body } = await call('POST', '/account/topups', { amount: 300_000, method: 'card' }, token);
  const p = body.data.payment;
  assert.equal((await ipn({ order_id: p.orderId, amount: 300_000, status: 'DECLINED' })).status, 200);
  assert.equal(balanceOf(), before);
  assert.equal(adminStore.listTransactions().find((t) => t.id === p.id).status, 'failed');
});

test('làm sạch payment_url bị escape và chỉ đối soát với host BvBank cố định', () => {
  assert.equal(cleanPaymentUrl('https://a.vn/p?paymentId=X1&amp;amp;sign=s%2B'), 'https://a.vn/p?paymentId=X1&sign=s%2B');
  const v = bvbankVerifyUrl('https://checkout-payment.bvbank.net.vn/pay?paymentId=ABC123&amp;sign=zz');
  assert.equal(v.url, 'https://api-inscope-pos.bvbank.net.vn/v1/checkout/payments/ABC123/verify?sign=zz');
  assert.equal(bvbankVerifyUrl('https://evil.test/pay?paymentId=ABC123&sign=zz'), null);
});

test('token bị thu hồi → tự đăng nhập lại', async () => {
  const token = await loginAnPhat();
  await call('POST', '/account/topups', { amount: 100_000 }, token);
  assert.equal(fake.logins >= 1, true);
  const n = fake.logins;
  unipay._resetToken();
  await call('POST', '/account/topups', { amount: 100_000 }, token);
  assert.equal(fake.logins, n + 1);
});

test('khách không xem được lệnh nạp của người khác', async () => {
  const token = await loginAnPhat();
  const other = adminStore.listTransactions().find((t) => t.customerId !== userStore.findByPhone('0912345678').id);
  assert.equal((await call('GET', `/account/topups/${other.id}`, undefined, token)).status, 404);
});
