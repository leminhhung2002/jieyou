import { HttpError } from '../utils/httpError.js';
import { config } from '../config.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Không tìm thấy ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'JSON không hợp lệ' } });
  }
  console.error(err);
  res.status(500).json({
    error: { message: 'Lỗi máy chủ', ...(config.isProd ? {} : { stack: err.stack }) },
  });
}

/** Bọc handler async để lỗi được chuyển tới errorHandler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
