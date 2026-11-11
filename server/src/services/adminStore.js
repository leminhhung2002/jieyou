import crypto from 'node:crypto';
import { hashPassword } from './password.js';
import { userStore } from './userStore.js';
import { config } from '../config.js';
import { atToday, daysAgo } from '../utils/seedTime.js';

/**
 * Dữ liệu quản trị (in-memory) + dữ liệu mẫu khớp thiết kế Admin trong Figma.
 * Interface nhỏ gọn để có thể thay bằng DB thật mà không đổi route.
 */

export const PERMISSIONS = [
  { key: 'applications', label: 'Duyệt hồ sơ' },
  { key: 'customers', label: 'Khách hàng' },
  { key: 'transactions', label: 'Giao dịch và hoàn tiền' },
  { key: 'content', label: 'Nội dung' },
  { key: 'roles', label: 'Phân quyền' },
];

export const SERVICE_TYPES = {
  ads: { label: 'Quảng cáo', name: 'Quảng cáo trên sàn', prefix: 'QC' },
  bct: { label: 'BCT', name: 'Hồ sơ Bộ Công Thương', prefix: 'BCT' },
  misa: { label: 'Máy bán hàng', name: 'Máy bán hàng + MISA', prefix: 'MB' },
  pos: { label: 'POS', name: 'Hồ sơ cổng thanh toán POS', prefix: 'POS' },
  unipay: { label: 'UniPay', name: 'Tài khoản UniPay', prefix: 'UP' },
  social: { label: 'MXH', name: 'Tăng tương tác MXH', prefix: 'MXH' },
  webapp: { label: 'App/Web', name: 'Làm app/web theo yêu cầu', prefix: 'WEB' },
  license: { label: 'Key bản quyền', name: 'Key phần mềm bản quyền', prefix: 'KEY' },
};

const db = {
  roles: [],
  admins: [],
  applications: [],
  transactions: [],
  priceItems: [],
  logs: [],
  invoicesPending: 2,
  // Giá dịch vụ tăng tương tác (services/smmCatalog.js)
  smmSettings: { markupPercent: null, overrides: {} },
  // Key phần mềm bản quyền (services/licenseStore.js)
  licenseProducts: [],
  licenseKeys: [],
  // Phí Máy bán hàng + MISA và hồ sơ POS (services/feeSettings.js)
  feeSettings: { misaDevices: {}, vatRates: null, posFee: null, machines: {}, invoicePlans: null },
};


