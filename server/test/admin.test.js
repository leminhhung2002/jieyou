import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { adminStore } from '../src/services/adminStore.js';
import { userStore } from '../src/services/userStore.js';
import { config } from '../src/config.js';

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
  await adminStore.seed();
});

const call = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const login = async (username) =>
  (await call('POST', '/admin/auth/login', { username, password: config.adminDefaultPassword })).body.data.token;

test('admin login + permission checks', async () => {
  assert.equal((await call('POST', '/admin/auth/login', { username: 'admin', password: 'sai' })).status, 401);
  assert.equal((await call('GET', '/admin/overview')).status, 401);
  const editor = await login('bientap01');
  assert.equal((await call('GET', '/admin/overview', null, editor)).status, 200);
  assert.equal((await call('GET', '/admin/applications', null, editor)).status, 403);
  assert.equal((await call('GET', '/admin/price-items', null, editor)).status, 200);
  const me = await call('GET', '/admin/auth/me', null, editor);
  assert.equal(me.body.data.role, 'Biên tập nội dung');
  // Token khách hàng không dùng được cho admin
  assert.equal((await call('GET', '/admin/overview', null, 'abc')).status, 401);
});

test('overview numbers match the design seed', async () => {
  const token = await login('admin');
  const { body } = await call('GET', '/admin/overview', null, token);
  assert.equal(body.data.stats.pending, 12);
  assert.equal(body.data.stats.overdue, 3);
  assert.equal(body.data.queue.length, 4);
  assert.equal(body.data.attention.length, 2);
});

test('approve / reject applications with refund and audit log', async () => {
  const token = await login('duyetvien01');
  const list = await call('GET', '/admin/applications?type=ads', null, token);
  assert.ok(list.body.data.every((a) => a.type === 'ads'));

  const before = userStore.list().find((u) => u.businessName === 'Công ty TNHH An Phát').balance;
  assert.equal((await call('POST', '/admin/applications/QC-2411-0042/reject', { reason: 'ngắn' }, token)).status, 400);
  const rej = await call('POST', '/admin/applications/QC-2411-0042/reject', { reason: 'Banner không đúng kích thước quy định.' }, token);
  assert.equal(rej.status, 200);
  assert.equal(rej.body.data.status, 'rejected');
  const after = userStore.list().find((u) => u.businessName === 'Công ty TNHH An Phát').balance;
  assert.equal(after - before, 1_500_000); // hoàn tiền tạm giữ
  assert.equal((await call('POST', '/admin/applications/QC-2411-0042/approve', {}, token)).status, 409);

  const ok = await call('POST', '/admin/applications/BCT-2411-0051/approve', {}, token);
  assert.equal(ok.body.data.status, 'approved');

  const admin = await login('admin');
  const logs = await call('GET', '/admin/logs?q=duyetvien01', null, admin);
  assert.ok(logs.body.data.some((l) => l.action === 'Từ chối hồ sơ' && l.target === 'QC-2411-0042'));
  assert.ok(logs.body.data.some((l) => l.action === 'Duyệt hồ sơ' && l.target === 'BCT-2411-0051'));
});

test('customers search + lock blocks customer login', async () => {
  const token = await login('admin');
  const s = await call('GET', '/admin/customers?q=0312345670', null, token);
  assert.equal(s.body.data.length, 1);
  assert.equal(s.body.data[0].businessName, 'Cửa hàng Minh Khoa');
  const id = s.body.data[0].id;
  assert.equal((await call('PATCH', `/admin/customers/${id}/status`, { status: 'locked' }, token)).body.data.status, 'locked');
  const otp = await call('POST', '/auth/otp/request', { phone: '0903112233', purpose: 'login' });
  const v = await call('POST', '/auth/otp/verify', { phone: '0903112233', purpose: 'login', code: otp.body.data.devCode });
  assert.equal(v.status, 403);
});

test('price items: CRUD, publish drives public pricing', async () => {
  const token = await login('bientap01');
  assert.equal((await call('POST', '/admin/price-items', { serviceSlug: 'x', name: 'a', unitPrice: 1 }, token)).status, 400);
  const created = await call(
    'POST',
    '/admin/price-items',
    { serviceSlug: 'quang-cao-tren-san', name: 'Ghim chuyên mục / ngày', unitPrice: 300_000, vat: 10, status: 'published' },
    token,
  );
  assert.equal(created.status, 201);
  const pub = await call('GET', '/pricing');
  assert.equal(pub.body.data.find((p) => p.id === 'ads').fromPrice, 300_000);

  await call('PATCH', `/admin/price-items/${created.body.data.id}`, { status: 'draft' }, token);
  assert.equal((await call('GET', '/pricing')).body.data.find((p) => p.id === 'ads').fromPrice, 500_000);
  assert.equal((await call('DELETE', `/admin/price-items/${created.body.data.id}`, null, token)).status, 200);
});

