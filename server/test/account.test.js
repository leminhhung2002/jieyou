import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { adminStore } from '../src/services/adminStore.js';
import { accountStore } from '../src/services/accountStore.js';
import { userStore } from '../src/services/userStore.js';
import { _resetOtps } from '../src/services/otpService.js';
import { config } from '../src/config.js';

// Test luồng duyệt tay: không gọi hotrodvfb thật dù .env có HOTRODVFB_API_KEY (luồng tự động: smm.test.js)
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
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
};

/** Đăng nhập OTP khách mẫu An Phát (môi trường dev trả devCode). */
async function loginAnPhat() {
  const r = await call('POST', '/auth/otp/request', { phone: '0912345678', purpose: 'login' });
  const v = await call('POST', '/auth/otp/verify', { phone: '0912345678', purpose: 'login', code: r.body.data.devCode });
  return v.body.data.token;
}
const ymd = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('account API yêu cầu đăng nhập', async () => {
  assert.equal((await call('GET', '/account/summary')).status, 401);
});

test('summary: số dư, tạm giữ, hồ sơ gần đây', async () => {
  const token = await loginAnPhat();
  const r = await call('GET', '/account/summary', undefined, token);
  assert.equal(r.status, 200);
  const { stats, recentApplications } = r.body.data;
  assert.equal(stats.balance, 12_480_000);
  assert.equal(stats.held, 1_500_000);
  assert.equal(stats.heldCount, 1);
  assert.equal(stats.runningAds, 2);
  assert.ok(recentApplications.some((a) => a.code === 'QC-2411-0042' && a.status === 'pending'));
});

test('lịch sử giao dịch: số dư sau giao dịch nhất quán, ẩn bút toán fee', async () => {
  const token = await loginAnPhat();
  const r = await call('GET', '/account/transactions', undefined, token);
  const rows = r.body.data;
  assert.equal(rows[0].balanceAfter, 12_480_000);
  for (let i = 0; i < rows.length - 1; i++) assert.equal(rows[i].balanceAfter - rows[i].amount, rows[i + 1].balanceAfter);
  assert.ok(rows.some((t) => t.kind === 'held' && t.applicationCode === 'QC-2411-0042'));
  assert.ok(rows.some((t) => t.kind === 'refund'));
});

test('nạp tiền: kiểm tra hạn mức và cộng số dư', async () => {
  const token = await loginAnPhat();
  assert.equal((await call('POST', '/account/topups', { amount: 10_000 }, token)).status, 400);
  assert.equal((await call('POST', '/account/topups', { amount: 60_000_000 }, token)).status, 400);
  const r = await call('POST', '/account/topups', { amount: 5_000_000 }, token);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.balance, 17_480_000);
  const n = await call('GET', '/account/notifications?filter=unread', undefined, token);
  assert.ok(n.body.data.some((x) => x.title === 'Nạp tiền thành công'));
});

test('tạo quảng cáo: tạm giữ tiền, chặn trùng lịch, admin từ chối thì hoàn tiền', async () => {
  const token = await loginAnPhat();
  const details = { slot: 'home-top', from: ymd(10), to: ymd(12), image: { name: 'banner.png', size: 1000 } };
  const r = await call('POST', '/account/applications', { type: 'ads', details }, token);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.application.amount, 1_500_000);
  assert.equal(r.body.data.balance, 10_980_000);

  const clash = await call('POST', '/account/applications', { type: 'ads', details: { ...details, from: ymd(12), to: ymd(13) } }, token);
  assert.equal(clash.status, 409);
  const past = await call('POST', '/account/applications', { type: 'ads', details: { ...details, from: ymd(-1), to: ymd(0) } }, token);
  assert.equal(past.status, 400);

  // Admin từ chối → hoàn tiền + thông báo
  const a = await call('POST', '/admin/auth/login', { username: 'admin', password: 'admin12345' });
  const code = r.body.data.application.code;
  const rej = await call('POST', `/admin/applications/${code}/reject`, { reason: 'Ảnh banner sai kích thước' }, a.body.data.token);
  assert.equal(rej.status, 200);
  const s = await call('GET', '/account/summary', undefined, token);
  assert.equal(s.body.data.stats.balance, 12_480_000);
  const n = await call('GET', '/account/notifications', undefined, token);
  assert.ok(n.body.data[0].title.includes('bị từ chối'));
});

