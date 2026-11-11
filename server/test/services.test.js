import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { adminStore } from '../src/services/adminStore.js';
import { accountStore } from '../src/services/accountStore.js';
import { userStore } from '../src/services/userStore.js';
import { _resetOtps } from '../src/services/otpService.js';
import { config } from '../src/config.js';

// Làm app/web theo yêu cầu + Key phần mềm bản quyền
config.smm.apiKey = '';
// Luồng nạp tiền thật qua UniPay: unipay.test.js (ở đây dùng chế độ dev cộng tiền ngay)
config.unipay.partnerCode = '';

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(async () => {
  userStore._reset();
  _resetOtps();
  await adminStore.seed();
  accountStore.seed();
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
const loginAdmin = async (username = 'admin') =>
  (await call('POST', '/admin/auth/login', { username, password: config.adminDefaultPassword })).body.data.token;

const WEBAPP = {
  kind: 'Website bán hàng',
  projectName: 'Shop An Phát',
  description: 'Website bán đồ gia dụng, có giỏ hàng và thanh toán online.',
  budget: '10 – 30 triệu',
  deadline: 'Trong 1 tháng',
  contactName: 'Nguyễn An',
  phone: '0912345678',
  email: 'anphat@example.com',
};

test('trang dịch vụ công khai có 2 dịch vụ mới', async () => {
  const list = (await call('GET', '/services')).body.data;
  assert.ok(list.some((s) => s.slug === 'lam-app-web-theo-yeu-cau'));
  assert.ok(list.some((s) => s.slug === 'key-ban-quyen'));
  assert.ok(!list.some((s) => s.comingSoon));
  const page = (await call('GET', '/services/key-ban-quyen')).body.data;
  assert.deepEqual(page.licenseProducts, []);
});

test('yêu cầu làm app/web: miễn phí, chờ duyệt, admin duyệt kèm báo giá', async () => {
  const token = await loginAnPhat();
  const before = (await call('GET', '/account/summary', undefined, token)).body.data.stats.balance;

  const bad = await call('POST', '/account/applications', { type: 'webapp', details: { ...WEBAPP, description: 'ngắn' } }, token);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.details.field, 'description');

  const r = await call('POST', '/account/applications', { type: 'webapp', details: WEBAPP }, token);
  assert.equal(r.status, 201);
  const app = r.body.data.application;
  assert.match(app.code, /^WEB-\d{4}-0001$/);
  assert.equal(app.status, 'pending');
  assert.equal(app.amount, 0);
  assert.equal(r.body.data.balance, before);

  const admin = await loginAdmin();
  const q = await call('GET', '/admin/applications?type=webapp', undefined, admin);
  assert.ok(q.body.data.some((a) => a.code === app.code && a.details['Tên dự án'] === 'Shop An Phát'));

  const ok = await call('POST', `/admin/applications/${app.code}/approve`, { note: 'Báo giá 18.000.000 đ, làm trong 3 tuần.' }, admin);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.reviewNote, 'Báo giá 18.000.000 đ, làm trong 3 tuần.');

  const detail = (await call('GET', `/account/applications/${app.code}`, undefined, token)).body.data;
  assert.equal(detail.status, 'approved');
  assert.equal(detail.reviewNote, 'Báo giá 18.000.000 đ, làm trong 3 tuần.');
  const notes = (await call('GET', '/account/notifications', undefined, token)).body.data;
  assert.ok(notes.some((n) => n.title.includes(app.code) && n.body.includes('18.000.000')));
});