test('roles: super admin locked, add role', async () => {
  const token = await login('admin');
  const roles = await call('GET', '/admin/roles', null, token);
  const sa = roles.body.data.find((r) => r.name === 'Super Admin');
  assert.equal((await call('PATCH', `/admin/roles/${sa.id}`, { permissions: [] }, token)).status, 403);
  const created = await call('POST', '/admin/roles', { name: 'Kiểm soát', permissions: ['transactions'] }, token);
  assert.equal(created.status, 201);
  assert.equal((await call('POST', '/admin/roles', { name: 'kiểm soát', permissions: [] }, token)).status, 409);
  const reviewer = roles.body.data.find((r) => r.name === 'Duyệt viên');
  const upd = await call('PATCH', `/admin/roles/${reviewer.id}`, { permissions: ['applications'] }, token);
  assert.deepEqual(upd.body.data.permissions, ['applications']);

  // Xóa vai trò: chặn Super Admin & vai trò đang dùng, cho phép vai trò trống
  assert.equal((await call('DELETE', `/admin/roles/${sa.id}`, null, token)).status, 403);
  assert.equal((await call('DELETE', `/admin/roles/${reviewer.id}`, null, token)).status, 409);
  assert.equal((await call('DELETE', `/admin/roles/${created.body.data.id}`, null, token)).status, 200);
});

test('fee settings: MISA device prices, VAT, POS fee and MISA page prices are editable', async () => {
  const editor = await login('bientap01');
  const view = await call('GET', '/admin/fees', null, editor);
  assert.equal(view.status, 200);
  assert.deepEqual(view.body.data.misaDevices.map((d) => [d.key, d.price]), [['q190-static', 880_000], ['q190-dynamic', 1_090_000], ['sunmi-v3', 7_500_000], ['a90-pro', 10_000_000], ['c20-lite', 14_800_000], ['sunmi-desktop', 21_000_000], ['cpad', 18_300_000]]);
  assert.deepEqual(view.body.data.vatRates, [0, 5, 8, 10]);
  assert.equal(view.body.data.posFee, 0);

  assert.equal((await call('PATCH', '/admin/fees', { posFee: -1 }, editor)).status, 400);
  assert.equal((await call('PATCH', '/admin/fees', { vatRates: [] }, editor)).status, 400);
  assert.equal((await call('PATCH', '/admin/fees', { misaDevices: { nope: 1 } }, editor)).status, 400);
  assert.equal((await call('PATCH', '/admin/fees', {}, editor)).status, 400);

  const saved = await call('PATCH', '/admin/fees', {
    misaDevices: { 'q190-static': 800_000 },
    vatRates: [10, 8, 8],
    posFee: 150_000,
    machines: { 'may-b': 900_000 },
    invoicePlans: [{ id: 'S', invoices: 300, price: 300_000 }, { id: 'M', invoices: 1000, price: 700_000 }],
  }, editor);
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.data.vatRates, [8, 10]);

  // Web người dùng dùng ngay giá mới
  const otp = await call('POST', '/auth/otp/request', { phone: '0912345678', purpose: 'login' });
  const user = (await call('POST', '/auth/otp/verify', { phone: '0912345678', purpose: 'login', code: otp.body.data.devCode })).body.data.token;
  const cat = (await call('GET', '/account/catalog', null, user)).body.data;
  assert.equal(cat.misaDevices.find((d) => d.key === 'q190-static').price, 800_000);
  assert.equal(cat.misaDevices.find((d) => d.key === 'q190-dynamic').price, 1_090_000);
  assert.deepEqual(cat.vatRates, [8, 10]);
  assert.equal(cat.fees.pos, 150_000);

  // Trang dịch vụ MISA + bảng giá "Từ ..."
  const page = (await call('GET', '/services/may-ban-hang-misa')).body.data;
  assert.equal(page.content.machines.find((m) => m.id === 'may-b').price, 900_000);
  assert.deepEqual(page.content.invoicePlans.plans.map((p) => p.price), [300_000, 700_000]);
  assert.equal(page.pricing.find((p) => p.id === 'pos-machine').fromPrice, 800_000);
  assert.equal(page.pricing.find((p) => p.id === 'misa').fromPrice, 300_000);

  // Khôi phục mặc định
  const reset = await call('PATCH', '/admin/fees', { misaDevices: { 'q190-static': null }, vatRates: null, posFee: null, machines: { 'may-b': null }, invoicePlans: null }, editor);
  assert.equal(reset.body.data.misaDevices[0].price, 880_000);
  assert.equal(reset.body.data.posFee, 0);
  assert.equal(reset.body.data.invoicePlans.length, 3);

  const logs = await call('GET', '/admin/logs', null, await login('admin'));
  assert.ok(logs.body.data.some((l) => l.action === 'Cập nhật phí MISA & POS'));
});