test('admin duyệt hồ sơ có phí → phát hành hóa đơn', async () => {
  const token = await loginAnPhat();
  const r = await call('POST', '/account/applications', {
    type: 'misa',
    details: { device: 'basic', quantity: 1, address: '12 Nguyễn Huệ', einvoice: true, vat: 10, invoiceTaxCode: '0123456789' },
  }, token);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.application.amount, 2_640_000);
  const a = await call('POST', '/admin/auth/login', { username: 'admin', password: 'admin12345' });
  await call('POST', `/admin/applications/${r.body.data.application.code}/approve`, {}, a.body.data.token);
  const inv = await call('GET', '/account/invoices', undefined, token);
  const row = inv.body.data.find((x) => x.applicationCode === r.body.data.application.code);
  assert.equal(row.status, 'issued');
  const doc = await call('GET', `/account/invoices/${row.no}/document`, undefined, token);
  assert.equal(doc.status, 200);
  assert.match(doc.body, /HÓA ĐƠN ĐIỆN TỬ/);
});

test('các dịch vụ khác: kiểm tra dữ liệu, số dư không đủ, POS miễn phí', async () => {
  const token = await loginAnPhat();
  const bad = await call('POST', '/account/applications', { type: 'unipay', details: { repName: 'A' } }, token);
  assert.equal(bad.status, 400);
  const pos = await call('POST', '/account/applications', {
    type: 'pos',
    details: { storeName: 'An Phát Mart', businessType: 'Bán lẻ', address: '12 Nguyễn Huệ', phone: '0912345678', email: 'ten@congty.vn', attachments: [{ name: 'gpkd.pdf', size: 10 }] },
  }, token);
  assert.equal(pos.status, 201);
  assert.equal(pos.body.data.balance, 12_480_000);
  const social = await call('POST', '/account/applications', {
    type: 'social',
    details: { platform: 'facebook', kind: 'like', quantity: 1_000_000, url: 'https://facebook.com/anphatmart', acceptedWarning: true },
  }, token);
  assert.equal(social.status, 402);
});

test('nháp, hồ sơ, cài đặt và đổi mật khẩu', async () => {
  const token = await loginAnPhat();
  await call('PUT', '/account/drafts/unipay', { details: { repName: 'Nguyễn Văn An' } }, token);
  const d = await call('GET', '/account/drafts/unipay', undefined, token);
  assert.equal(d.body.data.details.repName, 'Nguyễn Văn An');

  const p = await call('PATCH', '/account/profile', { businessName: 'Công ty TNHH An Phát 2', email: 'moi@congty.vn' }, token);
  assert.equal(p.body.data.businessName, 'Công ty TNHH An Phát 2');

  // Chưa có mật khẩu → không được tắt OTP
  assert.equal((await call('PATCH', '/account/settings', { otpLogin: false }, token)).status, 400);
  assert.equal((await call('POST', '/account/password', { newPassword: 'short' }, token)).status, 400);
  const changed = await call('POST', '/account/password', { newPassword: 'matkhau123' }, token);
  assert.equal(changed.status, 200);
  // Đổi mật khẩu → token cũ hết hiệu lực, dùng token mới server trả về
  assert.equal((await call('GET', '/account/summary', undefined, token)).status, 401);
  const token2 = changed.body.data.token;
  assert.equal((await call('POST', '/account/password', { currentPassword: 'sai', newPassword: 'matkhau456' }, token2)).status, 400);
  const s = await call('PATCH', '/account/settings', { otpLogin: false, email: { invoices: true } }, token2);
  assert.equal(s.status, 200);
  assert.equal(s.body.data.settings.email.invoices, true);

  // OTP đăng nhập bị chặn, mật khẩu vẫn dùng được
  const r = await call('POST', '/auth/otp/request', { phone: '0912345678', purpose: 'login' });
  const v = await call('POST', '/auth/otp/verify', { phone: '0912345678', purpose: 'login', code: r.body.data.devCode });
  assert.equal(v.status, 403);
  assert.equal((await call('POST', '/auth/login', { identifier: '0912345678', password: 'matkhau123' })).status, 200);
});

