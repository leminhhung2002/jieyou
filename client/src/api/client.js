const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'jieyou.token';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** `full: true` trả cả { data, meta } thay vì chỉ data. */
export async function request(path, { method = 'GET', body, signal, full = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStorage.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Không kết nối được máy chủ, vui lòng thử lại');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.message || 'Đã có lỗi xảy ra', json?.error?.details);
  }
  return full ? json : json.data;
}

export const api = {
  services: (opts) => request('/services', opts),
  service: (slug, opts) => request(`/services/${encodeURIComponent(slug)}`, opts),
  pricing: (opts) => request('/pricing', opts),
  faqs: (opts) => request('/faqs', opts),
  news: (limit = 3, opts) => request(`/news?limit=${limit}`, opts),

  /** B1 đăng ký: gửi thông tin doanh nghiệp, server gửi OTP về số điện thoại */
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  /** B2 đăng ký: xác thực OTP -> tạo tài khoản, trả { token, user } */
  verifyRegistration: (phone, code) => request('/auth/register/verify', { method: 'POST', body: { phone, code } }),
  /** purpose: 'login' | 'reset' | 'register' (gửi lại mã đăng ký) */
  requestOtp: (phone, purpose = 'login') => request('/auth/otp/request', { method: 'POST', body: { phone, purpose } }),
  verifyOtp: (phone, code, purpose = 'login') =>
    request('/auth/otp/verify', { method: 'POST', body: { phone, code, purpose } }),
  login: (identifier, password) => request('/auth/login', { method: 'POST', body: { identifier, password } }),
  resetPassword: (verificationToken, password) =>
    request('/auth/password/reset', { method: 'POST', body: { verificationToken, password } }),
  me: (opts) => request('/auth/me', opts),
};
