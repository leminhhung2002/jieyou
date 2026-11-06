import crypto from 'node:crypto';
import { config } from '../config.js';
import { badRequest, tooMany } from '../utils/httpError.js';

const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;

// key = `${purpose}:${phone}` -> { hash, expiresAt, attempts, sentAt }
const otps = new Map();

const hash = (code) => crypto.createHash('sha256').update(code).digest('hex');
const keyOf = (phone, purpose) => `${purpose}:${phone}`;

export const OTP_PURPOSES = ['register', 'login', 'reset'];

/**
 * Tạo và "gửi" OTP. Ở môi trường dev mã được log ra console và trả về trong response
 * để tiện test; ở production cần nối với nhà cung cấp SMS (eSMS, SpeedSMS, Twilio…).
 */
export async function requestOtp(phone, purpose) {
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
  await sendSms(phone, `Ma xac thuc JIEYOU cua ban la ${code}. Hieu luc ${Math.round(config.otpTtlSeconds / 60)} phut.`);
  return {
    expiresIn: config.otpTtlSeconds,
    resendIn: RESEND_COOLDOWN_MS / 1000,
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

async function sendSms(phone, message) {
  // TODO: tích hợp nhà cung cấp SMS thật ở đây.
  if (!config.isProd) console.log(`[SMS -> ${phone}] ${message}`);
}

export function _resetOtps() {
  otps.clear();
}
