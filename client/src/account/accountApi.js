import { request, tokenStorage } from '../api/client.js';

const qs = (params = {}) => {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** API Web người dùng – /api/account/* (token khách hàng). */
export const accountApi = {
  summary: (opts) => request('/account/summary', opts),
  catalog: (opts) => request('/account/catalog', opts),
  /** → { data: rows, meta: { months, stats } } */
  transactions: (params, opts) => request(`/account/transactions${qs(params)}`, { ...opts, full: true }),
  topup: (amount) => request('/account/topups', { method: 'POST', body: { amount, method: 'baoviet' } }),
  applications: (limit, opts) => request(`/account/applications${qs({ limit })}`, opts),
  /** → { ...application, timeline: [{key,label,at,done,current?,rejected?}], payment: { charged, kind, refund: {amount,at,done}|null }, invoiceNo } */
  application: (code, opts) => request(`/account/applications/${encodeURIComponent(code)}`, opts),
  /** type: ads | unipay | bct | misa | pos | social */
  submit: (type, details) => request('/account/applications', { method: 'POST', body: { type, details } }),
  draft: (type, opts) => request(`/account/drafts/${type}`, opts),
  saveDraft: (type, details) => request(`/account/drafts/${type}`, { method: 'PUT', body: { details } }),
  adBookings: (slot, opts) => request(`/account/ads/bookings${qs({ slot })}`, opts),
  /** → { data: rows, meta: { months } } */
  invoices: (params, opts) => request(`/account/invoices${qs(params)}`, { ...opts, full: true }),
  /** → { data: rows, meta: { unread } } */
  notifications: (filter, opts) => request(`/account/notifications${qs({ filter })}`, { ...opts, full: true }),
  readAll: () => request('/account/notifications/read-all', { method: 'POST', body: {} }),
  read: (id) => request(`/account/notifications/${id}/read`, { method: 'POST', body: {} }),
  settings: (opts) => request('/account/settings', opts),
  updateProfile: (patch) => request('/account/profile', { method: 'PATCH', body: patch }),
  updateSettings: (patch) => request('/account/settings', { method: 'PATCH', body: patch }),
  // Server trả token mới (các phiên cũ bị đăng xuất) – lưu lại để thiết bị này vẫn đăng nhập
  changePassword: async (currentPassword, newPassword) => {
    const data = await request('/account/password', { method: 'POST', body: { currentPassword, newPassword } });
    if (data?.token) tokenStorage.set(data.token);
    return data;
  },

  /** Mở bản in hóa đơn (HTML có token) ở tab mới để in / lưu PDF. */
  async openInvoice(no) {
    const base = import.meta.env.VITE_API_URL || '/api';
    const win = window.open('', '_blank');
    const res = await fetch(`${base}/account/invoices/${encodeURIComponent(no)}/document`, {
      headers: { Authorization: `Bearer ${tokenStorage.get()}` },
    });
    if (!res.ok) {
      win?.close();
      throw new Error('Không tải được hóa đơn');
    }
    const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
