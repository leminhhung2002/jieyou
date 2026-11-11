import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { unipay, unipayEnabled } from '../services/unipay.js';
import { handleIpn } from '../services/topupPayments.js';

/**
 * Webhook công khai cho cổng thanh toán – /api/payments/*.
 * IPN UniPay: body `{ data }` mã hóa AES-256-CBC bằng khóa bí mật chung → giải mã được mới xử lý.
 * Cần đăng ký URL `${PUBLIC_URL}/api/payments/unipay/ipn` với UniPay.
 */
const router = Router();

const ipnLimiter = rateLimit({
  windowMs: 60_000,
  limit: config.isProd ? 120 : 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.post('/unipay/ipn', ipnLimiter, (req, res) => {
  if (!unipayEnabled()) return res.status(503).json({ code: '99', message: 'unipay disabled' });
  let payload;
  try {
    payload = unipay.parseIpn(req.body);
  } catch {
    // Cùng một câu trả lời cho mọi lỗi giải mã (không gợi ý cho kẻ dò khóa)
    return res.status(400).json({ code: '01', message: 'invalid data' });
  }
  const result = handleIpn(payload);
  // Trả 200 khi đã ghi nhận (kể cả đã xử lý trước đó) để UniPay không gửi lại; đơn lạ → 404
  if (result.ok || result.message === 'amount mismatch') return res.json({ code: '00', message: result.message });
  return res.status(404).json({ code: '02', message: result.message });
});

export default router;
