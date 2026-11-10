import { ApiError } from '../api/client.js';

const BASE = (import.meta.env.VITE_API_URL || '/api') + '/admin';
const TOKEN_KEY = 'jieyou.adminToken';

export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Sự kiện khi phiên admin hết hạn (401) để layout chuyển về trang đăng nhập. */
export const ADMIN_UNAUTHORIZED = 'jieyou:admin-unauthorized';

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = adminToken.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Không kết nối được máy chủ, vui lòng thử lại');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED));
    throw new ApiError(res.status, json?.error?.message || 'Đã có lỗi xảy ra', json?.error?.details);
  }
  // Trả cả meta (nếu có) để màn hình dùng số liệu tổng hợp
  return json.meta ? { data: json.data, meta: json.meta } : json.data;
}

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null));
  return s.toString() ? `?${s}` : '';
};

export const adminApi = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  me: (o) => request('/auth/me', o),
  overview: (o) => request('/overview', o),

  applications: (params = {}, o) => request(`/applications${qs(params)}`, o),
  application: (code, o) => request(`/applications/${encodeURIComponent(code)}`, o),
  /** note: ghi chú gửi khách (vd. báo giá yêu cầu làm app/web), không bắt buộc */
  approve: (code, note) => request(`/applications/${encodeURIComponent(code)}/approve`, { method: 'POST', body: note ? { note } : {} }),
  reject: (code, reason) => request(`/applications/${encodeURIComponent(code)}/reject`, { method: 'POST', body: { reason } }),

  customers: (params = {}, o) => request(`/customers${qs(params)}`, o),
  setCustomerStatus: (id, status) => request(`/customers/${id}/status`, { method: 'PATCH', body: { status } }),

  transactions: (params = {}, o) => request(`/transactions${qs(params)}`, o),

  priceItems: (o) => request('/price-items', o),
  createPriceItem: (item) => request('/price-items', { method: 'POST', body: item }),
  updatePriceItem: (id, patch) => request(`/price-items/${id}`, { method: 'PATCH', body: patch }),
  deletePriceItem: (id) => request(`/price-items/${id}`, { method: 'DELETE' }),

  // Giá dịch vụ tăng tương tác (hotrodvfb)
  smm: (params = {}, o) => request(`/smm${qs(params)}`, o),
  setSmmMarkup: (markupPercent) => request('/smm/settings', { method: 'PATCH', body: { markupPercent } }),
  updateSmmService: (id, patch) => request(`/smm/services/${id}`, { method: 'PATCH', body: patch }),

  // Key phần mềm bản quyền
  fees: (o) => request('/fees', o),
  updateFees: (patch) => request('/fees', { method: 'PATCH', body: patch }),

  licenses: (o) => request('/licenses', o),
  createLicense: (body) => request('/licenses', { method: 'POST', body }),
  updateLicense: (id, patch) => request(`/licenses/${id}`, { method: 'PATCH', body: patch }),
  deleteLicense: (id) => request(`/licenses/${id}`, { method: 'DELETE' }),
  /** → { data: keys, meta: { product } } */
  licenseKeys: (id, o) => request(`/licenses/${id}/keys`, o),
  addLicenseKeys: (id, keys) => request(`/licenses/${id}/keys`, { method: 'POST', body: { keys } }),
  deleteLicenseKey: (id, keyId) => request(`/licenses/${id}/keys/${keyId}`, { method: 'DELETE' }),

  roles: (o) => request('/roles', o),
  createRole: (name, permissions) => request('/roles', { method: 'POST', body: { name, permissions } }),
  updateRole: (id, permissions) => request(`/roles/${id}`, { method: 'PATCH', body: { permissions } }),

  logs: (params = {}, o) => request(`/logs${qs(params)}`, o),
};
