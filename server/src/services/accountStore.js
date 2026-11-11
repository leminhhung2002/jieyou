import crypto from 'node:crypto';
import { adminStore, SERVICE_TYPES } from './adminStore.js';
import { userStore } from './userStore.js';
import { DEFAULT_SETTINGS } from '../data/accountCatalog.js';
import { atToday } from '../utils/seedTime.js';
import { emailApplicationResult, emailInvoiceIssued } from './accountEmails.js';

/**
 * Dữ liệu riêng của Web người dùng (in-memory): thông báo, hóa đơn, bản nháp.
 * Hồ sơ và giao dịch dùng chung kho với khu quản trị (adminStore) để admin duyệt được ngay.
 */
const db = {
  notifications: [], // { id, userId, kind, category, title, body, createdAt, read }
  invoices: [], // { no, userId, applicationCode, total, issuedAt }
  drafts: new Map(), // `${userId}:${type}` -> { details, savedAt }
  invoiceSeq: 184,
};

export { DEFAULT_SETTINGS };

/** Giá theo Bảng giá admin (chỉ mục Đã xuất bản), nếu chưa có thì dùng giá mặc định của danh mục. */
export function priceOf(priceName, defaultPrice, serviceSlug) {
  const item = adminStore
    .listPriceItems()
    .find((p) => p.status === 'published' && p.name === priceName && (!serviceSlug || p.serviceSlug === serviceSlug));
  return item ? item.unitPrice : defaultPrice;
}

