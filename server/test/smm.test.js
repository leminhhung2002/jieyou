import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { adminStore } from '../src/services/adminStore.js';
import { accountStore } from '../src/services/accountStore.js';
import { userStore } from '../src/services/userStore.js';
import { _resetOtps } from '../src/services/otpService.js';
import { _resetSmmCatalog } from '../src/services/smmCatalog.js';
import { syncProviderOrders } from '../src/services/smmSync.js';

/* ---------------- hotrodvfb giả lập (API V2: luôn HTTP 200, lỗi ở trường `error`) ---------------- */

const SERVICES = [
  { service: 63, name: 'Like Speed', type: 'Reaction', category: 'Like', description: 'Like Việt', rate: '1', min: '10', max: '50000', refill: false, refill_days: 0, cancel: true, platform: 'Facebook', data: { allow_reaction: true, reactions: ['like', 'love'] } },
  { service: 70, name: 'Comment', type: 'Custom Comments', category: 'Comment', description: '', rate: '20', min: '2', max: '100', refill: false, cancel: false, platform: 'Facebook', data: {} },
  { service: 523, name: 'Vip Like', type: 'Vip Default', category: 'VIP', rate: '87.5', min: '50', max: '1000', platform: 'Facebook', data: {}, is_vip: true },
  { service: 80, name: 'Live', type: 'Custom Livestream', category: 'Live', rate: '5', min: '10', max: '1000', platform: 'Facebook', data: {} },
  { service: 90, name: 'Shopee like', type: 'Default', category: 'Like', rate: '1', min: '10', max: '1000', platform: 'Shopee', data: {} },
];
const fake = { requests: [], orders: new Map(), nextOrder: 1000, addError: null };

const provider = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const p = Object.fromEntries(new URLSearchParams(raw));
    fake.requests.push(p);
    const send = (o) => res.end(JSON.stringify(o));
    if (p.key !== 'test-key') return send({ error: 'Key không hợp lệ*', code: 401 });
    switch (p.action) {
      case 'services':
        return send(SERVICES);
      case 'balance':
        return send({ balance: '100', currency: 'USD', rate: '25000', success: true });
      case 'add': {
        if (fake.addError) return send({ error: fake.addError, code: 400 });
        const order = fake.nextOrder++;
        fake.orders.set(String(order), { status: 'Pending', charge: '0.001', start_count: '5', remains: p.quantity, currency: 'USD' });
        return send({ order, start_count: 5 });
      }
      case 'status': {
        const ids = p.order.split(',');
        if (ids.length === 1) return send(fake.orders.get(ids[0]) || { error: 'Không tìm thấy đơn hàng này*', code: 400 });
        return send(Object.fromEntries(ids.map((id) => [id, fake.orders.get(id) || { error: 'Không tìm thấy đơn hàng này*' }])));
      }
      case 'get_numeric_uid':
        return send({ id: '100000000001', link: 'https://www.facebook.com/100000000001', name: 'An Phát', success: true });
      default:
        return send({ error: 'Action không hợp lệ*', code: 400 });
    }
  });
});

let server;
let base;
const saved = { ...config.smm };

