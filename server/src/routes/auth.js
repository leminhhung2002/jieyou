import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { signJwt, verifyJwt, credentialVersion } from '../utils/jwt.js';
import { securityLog } from '../utils/securityLog.js';
import { requestOtp, verifyOtp, OTP_PURPOSES } from '../services/otpService.js';
import { userStore } from '../services/userStore.js';
import { pendingRegistrations } from '../services/pendingRegistrations.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import { normalizePhone, isEmail, isTaxCode } from '../utils/validators.js';
import { badRequest, conflict, notFound, unauthorized, HttpError } from '../utils/httpError.js';

const router = Router();

const limiter = (limit, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.isProd ? limit : limit * 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { message } },
  });

const otpLimiter = limiter(10, 'Quá nhiều yêu cầu OTP, vui lòng thử lại sau');
const loginLimiter = limiter(20, 'Quá nhiều lần thử, vui lòng thử lại sau');
const resetLimiter = limiter(10, 'Quá nhiều lần thử, vui lòng thử lại sau');

const VERIFY_TOKEN_TTL = '15m';
const MIN_PASSWORD = 8;
// Giới hạn trên để tránh tốn CPU khi băm chuỗi cực dài (DoS)
const MAX_PASSWORD = 128;

function requirePhone(raw) {
  const phone = normalizePhone(raw);
  if (!phone) throw badRequest('Số điện thoại không hợp lệ', { field: 'phone' });
  return phone;
}

function requirePassword(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) {
    throw badRequest(`Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự`, { field: 'password' });
  }
  if (pw.length > MAX_PASSWORD) throw badRequest(`Mật khẩu tối đa ${MAX_PASSWORD} ký tự`, { field: 'password' });
  return pw;
}

function requireCode(raw) {
  const code = String(raw || '').trim();
  if (!/^\d{6}$/.test(code)) throw badRequest('Mã OTP gồm 6 chữ số', { field: 'code' });
  return code;
}

function session(user) {
  if (user.status === 'locked') throw new HttpError(403, 'Tài khoản đã bị khóa, vui lòng liên hệ hỗ trợ');
  return { token: signToken(user), user: userStore.toPublic(user) };
}

/** Tìm user theo "Số điện thoại hoặc email". */
function findByIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (raw.includes('@')) return userStore.findByEmail(raw.toLowerCase());
  const phone = normalizePhone(raw);
  return phone ? userStore.findByPhone(phone) : null;
}

/* ------------------------------------------------------------------ */
/* ĐĂNG KÝ: B1 gửi thông tin doanh nghiệp -> OTP qua email, B2 xác thực OTP      */
/* ------------------------------------------------------------------ */

router.post(
  '/register',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { businessName, taxCode, email, password, agreeTerms } = req.body || {};
    const phone = requirePhone(req.body?.phone);

    // Tên doanh nghiệp và mã số thuế không bắt buộc – chỉ kiểm tra khi có nhập
    const name = typeof businessName === 'string' ? businessName.trim() : '';
    const tax = typeof taxCode === 'string' || typeof taxCode === 'number' ? String(taxCode).trim() : '';
    if (name.length > 200) throw badRequest('Tên doanh nghiệp quá dài', { field: 'businessName' });
    if (tax && !isTaxCode(tax)) throw badRequest('Mã số thuế gồm 10 hoặc 13 chữ số', { field: 'taxCode' });
    if (!isEmail(email)) throw badRequest('Email không hợp lệ', { field: 'email' });
    requirePassword(password);
    if (agreeTerms !== true) throw badRequest('Bạn cần đồng ý với Điều khoản sử dụng', { field: 'agreeTerms' });

    if (userStore.findByPhone(phone)) throw conflict('Số điện thoại đã được đăng ký, vui lòng đăng nhập');
    if (userStore.findByEmail(email.trim().toLowerCase())) throw conflict('Email đã được sử dụng');

    pendingRegistrations.set(phone, {
      phone,
      businessName: name,
      taxCode: tax.replace(/\D/g, ''),
      email: email.trim().toLowerCase(),
      passwordHash: await hashPassword(password),
    });

    const otp = await requestOtp(phone, 'register', pendingRegistrations.get(phone).email);
    res.status(202).json({ data: { phone, ...otp } });
  }),
);

