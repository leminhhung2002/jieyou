import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { adminStore } from '../src/services/adminStore.js';
import { accountStore } from '../src/services/accountStore.js';
import { userStore } from '../src/services/userStore.js';
import { openDatabase, save, backup, closeDatabase } from '../src/services/persistence.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jieyou-db-'));
const file = path.join(dir, 'test.db');
let server;
let base;

before(async () => {
  assert.equal(openDatabase(file), false); // CSDL mới, trống
  await adminStore.seed();
  accountStore.seed();
  save();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => {
  server.close();
  closeDatabase();
  fs.rmSync(dir, { recursive: true, force: true });
});

const post = async (p, body, token) => {
  const res = await fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

/** Giả lập khởi động lại: xoá sạch bộ nhớ rồi nạp lại từ file. */
function restart() {
  closeDatabase();
  userStore._reset();
  adminStore.db.transactions = [];
  adminStore.db.admins = [];
  accountStore._reset();
  assert.equal(openDatabase(file), true);
}

test('dữ liệu còn nguyên sau khi khởi động lại: tài khoản mới, đăng nhập, nạp tiền, nhật ký', async () => {
  const reg = { phone: '0901234567', email: 'moi@example.com', password: 'matkhau123', agreeTerms: true, businessName: 'Cty Mới' };
  const start = await post('/auth/register', reg);
  assert.equal(start.status, 202);
  const done = await post('/auth/register/verify', { phone: reg.phone, code: start.body.data.devCode });
  assert.equal(done.status, 201);
  const token = done.body.data.token;
  assert.equal((await post('/account/topups', { amount: 2_000_000 }, token)).status, 201);

  const before = { users: userStore.list().length, tx: adminStore.db.transactions.length, admins: adminStore.db.admins.length };
  restart();

  const user = userStore.findByPhone('0901234567');
  assert.ok(user, 'tài khoản mới vẫn còn');
  assert.equal(user.businessName, 'Cty Mới');
  assert.equal(user.balance, 2_000_000);
  assert.equal(userStore.list().length, before.users);
  assert.equal(adminStore.db.transactions.length, before.tx);
  assert.equal(adminStore.db.transactions[0].customerId, user.id, 'thứ tự giao dịch giữ nguyên (mới nhất trước)');
  assert.equal(adminStore.db.admins.length, before.admins);
  assert.ok(accountStore.db.invoices.length > 0);

  // Đăng nhập lại bằng mật khẩu sau khởi động lại; token cũ vẫn hợp lệ
  const login = await post('/auth/login', { identifier: '0901234567', password: 'matkhau123' });
  assert.equal(login.status, 200);
  const me = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(me.status, 200);
});

test('sao lưu tạo file CSDL mở được', () => {
  const target = backup(path.join(dir, 'backups'));
  assert.ok(fs.existsSync(target));
  assert.ok(fs.statSync(target).size > 0);
});
