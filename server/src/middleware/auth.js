import { config } from '../config.js';
import { unauthorized } from '../utils/httpError.js';
import { signJwt, verifyJwt, credentialVersion } from '../utils/jwt.js';
import { userStore } from '../services/userStore.js';

export function signToken(user) {
  return signJwt({ sub: user.id, typ: 'user', ver: credentialVersion(user) }, config.jwtExpiresIn);
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized());
  let payload;
  try {
    payload = verifyJwt(token);
  } catch {
    return next(unauthorized('Phiên đăng nhập hết hạn'));
  }
  const user = payload.typ === 'user' ? userStore.findById(payload.sub) : null;
  if (!user) return next(unauthorized('Phiên đăng nhập không hợp lệ'));
  if ((payload.ver || 0) !== credentialVersion(user)) return next(unauthorized('Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại'));
  if (user.status === 'locked') return next(unauthorized('Tài khoản đã bị khóa'));
  req.user = user;
  next();
}
