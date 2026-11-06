import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Gửi email. Hiện chưa nối nhà cung cấp (SMTP / SES / SendGrid…): mọi email được lưu vào `outbox`
 * (xem ở dev: GET /api/dev/emails) và ghi log. Khi có nhà cung cấp, thay phần thân `deliver()`.
 */
const outbox = [];
const MAX_OUTBOX = 200;

async function deliver(message) {
  // TODO production: gửi qua nhà cung cấp email thật, ví dụ nodemailer.createTransport(SMTP_URL).sendMail(message)
  if (config.isProd) console.warn(`[EMAIL] Chưa cấu hình nhà cung cấp email – không gửi được tới ${message.to}`);
  else if (process.env.NODE_ENV !== 'test') console.log(`[EMAIL -> ${message.to}] ${message.subject}`);
}

export const mailer = {
  /** { to, subject, html, text, tag } – bỏ qua nếu không có địa chỉ nhận. */
  async send({ to, subject, html, text, tag }) {
    if (!to) return null;
    const message = { id: crypto.randomUUID(), from: config.mailFrom, to, subject, html, text, tag, createdAt: new Date().toISOString() };
    outbox.unshift(message);
    outbox.length = Math.min(outbox.length, MAX_OUTBOX);
    try {
      await deliver(message);
    } catch (err) {
      console.error('[EMAIL] Gửi thất bại', err);
    }
    return message;
  },
  list: () => outbox,
  find: (id) => outbox.find((m) => m.id === id) || null,
  _reset: () => {
    outbox.length = 0;
  },
};
