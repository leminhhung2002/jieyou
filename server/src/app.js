import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import contentRoutes from './routes/content.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import accountRoutes from './routes/account.js';
import devRoutes from './routes/dev.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { saveSafely } from './services/persistence.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // OWASP A05: Content-Security-Policy chặn script lạ (XSS), nhúng trang (clickjacking), form gửi ra ngoài.
  // Hash là của script in hóa đơn `window.onload=()=>window.print()` (routes/account.js, mở dạng blob kế thừa CSP này).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'sha256-XsEvYQeI61UwT9Mz4WdasBY8eAeHqQfnMuYdrCWz23s='"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  });
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  // Request có ghi dữ liệu: lưu xuống SQLite TRƯỚC khi trả kết quả (client nhận "thành công" là dữ liệu đã nằm trên đĩa)
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const json = res.json.bind(res);
    res.json = (body) => {
      saveSafely();
      return json(body);
    };
    res.on('finish', saveSafely);
    next();
  });
  // API trả dữ liệu cá nhân: không cho trình duyệt / proxy lưu cache
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/account', accountRoutes);
  // Hộp thư email dev: /api/dev/mailbox (không có ở production)
  if (!config.isProd) app.use('/api/dev', devRoutes);
  app.use('/api', contentRoutes);
  app.use('/api', notFoundHandler);

  // Production: phục vụ bản build React (client/dist) từ cùng một server.
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