router.post(
  '/register/verify',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const phone = requirePhone(req.body?.phone);
    const code = requireCode(req.body?.code);
    const pending = pendingRegistrations.get(phone);
    if (!pending) throw badRequest('Phiên đăng ký đã hết hạn, vui lòng điền lại thông tin');

    verifyOtp(phone, 'register', code);
    if (userStore.findByPhone(phone)) throw conflict('Số điện thoại đã được đăng ký');

    const user = userStore.create(pending);
    pendingRegistrations.delete(phone);
    res.status(201).json({ data: session(user) });
  }),
);

/* ------------------------------------------------------------------ */
/* OTP dùng chung: gửi lại mã đăng ký, đăng nhập bằng OTP, quên MK     */
/* ------------------------------------------------------------------ */

router.post(
  '/otp/request',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const phone = requirePhone(req.body?.phone);
    const purpose = req.body?.purpose || 'login';
    if (!OTP_PURPOSES.includes(purpose)) throw badRequest('purpose không hợp lệ');

    // Mã OTP gửi về email: email đăng ký (đang chờ xác thực) hoặc email của tài khoản
    let email;
    if (purpose === 'register') {
      const pending = pendingRegistrations.get(phone);
      if (!pending) throw badRequest('Phiên đăng ký đã hết hạn, vui lòng điền lại thông tin');
      email = pending.email;
    } else {
      const user = userStore.findByPhone(phone);
      if (!user) throw notFound('Số điện thoại chưa đăng ký tài khoản');
      email = user.email;
    }

    const otp = await requestOtp(phone, purpose, email);
    res.json({ data: { phone, purpose, ...otp } });
  }),
);

router.post(
  '/otp/verify',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const phone = requirePhone(req.body?.phone);
    const purpose = req.body?.purpose || 'login';
    if (purpose !== 'login' && purpose !== 'reset') throw badRequest('purpose không hợp lệ');
    const code = requireCode(req.body?.code);

    verifyOtp(phone, purpose, code);
    const user = userStore.findByPhone(phone);
    if (!user) throw notFound('Tài khoản không tồn tại');

    if (purpose === 'login') {
      if (user.settings?.otpLogin === false) throw new HttpError(403, 'Tài khoản đã tắt đăng nhập bằng mã OTP, vui lòng dùng mật khẩu');
      securityLog('login.otp', req, { userId: user.id });
      return res.json({ data: session(user) });
    }

    // `ver` gắn token với mật khẩu hiện tại: đặt lại xong thì token này không dùng lại được
    const verificationToken = signJwt({ typ: 'phone-verified', phone, purpose, ver: credentialVersion(user) }, VERIFY_TOKEN_TTL);
    res.json({ data: { verificationToken } });
  }),
);

/* ------------------------------------------------------------------ */
/* Đăng nhập bằng mật khẩu, đặt lại mật khẩu, thông tin phiên          */
/* ------------------------------------------------------------------ */

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body || {};
    const user = findByIdentifier(identifier ?? req.body?.phone);
    // Thông báo chung để không lộ tài khoản nào đã tồn tại.
    const ok = user && typeof password === 'string' && password.length <= MAX_PASSWORD && (await verifyPassword(password, user.passwordHash));
    if (!ok) {
      securityLog('login.failed', req, { userId: user?.id || null });
      throw unauthorized('Thông tin đăng nhập hoặc mật khẩu không đúng');
    }
    res.json({ data: session(user) });
  }),
);

router.post(
  '/password/reset',
  resetLimiter,
  asyncHandler(async (req, res) => {
    let p;
    try {
      p = verifyJwt(req.body?.verificationToken);
      if (p.typ !== 'phone-verified' || p.purpose !== 'reset') throw new Error('bad token');
    } catch {
      throw unauthorized('Phiên xác thực OTP không hợp lệ hoặc đã hết hạn');
    }
    requirePassword(req.body?.password);
    const user = userStore.findByPhone(p.phone);
    if (!user) throw notFound('Tài khoản không tồn tại');
    // Token chỉ dùng được một lần: sau khi đặt lại, phiên bản đã tăng nên token cũ bị từ chối
    if ((p.ver || 0) !== credentialVersion(user)) throw unauthorized('Phiên xác thực OTP không hợp lệ hoặc đã hết hạn');
    userStore.update(user.id, { passwordHash: await hashPassword(req.body.password), tokenVersion: credentialVersion(user) + 1 });
    securityLog('password.reset', req, { userId: user.id });
    res.json({ data: { ok: true } });
  }),
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ data: userStore.toPublic(req.user) });
});

export default router;