before(async () => {
  provider.listen(0);
  await new Promise((r) => provider.once('listening', r));
  Object.assign(config.smm, { apiKey: 'test-key', apiUrl: `http://127.0.0.1:${provider.address().port}/api/v2`, markupPercent: 20 });
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => {
  Object.assign(config.smm, saved);
  server.close();
  provider.close();
});
beforeEach(async () => {
  userStore._reset();
  _resetOtps();
  _resetSmmCatalog();
  await adminStore.seed();
  accountStore.seed();
  Object.assign(fake, { requests: [], orders: new Map(), nextOrder: 1000, addError: null });
});

const call = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
async function loginAnPhat() {
  const r = await call('POST', '/auth/otp/request', { phone: '0912345678', purpose: 'login' });
  const v = await call('POST', '/auth/otp/verify', { phone: '0912345678', purpose: 'login', code: r.body.data.devCode });
  return v.body.data.token;
}
const anPhat = () => userStore.findByPhone('0912345678');
const START = 12_480_000;
const likeOrder = (extra = {}) => ({
  type: 'social',
  details: { service: 63, link: 'https://www.facebook.com/100000000001/posts/1', quantity: 1000, reaction: 'love', acceptedWarning: true, ...extra },
});

/* ------------------------------------ tests ------------------------------------ */

test('danh mục: bỏ VIP / livestream / nền tảng không hỗ trợ, giá VND = rate × tỉ giá × (1 + lãi)', async () => {
  const token = await loginAnPhat();
  assert.equal((await call('GET', '/account/catalog', undefined, token)).body.data.smm.enabled, true);
  const r = await call('GET', '/account/social/services', undefined, token);
  assert.equal(r.status, 200);
  const ids = r.body.data.services.map((s) => s.id).sort();
  assert.deepEqual(ids, [63, 70]);
  const like = r.body.data.services.find((s) => s.id === 63);
  assert.equal(like.pricePer1000, 30_000); // 1 USD × 25.000 × 1,2
  assert.deepEqual(like.reactions, ['like', 'love']);
  assert.equal(like.providerRate, undefined); // không lộ giá gốc
});

test('đặt đơn: trừ tiền, gửi đúng tham số sang NCC, admin không duyệt tay được', async () => {
  const token = await loginAnPhat();
  const r = await call('POST', '/account/applications', likeOrder(), token);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.balance, START - 30_000);
  const add = fake.requests.find((q) => q.action === 'add');
  assert.equal(add.service, '63');
  assert.equal(add.quantity, '1000');
  assert.equal(add.reaction, 'love');
  assert.equal(add.note, r.body.data.application.code);
  const app = adminStore.findApplication(r.body.data.application.code);
  assert.equal(app.meta.provider.order, 1000);
  assert.equal(app.details['Mã đơn NCC'], '1000');

  const admin = await call('POST', '/admin/auth/login', { username: 'admin', password: config.adminDefaultPassword });
  const adminToken = admin.body.data.token;
  const ap = await call('POST', `/admin/applications/${app.code}/approve`, {}, adminToken);
  assert.equal(ap.status, 409);
});

test('kiểm tra dữ liệu: số lượng ngoài min-max, cảm xúc sai, bình luận tính theo số dòng', async () => {
  const token = await loginAnPhat();
  assert.equal((await call('POST', '/account/applications', likeOrder({ quantity: 5 }), token)).body.error.details.field, 'quantity');
  assert.equal((await call('POST', '/account/applications', likeOrder({ reaction: 'angry' }), token)).body.error.details.field, 'reaction');
  assert.equal((await call('POST', '/account/applications', likeOrder({ service: 523 }), token)).body.error.details.field, 'service');
  const c = await call('POST', '/account/applications', {
    type: 'social',
    details: { service: 70, link: 'https://facebook.com/p/1', quantity: 999, comments: 'Hay quá\n\nỦng hộ shop\nTuyệt', acceptedWarning: true },
  }, token);
  assert.equal(c.status, 201);
  const add = fake.requests.find((q) => q.action === 'add');
  assert.equal(add.quantity, '3');
  assert.equal(add.comments, 'Hay quá\nỦng hộ shop\nTuyệt');
  assert.equal(c.body.data.balance, START - Math.ceil((600_000 * 3) / 1000));
  assert.equal(fake.requests.filter((q) => q.action === 'add').length, 1);
});

test('NCC từ chối: hoàn tác hồ sơ và tiền; NCC hết tiền → 503 không lộ lỗi nội bộ', async () => {
  const token = await loginAnPhat();
  const before = adminStore.listApplications().length;
  fake.addError = 'Link không hợp lệ*';
  const r = await call('POST', '/account/applications', likeOrder(), token);
  assert.equal(r.status, 400);
  assert.equal(r.body.error.message, 'Link không hợp lệ');
  assert.equal(anPhat().balance, START);
  assert.equal(adminStore.listApplications().length, before);
  assert.ok(!adminStore.listTransactions().some((t) => t.type === 'hold' && t.customerId === anPhat().id && t.amount === -30_000));

  fake.addError = 'Tài khoản không đủ tiền*';
  const r2 = await call('POST', '/account/applications', likeOrder(), token);
  assert.equal(r2.status, 503);
  assert.equal(anPhat().balance, START);
});

