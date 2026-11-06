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

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

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