export const adminStore = {
  db,

  // ---------- Vai trò & quản trị viên ----------
  listRoles: () => db.roles,
  findRole: (id) => db.roles.find((r) => r.id === id) || null,
  createRole(name, permissions) {
    const role = { id: crypto.randomUUID(), name, permissions, locked: false };
    db.roles.push(role);
    return role;
  },
  updateRole(id, patch) {
    const role = db.roles.find((r) => r.id === id);
    if (role) Object.assign(role, patch);
    return role;
  },
  removeRole(id) {
    const i = db.roles.findIndex((r) => r.id === id);
    if (i >= 0) db.roles.splice(i, 1);
    return i >= 0;
  },
  countAdminsInRole: (id) => db.admins.filter((a) => a.roleId === id).length,
  findAdminByUsername: (u) => db.admins.find((a) => a.username === u) || null,
  findAdminById: (id) => db.admins.find((a) => a.id === id) || null,
  permissionsOf(admin) {
    return this.findRole(admin.roleId)?.permissions || [];
  },
  toPublicAdmin(admin) {
    const role = this.findRole(admin.roleId);
    return { id: admin.id, username: admin.username, name: admin.name, role: role?.name, permissions: role?.permissions || [] };
  },

  // ---------- Hồ sơ ----------
  listApplications: () => db.applications,
  findApplication: (code) => db.applications.find((a) => a.code === code) || null,
  addApplication(app) {
    db.applications.push(app);
    return app;
  },

  // ---------- Giao dịch ----------
  listTransactions: () => db.transactions,
  addTransaction({ customerId, type, amount, status = 'success', bvRef = null, note = null }) {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(db.transactions.length + 143).padStart(4, '0');
    const tx = {
      id: `GD-${ymd}-${seq}`,
      customerId,
      type,
      amount,
      status,
      bvRef,
      note,
      reconciled: type !== 'topup' || Boolean(bvRef),
      createdAt: now.toISOString(),
    };
    db.transactions.unshift(tx);
    return tx;
  },

  // ---------- Bảng giá ----------
  listPriceItems: () => db.priceItems,
  findPriceItem: (id) => db.priceItems.find((p) => p.id === id) || null,
  addPriceItem(item) {
    const p = { id: crypto.randomUUID(), updatedAt: new Date().toISOString(), ...item };
    db.priceItems.push(p);
    return p;
  },
  updatePriceItem(id, patch) {
    const p = db.priceItems.find((x) => x.id === id);
    if (p) Object.assign(p, patch, { updatedAt: new Date().toISOString() });
    return p;
  },
  removePriceItem(id) {
    const i = db.priceItems.findIndex((x) => x.id === id);
    if (i >= 0) db.priceItems.splice(i, 1);
    return i >= 0;
  },

  // ---------- Nhật ký ----------
  log(actor, action, target, result = 'success') {
    db.logs.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, target, result });
  },
  listLogs: () => db.logs,

  async seed() {
    Object.assign(db, { roles: [], admins: [], applications: [], transactions: [], priceItems: [], logs: [], invoicesPending: 2, smmSettings: { markupPercent: null, overrides: {} }, licenseProducts: [], licenseKeys: [], feeSettings: { misaDevices: {}, vatRates: null, posFee: null, machines: {}, invoicePlans: null } });

    // Vai trò – đúng ma trận trong màn "Phân quyền"
    const R = (name, permissions, locked = false) => {
      const r = { id: crypto.randomUUID(), name, permissions, locked };
      db.roles.push(r);
      return r;
    };
    const superAdmin = R('Super Admin', PERMISSIONS.map((p) => p.key), true);
    const reviewer = R('Duyệt viên', ['applications', 'customers']);
    const accountant = R('Kế toán', ['transactions']);
    const editor = R('Biên tập nội dung', ['content']);
    R('Hỗ trợ khách hàng', ['customers']);

    // Tài khoản quản trị (mật khẩu mặc định lấy từ env)
    const pw = await hashPassword(config.adminDefaultPassword);
    const A = (username, name, role) => db.admins.push({ id: crypto.randomUUID(), username, name, roleId: role.id, passwordHash: pw });
    A('admin', 'Quản trị hệ thống', superAdmin);
    A('duyetvien01', 'Duyệt viên 01', reviewer);
    A('ketoan02', 'Kế toán 02', accountant);
    A('bientap01', 'Biên tập 01', editor);

    // Khách hàng – màn "Khách hàng"
    const C = (businessName, taxCode, phone, balance, createdAt, status = 'active') =>
      userStore.create({
        businessName,
        taxCode,
        phone,
        // Email mẫu thuộc tên miền dành riêng example.com: mailer không gửi thật (tránh thư dội lại)
        email: `kh${phone}@example.com`,
        passwordHash: null, // tài khoản mẫu: đăng nhập bằng OTP
        balance,
        status,
        createdAt,
      });
    const anPhat = C('Công ty TNHH An Phát', '0123456789', '0912345678', 12_480_000, '2026-09-15T08:00:00.000Z');
    const minhKhoa = C('Cửa hàng Minh Khoa', '0312345670', '0903112233', 3_200_000, '2026-10-02T08:00:00.000Z');
    const saoViet = C('CTCP Sao Việt', '0109876543', '0988765432', 0, '2026-10-20T08:00:00.000Z', 'locked');
    const lanAnh = C('Hộ KD Lan Anh', '8123456789', '0977001002', 850_000, '2026-10-28T08:00:00.000Z');
    const hoangGia = C('Hoàng Gia Trading', '0305566778', '0911223344', 5_600_000, '2026-11-01T08:00:00.000Z');

    // Hồ sơ – 12 hồ sơ chờ duyệt, 3 hồ sơ quá 24 giờ (khớp số liệu Tổng quan)
    const P = (code, customer, type, submittedAt, details = {}, held = 0) =>
      db.applications.push({ code, customerId: customer.id, type, status: 'pending', submittedAt, details, held, history: [] });
    P('QC-2411-0042', anPhat, 'ads', atToday(10, 5), { 'Vị trí': 'Banner đầu trang chủ', 'Ngày chạy': '05/11 đến 07/11' }, 1_500_000);
    P('BCT-2411-0051', minhKhoa, 'bct', atToday(9, 40), { 'Loại hồ sơ': 'Thông báo website TMĐT', 'Gói': 'Cơ bản' }, 800_000);
    P('MB-2411-0030', saoViet, 'misa', daysAgo(1, 8, 15), { 'Mẫu máy': 'MÁY B', 'Gói hóa đơn': 'M · 1000 hóa đơn' }, 2_400_000);
    P('POS-2411-0009', lanAnh, 'pos', daysAgo(1, 8, 30), { 'Cổng': 'POS UniPay', 'Phí': 'Miễn phí' }, 0);
    P('BCT-2411-0049', hoangGia, 'bct', daysAgo(1, 7, 50), { 'Loại hồ sơ': 'Đăng ký sàn TMĐT', 'Gói': 'Nâng cao' }, 800_000);
    const extra = [
      ['QC-2411-0043', hoangGia, 'ads', { 'Vị trí': 'Bài viết tài trợ', 'Ngày chạy': '08/11 đến 10/11' }, 1_500_000],
      ['QC-2411-0044', lanAnh, 'ads', { 'Vị trí': 'Ghim chuyên mục', 'Ngày chạy': '06/11' }, 500_000],
      ['BCT-2411-0052', anPhat, 'bct', { 'Loại hồ sơ': 'Thông báo website TMĐT', 'Gói': 'Cơ bản' }, 800_000],
      ['MB-2411-0031', minhKhoa, 'misa', { 'Mẫu máy': 'MÁY A', 'Gói hóa đơn': 'S · 300 hóa đơn' }, 2_400_000],
      ['POS-2411-0010', hoangGia, 'pos', { 'Cổng': 'POS UniPay', 'Phí': 'Miễn phí' }, 0],
      ['QC-2411-0045', minhKhoa, 'ads', { 'Vị trí': 'Banner đầu trang chủ', 'Ngày chạy': '09/11 đến 12/11' }, 2_000_000],
      ['BCT-2411-0053', lanAnh, 'bct', { 'Loại hồ sơ': 'Đăng ký website TMĐT', 'Gói': 'Cơ bản' }, 800_000],
    ];
    // Gửi trong sáng nay, trước 2 hồ sơ mới nhất (An Phát 10:05, Minh Khoa 09:40)
    extra.forEach(([code, c, type, details, held], i) => P(code, c, type, atToday(9, 30 - i * 4), details, held));

    // Giao dịch – màn "Giao dịch"
    const T = (id, customer, amount, bvRef, status, createdAt) =>
      db.transactions.push({ id, customerId: customer.id, type: 'topup', amount, status, bvRef, reconciled: true, createdAt, note: null });
    T('GD-20261102-0142', anPhat, 5_000_000, 'BV88231907', 'success', atToday(10, 2));
    T('GD-20261102-0141', minhKhoa, 2_000_000, 'BV88231544', 'success', atToday(9, 31));
    T('GD-20261102-0139', saoViet, 10_000_000, 'BV88230971', 'pending', atToday(8, 47));
    T('GD-20261101-0120', lanAnh, 500_000, 'BV88229012', 'failed', daysAgo(1, 16, 20));
    T('GD-20261101-0118', hoangGia, 5_000_000, 'BV88228876', 'success', daysAgo(1, 15, 2));

    // Bảng giá – màn "Nội dung · Bảng giá" (nguồn giá duy nhất cho Website/App)
    const I = (serviceSlug, serviceName, name, unitPrice, vat, status, updatedAt) =>
      db.priceItems.push({ id: crypto.randomUUID(), serviceSlug, serviceName, name, unitPrice, vat, status, updatedAt });
    I('quang-cao-tren-san', 'Quảng cáo trên sàn', 'Banner đầu trang chủ / ngày', 500_000, 10, 'published', '2026-11-01T08:00:00.000Z');
    I('ho-so-bo-cong-thuong', 'Hồ sơ Bộ Công Thương', 'Phí dịch vụ / hồ sơ', 800_000, 10, 'published', '2026-11-01T08:00:00.000Z');
    I('may-ban-hang-misa', 'Máy bán hàng + MISA', 'Máy bán hàng cơ bản', 2_400_000, 10, 'published', '2026-10-20T08:00:00.000Z');
    I('tang-tuong-tac-mxh', 'Tăng tương tác MXH', 'Lượt thích Facebook / lượt', 30, 8, 'draft', '2026-11-02T08:00:00.000Z');
    I('cong-thanh-toan-pos', 'Hồ sơ cổng thanh toán POS', 'Phí dịch vụ', 0, null, 'published', '2026-10-15T08:00:00.000Z');

    // Nhật ký – màn "Nhật ký hoạt động"
    const L = (at, actor, action, target) => db.logs.push({ id: crypto.randomUUID(), at, actor, action, target, result: 'success' });
    L(daysAgo(0, 14, 35), 'duyetvien01', 'Duyệt hồ sơ', 'QC-2411-0041');
    L(daysAgo(0, 14, 10), 'ketoan02', 'Duyệt hoàn tiền', 'MB-2410-0031');
    L(daysAgo(0, 11, 20), 'bientap01', 'Xuất bản bảng giá', 'Banner đầu trang chủ');
    L(daysAgo(0, 9, 2), 'admin', 'Khóa tài khoản', 'CTCP Sao Việt');
    L(daysAgo(1, 17, 45), 'duyetvien01', 'Từ chối hồ sơ', 'BCT-2411-0047');
  },
};
