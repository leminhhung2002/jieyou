import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { adminStore } from '../src/services/adminStore.js';
import { accountStore } from '../src/services/accountStore.js';
import { userStore } from '../src/services/userStore.js';
import { _resetOtps } from '../src/services/otpService.js';

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
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
};

const PHONE = '0912345678'; // khách mẫu An Phát
async function otp(purpose) {
  const r = await call('POST', '/auth/otp/request', { phone: PHONE, purpose });
  return call('POST', '/auth/otp/verify', { phone: PHONE, purpose, code: r.body.data.devCode });
}
const anPhat = () => userStore.findByPhone(PHONE);

test('A02: từ chối JWT alg=none, sai issuer, hoặc token admin dùng cho khách', async () => {
  const id = anPhat().id;
  const none = jwt.sign({ sub: id, typ: 'user', ver: 0 }, null, { algorithm: 'none', issuer: 'jieyou' });
  assert.equal((await call('GET', '/auth/me', undefined, none)).status, 401);
  const noIssuer = jwt.sign({ sub: id, typ: 'user', ver: 0 }, config.jwtSecret);
  assert.equal((await call('GET', '/auth/me', undefined, noIssuer)).status, 401);
  const admin = jwt.sign({ sub: id, typ: 'admin' }, config.jwtSecret, { issuer: 'jieyou' });
  assert.equal((await call('GET', '/auth/me', undefined, admin)).status, 401);
  const user = (await otp('login')).body.data.token;
  assert.equal((await call('GET', '/admin/auth/me', undefined, user)).status, 401);
});

test('A07: đổi mật khẩu đăng xuất phiên cũ, thiết bị hiện tại nhận token mới', async () => {
  const oldToken = (await otp('login')).body.data.token;
  const other = (await otp('login')).body.data.token;
  const r = await call('POST', '/account/password', { newPassword: 'matkhau-moi-1' }, oldToken);
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/auth/me', undefined, other)).status, 401);
  assert.equal((await call('GET', '/auth/me', undefined, r.body.data.token)).status, 200);
  assert.equal(r.body.data.token.includes('tokenVersion'), false);
  assert.equal((await call('GET', '/auth/me', undefined, r.body.data.token)).body.data.tokenVersion, undefined);
});

test('A07: token đặt lại mật khẩu chỉ dùng được một lần và đăng xuất phiên cũ', async () => {
  const session = (await otp('login')).body.data.token;
  const { verificationToken } = (await otp('reset')).body.data;
  assert.equal((await call('POST', '/auth/password/reset', { verificationToken, password: 'matkhau-moi-1' })).status, 200);
  assert.equal((await call('POST', '/auth/password/reset', { verificationToken, password: 'ke-gian-123' })).status, 401);
  assert.equal((await call('GET', '/auth/me', undefined, session)).status, 401);
  assert.equal((await call('POST', '/auth/login', { identifier: PHONE, password: 'matkhau-moi-1' })).status, 200);
});

test('A04: mật khẩu quá dài bị từ chối', async () => {
  const long = 'a'.repeat(129);
  assert.equal((await call('POST', '/auth/login', { identifier: PHONE, password: long })).status, 401);
  const token = (await otp('login')).body.data.token;
  assert.equal((await call('POST', '/account/password', { newPassword: long }, token)).status, 400);
});

test('A08: nháp không nhận khóa __proto__ / constructor', async () => {
  const token = (await otp('login')).body.data.token;
  const raw = '{"details":{"__proto__":{"polluted":true},"constructor":"x","repName":"An"}}';
  const res = await fetch(`${base}/account/drafts/unipay`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: raw,
  });
  assert.equal(res.status, 200);
  const d = (await res.json()).data.details;
  assert.deepEqual(Object.keys(d), ['repName']);
  assert.equal({}.polluted, undefined);
});

test('A05: header bảo mật (CSP, chống nhúng iframe, không cache API)', async () => {
  const r = await call('GET', '/health');
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-powered-by'), null);
});
