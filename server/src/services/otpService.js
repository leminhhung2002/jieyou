import crypto from 'node:crypto';
import { config } from '../config.js';
import { badRequest, tooMany, HttpError } from '../utils/httpError.js';
import { mailer } from './mailer.js';
import { renderOtpEmail, maskEmail } from './otpEmail.js';

const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;

// key = `${purpose}:${phone}` -> { hash, expiresAt, attempts, sentAt }
const otps = new Map();

const hash = (code) => crypto.createHash('sha256').update(code).digest('hex');
const keyOf = (phone, purpose) => `${purpose}:${phone}`;

export const OTP_PURPOSES = ['register', 'login', 'reset'];

/**
 * Tạo OTP và gửi về email của tài khoản (Gmail SMTP). OTP vẫn gắn với số điện thoại (định danh tài khoản).
 * Ở dev/test mã còn được trả về trong response (devCode) để tiện test.
 */
export async function requestOtp(phone, purpose, email) {
  if (!email) throw badRequest('Tài khoản chưa có email để nhận mã OTP, vui lòng liên hệ hỗ trợ');
  const key = keyOf(phone, purpose);
  const existing = otps.get(key);
  const now = Date.now();
  if (existing && now - existing.sentAt < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.sentAt)) / 1000);
    throw tooMany(`Vui lòng chờ ${wait}s trước khi gửi lại mã`);
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  otps.set(key, {
    hash: hash(code),
    expiresAt: now + config.otpTtlSeconds * 1000,
    attempts: 0,
    sentAt: now,
  });
  try {
    const { subject, text, html } = renderOtpEmail({ code, purpose, minutes: Math.round(config.otpTtlSeconds / 60) });
    await mailer.send({ to: email, subject, text, html, tag: `otp.${purpose}`, critical: true });
  } catch {
    otps.delete(key); // gửi lỗi thì cho gửi lại ngay, không bắt chờ
    throw new HttpError(503, 'Không gửi được email chứa mã OTP, vui lòng thử lại sau ít phút');
  }
  return {
    expiresIn: config.otpTtlSeconds,
    resendIn: RESEND_COOLDOWN_MS / 1000,
    sentTo: maskEmail(email),
    ...(config.isProd ? {} : { devCode: code }),
  };
}

export function verifyOtp(phone, purpose, code) {
  const key = keyOf(phone, purpose);
  const entry = otps.get(key);
  if (!entry) throw badRequest('Mã OTP không tồn tại hoặc đã hết hạn');
  if (Date.now() > entry.expiresAt) {
    otps.delete(key);
    throw badRequest('Mã OTP đã hết hạn');
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    otps.delete(key);
    throw tooMany('Nhập sai quá nhiều lần, vui lòng yêu cầu mã mới');
  }
  entry.attempts += 1;
  const ok = crypto.timingSafeEqual(Buffer.from(entry.hash), Buffer.from(hash(String(code))));
  if (!ok) throw badRequest(`Mã OTP không đúng (còn ${MAX_ATTEMPTS - entry.attempts} lần thử)`);
  otps.delete(key);
  return true;
}

export function _resetOtps() {
  otps.clear();
}
