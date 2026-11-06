/**
 * Thông tin đăng ký đang chờ xác thực OTP (giữ tối đa 15 phút).
 * Mật khẩu đã được băm trước khi lưu vào đây.
 */
const TTL_MS = 15 * 60 * 1000;
const store = new Map();

export const pendingRegistrations = {
  set(phone, data) {
    store.set(phone, { data, expiresAt: Date.now() + TTL_MS });
  },
  get(phone) {
    const entry = store.get(phone);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(phone);
      return null;
    }
    return entry.data;
  },
  delete(phone) {
    store.delete(phone);
  },
  _reset() {
    store.clear();
  },
};
