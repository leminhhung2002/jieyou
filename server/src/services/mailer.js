import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from '../config.js';

/**
 * Gửi email qua SMTP (mặc định Gmail: smtp.gmail.com:465, đăng nhập bằng Mật khẩu ứng dụng).
 * Chưa cấu hình SMTP_USER/SMTP_PASS (dev/test) thì chỉ lưu vào `outbox` (xem ở dev: GET /api/dev/emails) và ghi log.
 */
const outbox = [];
const MAX_OUTBOX = 200;

let transport = null;
function getTransport() {
  if (!config.smtp.user || !config.smtp.pass || process.env.NODE_ENV === 'test') return null;
  transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    // Giữ kết nối dùng lại: tránh đăng nhập Gmail liên tục (Google dễ đánh dấu bất thường)
    pool: true,
    maxConnections: 3,
  });
  return transport;
}

/**
 * Gmail luôn ghi đè địa chỉ "From" bằng tài khoản đăng nhập; đặt From khác sẽ lệch chữ ký DKIM/SPF
 * và dễ vào thư rác. Vì vậy giữ tên hiển thị trong MAIL_FROM nhưng địa chỉ luôn là SMTP_USER.
 */
function fromAddress() {
  const name = (config.mailFrom.match(/^\s*"?([^"<]*?)"?\s*</)?.[1] || 'JIEYOU').trim();
  return { name, address: config.smtp.user };
}

// Tên miền dành riêng cho thử nghiệm (RFC 2606) của tài khoản mẫu: không gửi thật,
// tránh thư bị dội lại làm giảm uy tín người gửi với Gmail
const RESERVED_DOMAIN = /@(?:[^@]+\.)?(?:example\.(?:com|net|org)|[^@]+\.(?:test|invalid|example|localhost))$/i;

async function deliver(message) {
  if (RESERVED_DOMAIN.test(message.to)) {
    if (process.env.NODE_ENV !== 'test') console.log(`[EMAIL] Bỏ qua địa chỉ mẫu ${message.to}: ${message.subject}`);
    return;
  }
  const t = getTransport();
  if (!t) {
    if (config.isProd) throw new Error('Chưa cấu hình SMTP_USER/SMTP_PASS – không gửi được email');
    if (process.env.NODE_ENV !== 'test') console.log(`[EMAIL -> ${message.to}] ${message.subject}`);
    return;
  }
  await t.sendMail({
    from: fromAddress(),
    to: message.to,
    replyTo: config.mailReplyTo || undefined,
    subject: message.subject,
    text: message.text,
    html: message.html,
    // Mã tham chiếu riêng mỗi thư: Gmail không gộp các thư OTP vào một chuỗi hội thoại
    headers: { 'X-Entity-Ref-ID': message.id },
  });
}

export const mailer = {
  /**
   * { to, subject, html, text, tag } – bỏ qua nếu không có địa chỉ nhận.
   * `critical: true` (vd. OTP): ném lỗi khi gửi thất bại thay vì chỉ ghi log.
   */
  async send({ to, subject, html, text, tag, critical = false }) {
    if (!to) return null;
    const message = { id: crypto.randomUUID(), from: config.mailFrom, to, subject, html, text, tag, createdAt: new Date().toISOString() };
    // Hộp thư tạm chỉ phục vụ dev/test – production không giữ nội dung thư (có mã OTP) trong bộ nhớ
    if (!config.isProd) {
      outbox.unshift(message);
      outbox.length = Math.min(outbox.length, MAX_OUTBOX);
    }
    try {
      await deliver(message);
    } catch (err) {
      console.error(`[EMAIL] Gửi thất bại (${tag || 'email'} -> ${to}):`, err.message);
      if (critical) throw err;
    }
    return message;
  },
  list: () => outbox,
  find: (id) => outbox.find((m) => m.id === id) || null,
  _reset: () => {
    outbox.length = 0;
  },
};
