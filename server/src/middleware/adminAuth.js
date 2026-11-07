import { HttpError, unauthorized } from '../utils/httpError.js';
import { signJwt, verifyJwt } from '../utils/jwt.js';
import { securityLog } from '../utils/securityLog.js';
import { adminStore } from '../services/adminStore.js';

export function signAdminToken(admin) {
  return signJwt({ sub: admin.id, typ: 'admin' }, '12h');
}

/** Yêu cầu đăng nhập quản trị; `permission` (tuỳ chọn) kiểm tra quyền theo vai trò. */
export const requireAdmin = (permission) => (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized('Chưa đăng nhập quản trị'));
  let payload;
  try {
    payload = verifyJwt(token);
  } catch {
    return next(unauthorized('Phiên quản trị hết hạn'));
  }
  const admin = payload.typ === 'admin' ? adminStore.findAdminById(payload.sub) : null;
  if (!admin) return next(unauthorized('Tài khoản quản trị không hợp lệ'));
  req.admin = admin;
  req.adminPermissions = adminStore.permissionsOf(admin);
  if (permission && !req.adminPermissions.includes(permission)) {
    securityLog('admin.forbidden', req, { admin: admin.username, permission, path: req.originalUrl });
    return next(new HttpError(403, 'Bạn không có quyền thực hiện thao tác này'));
  }
  next();
};
