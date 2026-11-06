import 'dotenv/config';

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
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS) || 300,
  // Mật khẩu ban đầu của các tài khoản quản trị mẫu (admin, duyetvien01, ketoan02, bientap01)
  adminDefaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || 'admin12345',
  // Địa chỉ website công khai – dùng cho link và ảnh trong email
  publicUrl: (process.env.PUBLIC_URL || process.env.CLIENT_ORIGIN?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, ''),
  mailFrom: process.env.MAIL_FROM || 'JIEYOU <no-reply@jieyou.vn>',
};

if (config.isProd && config.adminDefaultPassword === 'admin12345') {
  throw new Error('ADMIN_DEFAULT_PASSWORD must be set in production');
}

if (config.isProd && config.jwtSecret === 'dev-secret') {
  throw new Error('JWT_SECRET must be set in production');
}
