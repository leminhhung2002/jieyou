import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { userStore } from '../src/services/userStore.js';
import { _resetOtps } from '../src/services/otpService.js';
import { normalizePhone, isTaxCode } from '../src/utils/validators.js';
import { pendingRegistrations } from '../src/services/pendingRegistrations.js';

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => {
  userStore._reset();
  _resetOtps();
  pendingRegistrations._reset();
});

const post = async (path, body, headers = {}) => {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const get = async (path, headers = {}) => {
  const res = await fetch(base + path, { headers });
  return { status: res.status, body: await res.json() };
};

test('normalizePhone', () => {
  assert.equal(normalizePhone('0912 345 678'), '0912345678');
  assert.equal(normalizePhone('+84912345678'), '0912345678');
  assert.equal(normalizePhone('84912345678'), '0912345678');
  assert.equal(normalizePhone('0212345678'), null);
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone(undefined), null);
});

test('content endpoints', async () => {
  const s = await get('/services');
  assert.equal(s.status, 200);
  assert.equal(s.body.data.length, 8);
  const one = await get('/services/quang-cao-tren-san');
  assert.equal(one.body.data.name, 'Quảng cáo trên sàn');
  assert.equal((await get('/services/khong-co')).status, 404);
  assert.equal((await get('/pricing')).body.data.length, 5);
  assert.equal((await get('/faqs')).body.data.length, 4);
  assert.equal((await get('/news?limit=2')).body.data.length, 2);
  assert.equal((await get('/khong-ton-tai')).status, 404);
});

const REG = {
  businessName: 'Công ty TNHH An Phát',
  taxCode: '0123456789',
  phone: '0912 345 678',
  email: 'ten@congty.vn',
  password: 'matkhau123',
  agreeTerms: true,
};

test('isTaxCode', () => {
  assert.equal(isTaxCode('0123456789'), true);
  assert.equal(isTaxCode('0123456789-001'), true);
  assert.equal(isTaxCode('12345'), false);
});

test('register: validate -> OTP -> verify -> me -> login (phone & email)', async () => {
  assert.equal((await post('/auth/register', { ...REG, taxCode: '12' })).status, 400);
  assert.equal((await post('/auth/register', { ...REG, agreeTerms: false })).status, 400);
  assert.equal((await post('/auth/register', { ...REG, password: '123' })).status, 400);
  assert.equal((await post('/auth/register', { ...REG, email: 'abc' })).status, 400);

  const start = await post('/auth/register', REG);
  assert.equal(start.status, 202);
  assert.equal(start.body.data.phone, '0912345678');
  const code = start.body.data.devCode;
  assert.match(code, /^\d{6}$/);

  const wrong = code === '000000' ? '111111' : '000000';
  assert.equal((await post('/auth/register/verify', { phone: REG.phone, code: wrong })).status, 400);

  const done = await post('/auth/register/verify', { phone: REG.phone, code });
  assert.equal(done.status, 201);
  assert.equal(done.body.data.user.businessName, 'Công ty TNHH An Phát');
  assert.equal(done.body.data.user.passwordHash, undefined);

  const me = await get('/auth/me', { Authorization: `Bearer ${done.body.data.token}` });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.taxCode, '0123456789');

  assert.equal((await post('/auth/register', REG)).status, 409);
  assert.equal((await post('/auth/login', { identifier: '0912345678', password: 'sai-mat-khau' })).status, 401);
  assert.equal((await post('/auth/login', { identifier: '+84912345678', password: 'matkhau123' })).status, 200);
  assert.equal((await post('/auth/login', { identifier: 'TEN@congty.vn', password: 'matkhau123' })).status, 200);
});

test('login with OTP and reset password', async () => {
  const start = await post('/auth/register', REG);
  await post('/auth/register/verify', { phone: REG.phone, code: start.body.data.devCode });

  const otp = await post('/auth/otp/request', { phone: REG.phone, purpose: 'login' });
  assert.equal(otp.status, 200);
  const login = await post('/auth/otp/verify', { phone: REG.phone, purpose: 'login', code: otp.body.data.devCode });
  assert.equal(login.status, 200);
  assert.ok(login.body.data.token);

  const r = await post('/auth/otp/request', { phone: REG.phone, purpose: 'reset' });
  const v = await post('/auth/otp/verify', { phone: REG.phone, purpose: 'reset', code: r.body.data.devCode });
  const reset = await post('/auth/password/reset', { verificationToken: v.body.data.verificationToken, password: 'matkhaumoi1' });
  assert.equal(reset.status, 200);
  assert.equal((await post('/auth/login', { identifier: REG.phone, password: 'matkhaumoi1' })).status, 200);
});

test('OTP for unknown accounts / missing session', async () => {
  assert.equal((await post('/auth/otp/request', { phone: '0987654321', purpose: 'login' })).status, 404);
  assert.equal((await post('/auth/otp/request', { phone: '0987654321', purpose: 'register' })).status, 400);
  assert.equal((await post('/auth/register/verify', { phone: '0987654321', code: '123456' })).status, 400);
  assert.equal((await get('/auth/me')).status, 401);
  assert.equal((await get('/auth/me', { Authorization: 'Bearer abc' })).status, 401);
});
