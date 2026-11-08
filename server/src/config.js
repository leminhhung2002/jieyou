import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = process.env.NODE_ENV || 'development';

export const config = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT) || 4000,
  // Production sau nginx: đặt HOST=127.0.0.1 để cổng Node không lộ ra ngoài
  host: process.env.HOST || undefined,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // File SQLite lưu dữ liệu (mặc định server/storage/jieyou.db; bản sao lưu ở storage/backups)
  dbFile: path.resolve(serverDir, process.env.DB_FILE || 'storage/jieyou.db'),
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS) || 300,
  // Mật khẩu ban đầu của các tài khoản quản trị mẫu (admin, duyetvien01, ketoan02, bientap01)
  adminDefaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || 'admin12345',
  // Địa chỉ website công khai – dùng cho link và ảnh trong email
  publicUrl: (process.env.PUBLIC_URL || process.env.CLIENT_ORIGIN?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, ''),
  mailFrom: process.env.MAIL_FROM || 'JIEYOU <agency.jieyou@gmail.com>',
  mailReplyTo: process.env.MAIL_REPLY_TO || '',
  // Gửi email (OTP + thông báo) qua Gmail SMTP: SMTP_PASS là "Mật khẩu ứng dụng" 16 ký tự của Google
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
  },
};

if (config.isProd && (!config.smtp.user || !config.smtp.pass)) {
  throw new Error('SMTP_USER and SMTP_PASS must be set in production (mã OTP được gửi qua email)');
}

if (config.isProd && config.adminDefaultPassword === 'admin12345') {
  throw new Error('ADMIN_DEFAULT_PASSWORD must be set in production');
}

if (config.isProd && (config.jwtSecret === 'dev-secret' || config.jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be set in production (at least 32 characters)');
}