test('đồng bộ: Completed → hoàn thành; Partial → hoàn phần chưa chạy; Canceled → từ chối, hoàn toàn bộ', async () => {
  const token = await loginAnPhat();
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await call('POST', '/account/applications', likeOrder(), token)).body.data.application.code);
  assert.equal(anPhat().balance, START - 90_000);

  fake.orders.get('1000').status = 'In progress';
  assert.equal(await syncProviderOrders(), 0);
  assert.equal(adminStore.findApplication(codes[0]).details['Trạng thái'], 'Đang chạy');

  Object.assign(fake.orders.get('1000'), { status: 'Completed', remains: '0' });
  Object.assign(fake.orders.get('1001'), { status: 'Partial', remains: '250' });
  Object.assign(fake.orders.get('1002'), { status: 'Canceled', remains: '1000' });
  assert.equal(await syncProviderOrders(), 3);

  const [done, partial, canceled] = codes.map((c) => adminStore.findApplication(c));
  assert.equal(done.status, 'approved');
  assert.equal(partial.status, 'approved');
  assert.equal(partial.amount, 22_500);
  assert.equal(canceled.status, 'rejected');
  assert.equal(anPhat().balance, START - 30_000 - 22_500);
  assert.ok(accountStore.invoiceOf(done.code));
  // Đã kết thúc → không đồng bộ / hoàn tiền lần nữa
  assert.equal(await syncProviderOrders(), 0);
  assert.equal(anPhat().balance, START - 52_500);
});

test('đổi link Facebook sang UID số', async () => {
  const token = await loginAnPhat();
  const r = await call('POST', '/account/social/uid', { link: 'https://www.facebook.com/anphat' }, token);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.link, 'https://www.facebook.com/100000000001');
  assert.equal((await call('POST', '/account/social/uid', { link: 'abc' }, token)).status, 400);
});

test('admin: xem giá gốc / giá bán, chỉnh % lãi, đặt giá riêng, ẩn dịch vụ', async () => {
  const adminToken = (await call('POST', '/admin/auth/login', { username: 'admin', password: config.adminDefaultPassword })).body.data.token;
  const editor = (await call('POST', '/admin/auth/login', { username: 'bientap01', password: config.adminDefaultPassword })).body.data.token;
  const token = await loginAnPhat();
  const price = async (id) => (await call('GET', '/account/social/services', undefined, token)).body.data.services.find((s) => s.id === id)?.pricePer1000;

  const r = await call('GET', '/admin/smm', undefined, editor);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.markupPercent, 20);
  assert.equal(r.body.data.balance.usd, 100);
  const like = r.body.data.services.find((s) => s.id === 63);
  assert.equal(like.costPer1000, 25_000);
  assert.equal(like.pricePer1000, 30_000);

  // % lãi chung
  assert.equal((await call('PATCH', '/admin/smm/settings', { markupPercent: -5 }, adminToken)).status, 400);
  assert.equal((await call('PATCH', '/admin/smm/settings', { markupPercent: 50 }, adminToken)).status, 200);
  assert.equal(await price(63), 37_500);

  // Giá riêng cho một dịch vụ, áp dụng khi đặt đơn
  assert.equal((await call('PATCH', '/admin/smm/services/63', { price: 1.5 }, adminToken)).status, 400);
  const p = await call('PATCH', '/admin/smm/services/63', { price: 28_000 }, adminToken);
  assert.equal(p.body.data.customPrice, 28_000);
  assert.equal(await price(63), 28_000);
  const o = await call('POST', '/account/applications', likeOrder(), token);
  assert.equal(o.body.data.balance, START - 28_000);

  // Về giá mặc định; ẩn dịch vụ → khách không thấy, không đặt được
  await call('PATCH', '/admin/smm/services/63', { price: null }, adminToken);
  assert.equal(await price(63), 37_500);
  await call('PATCH', '/admin/smm/services/63', { disabled: true }, adminToken);
  assert.equal(await price(63), undefined);
  assert.equal((await call('POST', '/account/applications', likeOrder(), token)).body.error.details.field, 'service');
  assert.equal((await call('GET', '/admin/smm', undefined, adminToken)).body.data.services.find((s) => s.id === 63).disabled, true);
  assert.equal((await call('PATCH', '/admin/smm/services/999', { price: 1000 }, adminToken)).status, 404);
});
