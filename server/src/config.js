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
  // Tăng tương tác MXH qua API hotrodvfb.com. Không có key → đơn MXH quay về duyệt tay như cũ.
  smm: {
    apiKey: process.env.HOTRODVFB_API_KEY || '',
    apiUrl: process.env.HOTRODVFB_API_URL || 'https://hotrodvfb.com/api/v2',
    // Lãi cộng thêm trên giá NCC (%)
    markupPercent: Math.max(0, Number(process.env.SMM_MARKUP_PERCENT ?? 30) || 0),
    // Tỉ giá dự phòng khi API `balance` không trả tỉ giá
    usdVnd: Number(process.env.SMM_USD_VND) || 26_000,
    // Chu kỳ đồng bộ trạng thái đơn (giây)
    syncSeconds: Math.max(30, Number(process.env.SMM_SYNC_SECONDS) || 120),
  },
  // Nạp tiền qua UniPay Open API (https://docs.unipay.net.vn/technical/openapi). Thiếu thông tin → tắt.
  unipay: {
    baseUrl: (process.env.UNIPAY_BASE_URL || 'https://unipay-open-api-staging.atomsolution.vn').replace(/\/$/, ''),
    partnerCode: process.env.UNIPAY_PARTNER_CODE || '',
    username: process.env.UNIPAY_USERNAME || '',
    password: process.env.UNIPAY_PASSWORD || '',
    clientId: process.env.UNIPAY_CLIENT_ID || '',
    clientSecret: process.env.UNIPAY_CLIENT_SECRET || '',
    // Khóa AES-256 dạng hex (64 ký tự)
    aesKey: (process.env.UNIPAY_AES_KEY || '').replace(/\s+/g, ''),
    // Tài khoản nhận tiền (VA) + mã ngân hàng dùng khi tạo QR
    bankAccountNo: process.env.UNIPAY_BANK_ACCOUNT_NO || '',
    bincode: process.env.UNIPAY_BINCODE || '970454',
    qrServiceCode: process.env.UNIPAY_QR_SERVICE_CODE || 'vccb-qr',
    ecomServiceCode: process.env.UNIPAY_ECOM_SERVICE_CODE || 'ecom',
    // Chu kỳ đối soát giao dịch đang chờ qua API tra cứu (giây) – dự phòng khi IPN không tới
    syncSeconds: Math.max(15, Number(process.env.UNIPAY_SYNC_SECONDS) || 60),
  },
};

if (config.unipay.aesKey && !/^[0-9a-fA-F]{64}$/.test(config.unipay.aesKey)) {
  throw new Error('UNIPAY_AES_KEY phải là chuỗi hex 64 ký tự (AES-256)');
}

if (config.isProd && (!config.smtp.user || !config.smtp.pass)) {
  throw new Error('SMTP_USER and SMTP_PASS must be set in production (mã OTP được gửi qua email)');
}

if (config.isProd && config.adminDefaultPassword === 'admin12345') {
  throw new Error('ADMIN_DEFAULT_PASSWORD must be set in production');
}

if (config.isProd && (config.jwtSecret === 'dev-secret' || config.jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be set in production (at least 32 characters)');
}