test('key bản quyền: admin tạo sản phẩm, nhập key; khách mua nhận key ngay, trừ tiền, có hóa đơn', async () => {
  const admin = await loginAdmin();
  const created = await call('POST', '/admin/licenses', { name: 'Windows 11 Pro', category: 'Windows', price: 150_000 }, admin);
  assert.equal(created.status, 201);
  const id = created.body.data.id;

  // Người không có quyền Nội dung không quản lý được kho key
  assert.equal((await call('GET', '/admin/licenses', undefined, await loginAdmin('duyetvien01'))).status, 403);

  const imp = await call('POST', `/admin/licenses/${id}/keys`, { keys: 'AAAA-1111\nBBBB-2222\n\nAAAA-1111\nCCCC-3333\n' }, admin);
  assert.equal(imp.status, 201);
  assert.equal(imp.body.data.added, 3);
  assert.equal(imp.body.data.duplicates, 1);
  assert.equal(imp.body.data.product.available, 3);

  const token = await loginAnPhat();
  const products = (await call('GET', '/account/licenses', undefined, token)).body.data;
  assert.deepEqual(products.map((p) => [p.name, p.price, p.stock]), [['Windows 11 Pro', 150_000, 3]]);

  // Mua quá số còn lại → 409, không trừ tiền
  const tooMany = await call('POST', '/account/applications', { type: 'license', details: { product: id, quantity: 4 } }, token);
  assert.equal(tooMany.status, 409);
  assert.equal(tooMany.body.error.details.field, 'quantity');

  const balance = (await call('GET', '/account/summary', undefined, token)).body.data.stats.balance;
  const r = await call('POST', '/account/applications', { type: 'license', details: { product: id, quantity: 2 } }, token);
  assert.equal(r.status, 201);
  const app = r.body.data.application;
  assert.match(app.code, /^KEY-\d{4}-0001$/);
  assert.equal(app.status, 'approved');
  assert.deepEqual(app.keys, ['AAAA-1111', 'BBBB-2222']);
  assert.equal(r.body.data.balance, balance - 300_000);

  const orders = (await call('GET', '/account/licenses/orders', undefined, token)).body.data;
  assert.deepEqual(orders[0].keys, ['AAAA-1111', 'BBBB-2222']);
  const invoices = (await call('GET', '/account/invoices', undefined, token)).body.data;
  assert.ok(invoices.some((i) => i.applicationCode === app.code && i.status === 'issued' && i.total === 300_000));
  const txs = (await call('GET', '/account/transactions', undefined, token)).body.data;
  assert.ok(txs.some((t) => t.applicationCode === app.code && t.kind === 'charged' && t.amount === -300_000));

  // Kho còn 1 key; key đã bán không xóa được, sản phẩm đã bán không xóa được (chỉ ẩn)
  const keys = await call('GET', `/admin/licenses/${id}/keys`, undefined, admin);
  assert.equal(keys.body.meta.product.available, 1);
  assert.equal(keys.body.meta.product.sold, 2);
  const sold = keys.body.data.find((k) => k.status === 'sold');
  assert.equal(sold.applicationCode, app.code);
  assert.equal((await call('DELETE', `/admin/licenses/${id}/keys/${sold.id}`, undefined, admin)).status, 409);
  assert.equal((await call('DELETE', `/admin/licenses/${id}`, undefined, admin)).status, 409);

  // Ẩn sản phẩm → khách không thấy, không mua được
  assert.equal((await call('PATCH', `/admin/licenses/${id}`, { status: 'hidden' }, admin)).status, 200);
  assert.equal((await call('GET', '/account/licenses', undefined, token)).body.data.length, 0);
  const hidden = await call('POST', '/account/applications', { type: 'license', details: { product: id, quantity: 1 } }, token);
  assert.equal(hidden.status, 400);

  // Đơn key không nằm trong hàng chờ duyệt của admin
  const pending = (await call('GET', '/admin/applications?type=license', undefined, admin)).body.data;
  assert.equal(pending.length, 0);
});

test('key bản quyền: không đủ số dư thì không giao key', async () => {
  const admin = await loginAdmin();
  const id = (await call('POST', '/admin/licenses', { name: 'Office 2021', price: 900_000_000 }, admin)).body.data.id;
  await call('POST', `/admin/licenses/${id}/keys`, { keys: 'KEY-1' }, admin);
  const token = await loginAnPhat();
  const r = await call('POST', '/account/applications', { type: 'license', details: { product: id, quantity: 1 } }, token);
  assert.equal(r.status, 402);
  const keys = (await call('GET', `/admin/licenses/${id}/keys`, undefined, admin)).body.data;
  assert.equal(keys[0].status, 'available');
});