export const accountStore = {
  db,

  settingsOf(user) {
    return {
      otpLogin: user.settings?.otpLogin ?? DEFAULT_SETTINGS.otpLogin,
      email: { ...DEFAULT_SETTINGS.email, ...(user.settings?.email || {}) },
    };
  },

  // ---------- Thông báo ----------
  notify(userId, { kind, category, title, body, createdAt }) {
    const n = {
      id: crypto.randomUUID(),
      userId,
      kind,
      category,
      title,
      body,
      createdAt: createdAt || new Date().toISOString(),
      read: false,
    };
    db.notifications.unshift(n);
    return n;
  },
  listNotifications: (userId) =>
    db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  markRead(userId, id) {
    const n = db.notifications.find((x) => x.userId === userId && x.id === id);
    if (n) n.read = true;
    return n;
  },
  markAllRead(userId) {
    db.notifications.forEach((n) => n.userId === userId && (n.read = true));
  },

  // ---------- Hóa đơn ----------
  issueInvoice(userId, applicationCode, total, issuedAt = new Date().toISOString()) {
    const existing = db.invoices.find((i) => i.applicationCode === applicationCode);
    if (existing) return existing;
    db.invoiceSeq += 1;
    const inv = { no: `1C26TAA-${String(db.invoiceSeq).padStart(6, '0')}`, userId, applicationCode, total, issuedAt };
    db.invoices.push(inv);
    return inv;
  },
  findInvoice: (userId, no) => db.invoices.find((i) => i.userId === userId && i.no === no) || null,
  invoiceOf: (code) => db.invoices.find((i) => i.applicationCode === code) || null,

  // ---------- Bản nháp ----------
  getDraft: (userId, type) => db.drafts.get(`${userId}:${type}`) || null,
  saveDraft(userId, type, details) {
    const d = { details, savedAt: new Date().toISOString() };
    db.drafts.set(`${userId}:${type}`, d);
    return d;
  },
  clearDraft: (userId, type) => db.drafts.delete(`${userId}:${type}`),

  /**
   * Gọi khi admin duyệt / từ chối hồ sơ: tạo thông báo cho khách,
   * phát hành hóa đơn với hồ sơ có phí đã được duyệt.
   */
  onApplicationReviewed(app) {
    const name = app.title || app.code;
    if (app.status === 'approved') {
      if (app.amount > 0) {
        const inv = this.issueInvoice(app.customerId, app.code, app.amount);
        emailInvoiceIssued(app.customerId, inv, name);
      }
      let body = app.amount > 0 ? 'Hồ sơ đã được duyệt. Hóa đơn đã phát hành.' : 'Hồ sơ đã được duyệt.';
      if (app.type === 'license') body = `Đã giao ${app.meta?.keys?.length || 0} key. Xem key trong mục Key bản quyền.`;
      else if (app.reviewNote) body = app.reviewNote.slice(0, 300);
      this.notify(app.customerId, {
        kind: 'done',
        category: 'application',
        title: app.type === 'license' ? `${name} đã giao key` : app.type === 'webapp' ? `${name} đã có phản hồi` : `${name} đã hoàn thành`,
        body,
      });
    } else if (app.status === 'rejected') {
      this.notify(app.customerId, {
        kind: 'error',
        category: 'application',
        title: `${name} bị từ chối`,
        body: `${app.rejectReason}${app.held > 0 ? ' Tiền tạm giữ đã được hoàn.' : ''}`,
      });
    }
    emailApplicationResult(app, SERVICE_TYPES[app.type]?.name || app.type);
  },

  /** Dữ liệu mẫu cho khách "Công ty TNHH An Phát" (SĐT 0912345678) – khớp các màn Web người dùng. */
  seed() {
    Object.assign(db, { notifications: [], invoices: [], drafts: new Map(), invoiceSeq: 184 });
    const user = userStore.findByPhone('0912345678');
    if (!user) return;
    userStore.update(user.id, { email: 'anphat@example.com', settings: structuredClone(DEFAULT_SETTINGS) });

    const at = (iso) => new Date(iso).toISOString();
    const today = new Date();
    const ymd = (d) => d.toISOString().slice(0, 10);
    const shift = (days) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return ymd(d);
    };

    // Hồ sơ quảng cáo đang chờ duyệt (đã có trong dữ liệu admin) – bổ sung thông tin có cấu trúc
    const qc = adminStore.findApplication('QC-2411-0042');
    if (qc) {
      Object.assign(qc, {
        title: 'Quảng cáo QC-2411-0042',
        amount: qc.held,
        meta: { slot: 'home-top', from: shift(-1), to: shift(1) },
      });
      adminStore.db.transactions.push({
        id: 'GD-20261102-0140', customerId: user.id, type: 'hold', amount: -qc.held, status: 'success',
        bvRef: null, note: qc.code, reconciled: true, createdAt: qc.submittedAt,
      });
    }
    // Hồ sơ BCT-2411-0052 của An Phát trong dữ liệu admin: phí đã trừ khi gửi (hoàn lại nếu bị từ chối)
    const bctNew = adminStore.findApplication('BCT-2411-0052');
    if (bctNew) {
      Object.assign(bctNew, { title: 'Hồ sơ BCT-2411-0052', amount: bctNew.held });
      adminStore.db.transactions.push({
        id: 'GD-20261102-0138', customerId: user.id, type: 'hold', amount: -bctNew.held, status: 'success',
        bvRef: null, note: bctNew.code, reconciled: true, createdAt: bctNew.submittedAt,
      });
    }
    const addApp = (a) => adminStore.addApplication({ customerId: user.id, history: [], held: a.amount || 0, ...a });
    const addTx = (id, type, amount, note, createdAt) =>
      adminStore.db.transactions.push({ id, customerId: user.id, type, amount, status: 'success', bvRef: null, note, reconciled: true, createdAt });

    // Lịch sử (màn "Tài khoản trả trước")
    addApp({
      code: 'BCT-2410-0187', type: 'bct', title: 'Hồ sơ BCT-2410-0187', status: 'approved', amount: 800_000,
      submittedAt: at('2026-10-28T02:12:00Z'), reviewedAt: at('2026-10-28T08:00:00Z'), reviewedBy: 'duyetvien01',
      details: { 'Loại hồ sơ': 'Thông báo website TMĐT', 'Gói': 'Cơ bản' },
    });
    addTx('GD-20261028-0101', 'hold', -800_000, 'BCT-2410-0187', at('2026-10-28T02:12:00Z'));

    addApp({
      code: 'MB-2410-0031', type: 'misa', title: 'Hồ sơ MB-2410-0031', status: 'rejected', amount: 2_400_000,
      submittedAt: at('2026-10-20T09:02:00Z'), reviewedAt: at('2026-10-21T09:40:00Z'), reviewedBy: 'duyetvien01',
      rejectReason: 'Thiếu ảnh giấy phép kinh doanh. Sửa và gửi lại.',
      details: { 'Mẫu máy': 'Máy bán hàng cơ bản', 'Số lượng': '1' },
    });
    addTx('GD-20261020-0061', 'hold', -2_400_000, 'MB-2410-0031', at('2026-10-20T09:02:00Z'));
    addTx('GD-20261021-0077', 'refund', 2_400_000, 'MB-2410-0031', at('2026-10-21T09:40:00Z'));

    addApp({
      code: 'MB-2410-0029', type: 'misa', title: 'Máy bán hàng MB-2410-0029', status: 'approved', amount: 2_640_000,
      submittedAt: at('2026-10-13T03:00:00Z'), reviewedAt: at('2026-10-14T03:00:00Z'), reviewedBy: 'duyetvien01',
      details: { 'Mẫu máy': 'Máy bán hàng cơ bản', 'Số lượng': '1', 'Hóa đơn 1INVOICE': 'Có, VAT 10%' },
    });
    addTx('GD-20261013-0030', 'hold', -2_640_000, 'MB-2410-0029', at('2026-10-13T03:00:00Z'));
    addTx('GD-20261012-0021', 'topup', 10_000_000, null, at('2026-10-12T02:00:00Z'));

    // Hai quảng cáo đã duyệt đang chạy
    [['QC-2410-0035', 'mid-page', -2, 3], ['QC-2410-0038', 'service-page', -1, 5]].forEach(([code, slot, from, to], i) => {
      const days = to - from + 1;
      const amount = days * (slot === 'mid-page' ? 300_000 : 400_000);
      const submittedAt = at(`2026-10-2${5 + i}T03:00:00Z`);
      addApp({
        code, type: 'ads', title: `Quảng cáo ${code}`, status: 'approved', amount, submittedAt,
        reviewedAt: submittedAt, reviewedBy: 'duyetvien01', meta: { slot, from: shift(from), to: shift(to) },
        details: { 'Vị trí': slot === 'mid-page' ? 'Banner giữa trang' : 'Banner trang dịch vụ', 'Số ngày': String(days) },
      });
      addTx(`GD-2026102${5 + i}-00${50 + i}`, 'hold', -amount, code, submittedAt);
      db.invoices.push({ no: `1C26TAA-00017${5 + i}`, userId: user.id, applicationCode: code, total: amount, issuedAt: submittedAt });
    });

    // Hóa đơn (màn "Hóa đơn")
    db.invoices.push(
      { no: '1C26TAA-000184', userId: user.id, applicationCode: 'BCT-2410-0187', total: 880_000, issuedAt: at('2026-10-28T08:00:00Z') },
      { no: '1C26TAA-000171', userId: user.id, applicationCode: 'MB-2410-0029', total: 2_640_000, issuedAt: at('2026-10-14T03:00:00Z') },
    );

    // Thông báo (màn "Thông báo")
    const N = (kind, category, title, body, createdAt, read = true) =>
      db.notifications.push({ id: crypto.randomUUID(), userId: user.id, kind, category, title, body, createdAt, read });
    const todayAt = atToday;
    N('success', 'transaction', 'Nạp tiền thành công', '+5.000.000 đ đã vào tài khoản trả trước.', todayAt(10, 2), false);
    N('error', 'application', 'Hồ sơ MB-2410-0031 bị từ chối', 'Thiếu ảnh giấy phép kinh doanh. Sửa và gửi lại.', todayAt(9, 50), false);
    N('ads', 'application', 'Quảng cáo QC-2411-0042 đang chờ duyệt', 'Đã tạm giữ 1.500.000 đ.', qc?.submittedAt || todayAt(9, 0));
    N('done', 'application', 'Hồ sơ BCT-2410-0187 đã hoàn thành', 'Hồ sơ đã được duyệt. Hóa đơn đã phát hành.', at('2026-10-28T08:00:00Z'));
    N('topup', 'transaction', 'Nạp tiền 10.000.000 đ thành công', 'Số dư mới: 17.480.000 đ.', at('2026-10-12T02:00:00Z'));
  },

  _reset() {
    Object.assign(db, { notifications: [], invoices: [], drafts: new Map(), invoiceSeq: 184 });
  },
};