test('thông báo: đánh dấu tất cả đã đọc', async () => {
  const token = await loginAnPhat();
  const before = await call('GET', '/account/notifications', undefined, token);
  assert.ok(before.body.meta.unread > 0);
  await call('POST', '/account/notifications/read-all', {}, token);
  const after = await call('GET', '/account/notifications', undefined, token);
  assert.equal(after.body.meta.unread, 0);
});

test('chi tiết hồ sơ bị từ chối: lý do, mốc thời gian, hoàn tiền', async () => {
  const token = await loginAnPhat();
  const r = await call('GET', '/account/applications/MB-2410-0031', undefined, token);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, 'rejected');
  assert.ok(r.body.data.rejectReason);
  assert.deepEqual(r.body.data.timeline.map((t) => t.label), ['Đã gửi', 'Duyệt', 'Từ chối']);
  assert.equal(r.body.data.payment.refund.done, true);
  assert.equal((await call('GET', '/account/applications/KHONG-CO', undefined, token)).status, 404);
});

test('email: nạp tiền, duyệt hồ sơ, theo công tắc trong Cài đặt', async () => {
  const { mailer } = await import('../src/services/mailer.js');
  mailer._reset();
  const token = await loginAnPhat();
  mailer._reset(); // bỏ qua email chứa mã OTP lúc đăng nhập
  await call('POST', '/account/topups', { amount: 1_000_000 }, token);
  let mails = mailer.list();
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'anphat@example.com');
  assert.match(mails[0].subject, /Nạp tiền thành công/);
  assert.match(mails[0].html, /Kính gửi quý khách Công ty TNHH An Phát/);
  assert.match(mails[0].html, /assets\/email\/logo@2x\.png/);

  // Tắt email nạp tiền → không gửi
  await call('PATCH', '/account/settings', { email: { topup: false } }, token);
  await call('POST', '/account/topups', { amount: 1_000_000 }, token);
  assert.equal(mailer.list().length, 1);

  // Duyệt hồ sơ: email trạng thái; hóa đơn tắt mặc định → chỉ 1 email
  const a = await call('POST', '/admin/auth/login', { username: 'admin', password: 'admin12345' });
  await call('POST', '/admin/applications/QC-2411-0042/approve', {}, a.body.data.token);
  mails = mailer.list();
  assert.equal(mails.length, 2);
  assert.match(mails[0].subject, /QC-2411-0042 đã được phê duyệt/);
  assert.match(mails[0].html, /Xem hồ sơ trên sàn/);

  // Bật email hóa đơn rồi từ chối/duyệt hồ sơ khác
  await call('PATCH', '/account/settings', { email: { invoices: true } }, token);
  await call('POST', '/admin/applications/BCT-2411-0052/approve', {}, a.body.data.token);
  assert.ok(mailer.list().some((m) => m.tag === 'invoice.issued'));

  // Nội dung động được escape
  const { renderEmail } = await import('../src/services/emailTemplates.js');
  const e = renderEmail({ subject: 's', greetingName: '<script>x</script>', heading: ['a'] });
  assert.ok(!e.html.includes('<script>x'));
});

test('dev mailbox', async () => {
  const r = await fetch(base + '/dev/emails/preview');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Thông số cấu hình máy POS/);
});

test('seedTime: mốc dữ liệu mẫu không ở tương lai, "quá 24 giờ" luôn đúng (kể cả lúc 00:08)', async () => {
  const { atToday, daysAgo } = await import('../src/utils/seedTime.js');
  const now = new Date(2026, 10, 7, 0, 8);
  const a = new Date(atToday(10, 5, now));
  const b = new Date(atToday(9, 40, now));
  assert.ok(a <= now && b < a && a.toDateString() === now.toDateString());
  const old = new Date(daysAgo(1, 8, 15, now));
  assert.ok(now - old > 24 * 3600_000);
  assert.equal(atToday(10, 5, new Date(2026, 10, 7, 15, 0)), new Date(2026, 10, 7, 10, 5).toISOString());
});
