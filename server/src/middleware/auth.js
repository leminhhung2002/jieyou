import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from '../utils/httpError.js';
import { userStore } from '../services/userStore.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = userStore.findById(payload.sub);
    if (!user) return next(unauthorized('Tài khoản không tồn tại'));
    if (user.status === 'locked') return next(unauthorized('Tài khoản đã bị khóa'));
    req.user = user;
    next();
  } catch {
    next(unauthorized('Phiên đăng nhập hết hạn'));
  }
}
