// Đồng bộ với server/src/utils/validators.js
const VN_PHONE = /^(?:\+?84|0)(3|5|7|8|9)\d{8}$/;

export const cleanPhone = (v) => String(v || '').replace(/[\s.\-()]/g, '');
export const isValidVnPhone = (v) => VN_PHONE.test(cleanPhone(v));
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
