// Số di động Việt Nam: 0 hoặc +84, theo sau là đầu số 3/5/7/8/9 và 8 chữ số.
const VN_PHONE = /^(?:\+?84|0)(3|5|7|8|9)\d{8}$/;

/** Chuẩn hoá số điện thoại về dạng 0xxxxxxxxx, trả về null nếu không hợp lệ. */
export function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[\s.\-()]/g, '');
  if (!VN_PHONE.test(cleaned)) return null;
  return cleaned.replace(/^\+?84/, '0');
}

export function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function isNonEmptyString(v, max = 255) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
}

/** Mã số thuế VN: 10 chữ số, hoặc 13 chữ số (chi nhánh, dạng 0123456789-001). */
export function isTaxCode(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return false;
  const s = String(v).trim();
  return /^\d{10}$/.test(s) || /^\d{10}-?\d{3}$/.test(s);
}
