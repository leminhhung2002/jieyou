import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin, signAdminToken } from '../middleware/adminAuth.js';
import { adminStore, PERMISSIONS, SERVICE_TYPES } from '../services/adminStore.js';
import { userStore } from '../services/userStore.js';
import { accountStore } from '../services/accountStore.js';
import { isProviderOrder } from '../services/smmSync.js';
import { smmEnabled, smmProvider } from '../services/smmProvider.js';
import { getSmmCatalog, smmMarkup, SMM_PLATFORMS } from '../services/smmCatalog.js';
import { licenseStore } from '../services/licenseStore.js';
import { applyFeeSettings, feeSettingsView } from '../services/feeSettings.js';
import { verifyPassword } from '../services/password.js';
import { isNonEmptyString } from '../utils/validators.js';
import { securityLog } from '../utils/securityLog.js';
import { badRequest, conflict, notFound, unauthorized, HttpError } from '../utils/httpError.js';

const router = Router();
const DAY = 24 * 3600_000;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 10 : 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau' } },
});

const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();

function applicationView(app) {
  const overdue = app.status === 'pending' && Date.now() - new Date(app.submittedAt).getTime() > DAY;
  const customer = userStore.findById(app.customerId);
  return {
    code: app.code,
    type: app.type,
    service: SERVICE_TYPES[app.type]?.name,
    serviceLabel: SERVICE_TYPES[app.type]?.label,
    customer: { id: customer?.id, name: customer?.businessName, shortName: shortName(customer?.businessName) },
    status: overdue ? 'overdue' : app.status,
    submittedAt: app.submittedAt,
    held: app.held,
    details: app.details,
    rejectReason: app.rejectReason || null,
    reviewNote: app.reviewNote || null,
    reviewedBy: app.reviewedBy || null,
    reviewedAt: app.reviewedAt || null,
  };
}

/** "Công ty TNHH An Phát" -> "An Phát" (cột Khách hàng rút gọn ở màn Duyệt hồ sơ) */
function shortName(name = '') {
  return name.replace(/^(Công ty TNHH|Công ty|CTCP|Cửa hàng|Hộ KD)\s+/i, '').replace(/\s+Trading$/i, '');
}

function customerView(u) {
  return {
    id: u.id,
    businessName: u.businessName,
    taxCode: u.taxCode,
    phone: u.phone,
    email: u.email,
    balance: u.balance || 0,
    status: u.status || 'active',
    createdAt: u.createdAt,
  };
}

function transactionView(t) {
  const c = userStore.findById(t.customerId);
  const { payment: _payment, ...rest } = t; // ảnh QR / link thanh toán: không gửi cho admin
  return { ...rest, customer: { id: c?.id, name: c?.businessName, shortName: shortName(c?.businessName) } };
}

/* ======================= Đăng nhập quản trị ======================= */

router.post(
  '/auth/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const admin = adminStore.findAdminByUsername(String(username || '').trim().toLowerCase());
    if (!admin || typeof password !== 'string' || password.length > 128 || !(await verifyPassword(password, admin.passwordHash))) {
      securityLog('admin.login.failed', req, { username: String(username || '').slice(0, 60) });
      throw unauthorized('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    securityLog('admin.login', req, { admin: admin.username });
    adminStore.log(admin.username, 'Đăng nhập', 'Hệ thống quản trị');
    res.json({ data: { token: signAdminToken(admin), admin: adminStore.toPublicAdmin(admin) } });
  }),
);

router.get('/auth/me', requireAdmin(), (req, res) => {
  res.json({ data: adminStore.toPublicAdmin(req.admin) });
});

/* ============================ Tổng quan ============================ */

router.get('/overview', requireAdmin(), (req, res) => {
  const apps = adminStore.listApplications().map(applicationView);
  const pending = apps.filter((a) => a.status === 'pending' || a.status === 'overdue');
  const overdue = pending.filter((a) => a.status === 'overdue');
  const customers = userStore.list();
  const topupsToday = adminStore.listTransactions().filter((t) => t.type === 'topup' && t.status === 'success' && isToday(t.createdAt));
  // Lệnh nạp chờ quá 30 phút chưa nhận được kết quả từ cổng thanh toán
  const stuck = adminStore
    .listTransactions()
    .filter((t) => t.type === 'topup' && t.status === 'pending' && !t.reconciled && Date.now() - Date.parse(t.createdAt) > 30 * 60_000);

  const queue = [...pending].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  // Hàng đợi: hồ sơ mới nhất trước, luôn kèm các hồ sơ quá hạn
  const preview = [...queue.filter((a) => a.status !== 'overdue').slice(0, 2), ...overdue.slice(0, 2)];

  res.json({
    data: {
      stats: {
        pending: pending.length,
        overdue: overdue.length,
        newCustomersToday: customers.filter((c) => isToday(c.createdAt)).length,
        totalCustomers: customers.length,
        topupToday: topupsToday.reduce((s, t) => s + t.amount, 0),
        topupTodayCount: topupsToday.length,
        webhookErrors: stuck.length,
      },
      queue: preview,
      attention: [
        overdue.length && { kind: 'overdue', title: `${overdue.length} hồ sơ quá hạn xử lý`, subtitle: 'Ưu tiên duyệt trước', link: '/admin/duyet-ho-so' },
        adminStore.db.invoicesPending && {
          kind: 'invoice',
          title: `${adminStore.db.invoicesPending} hóa đơn chờ phát hành`,
          subtitle: 'Kế toán xử lý',
          link: '/admin/giao-dich',
        },
      ].filter(Boolean),
    },
  });
});

/* ============================ Duyệt hồ sơ ============================ */

router.get('/applications', requireAdmin('applications'), (req, res) => {
  const { type, status = 'pending' } = req.query;
  let list = adminStore.listApplications().map(applicationView);
  if (status === 'pending') list = list.filter((a) => a.status === 'pending' || a.status === 'overdue');
  else if (status !== 'all') list = list.filter((a) => a.status === status);
  const counts = Object.fromEntries(Object.keys(SERVICE_TYPES).map((k) => [k, list.filter((a) => a.type === k).length]));
  if (type && type !== 'all') list = list.filter((a) => a.type === type);
  list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  res.json({ data: list, meta: { counts, types: SERVICE_TYPES } });
});

router.get('/applications/:code', requireAdmin('applications'), (req, res, next) => {
  const app = adminStore.findApplication(req.params.code);
  if (!app) return next(notFound('Hồ sơ không tồn tại'));
  res.json({ data: applicationView(app) });
});

function requirePending(code) {
  const app = adminStore.findApplication(code);
  if (!app) throw notFound('Hồ sơ không tồn tại');
  if (app.status !== 'pending') throw conflict('Hồ sơ đã được xử lý');
  // Đơn đã gửi sang hotrodvfb: trạng thái và hoàn tiền tự đồng bộ theo NCC (services/smmSync.js)
  if (isProviderOrder(app)) throw conflict('Đơn đang chạy tự động tại hotrodvfb, hệ thống sẽ tự cập nhật khi đơn kết thúc');
  return app;
}

router.post('/applications/:code/approve', requireAdmin('applications'), (req, res) => {
  // Ghi chú gửi khách khi duyệt (vd. báo giá cho yêu cầu làm app / web) – không bắt buộc
  const note = String(req.body?.note || '').trim();
  if (note.length > 2000) throw badRequest('Ghi chú tối đa 2.000 ký tự', { field: 'note' });
  const app = requirePending(req.params.code);
  Object.assign(app, { status: 'approved', reviewedBy: req.admin.username, reviewedAt: new Date().toISOString() });
  if (note) app.reviewNote = note;
  // Tiền tạm giữ chuyển thành phí dịch vụ
  if (app.held > 0) adminStore.addTransaction({ customerId: app.customerId, type: 'fee', amount: -app.held, note: app.code });
  adminStore.log(req.admin.username, 'Duyệt hồ sơ', app.code);
  accountStore.onApplicationReviewed(app);
  res.json({ data: applicationView(app) });
});

router.post('/applications/:code/reject', requireAdmin('applications'), (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 5) throw badRequest('Vui lòng nhập lý do từ chối (tối thiểu 5 ký tự)', { field: 'reason' });
  if (reason.length > 500) throw badRequest('Lý do tối đa 500 ký tự', { field: 'reason' });
  const app = requirePending(req.params.code);
  Object.assign(app, { status: 'rejected', rejectReason: reason, reviewedBy: req.admin.username, reviewedAt: new Date().toISOString() });
  // Hoàn lại tiền tạm giữ vào số dư khách hàng
  if (app.held > 0) {
    const customer = userStore.findById(app.customerId);
    if (customer) userStore.update(customer.id, { balance: (customer.balance || 0) + app.held });
    adminStore.addTransaction({ customerId: app.customerId, type: 'refund', amount: app.held, note: app.code });
  }
  adminStore.log(req.admin.username, 'Từ chối hồ sơ', app.code);
  accountStore.onApplicationReviewed(app);
  res.json({ data: applicationView(app) });
});

/* ============================ Khách hàng ============================ */

router.get('/customers', requireAdmin('customers'), (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const status = req.query.status;
  let list = userStore.list().map(customerView);
  if (q) {
    const digits = q.replace(/\D/g, '');
    list = list.filter(
      (c) =>
        c.businessName?.toLowerCase().includes(q) ||
        (digits && (c.taxCode?.includes(digits) || c.phone?.includes(digits))),
    );
  }
  if (status && status !== 'all') list = list.filter((c) => c.status === status);
  list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ data: list });
});

router.patch('/customers/:id/status', requireAdmin('customers'), (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'locked'].includes(status)) throw badRequest('Trạng thái không hợp lệ');
  const user = userStore.findById(req.params.id);
  if (!user) throw notFound('Khách hàng không tồn tại');
  userStore.update(user.id, { status });
  securityLog(status === 'locked' ? 'customer.locked' : 'customer.unlocked', req, { admin: req.admin.username, userId: user.id });
  adminStore.log(req.admin.username, status === 'locked' ? 'Khóa tài khoản' : 'Mở khóa tài khoản', user.businessName);
  res.json({ data: customerView(user) });
});

/* ============================ Giao dịch ============================ */

router.get('/transactions', requireAdmin('transactions'), (req, res) => {
  const all = adminStore.listTransactions();
  const topupsToday = all.filter((t) => t.type === 'topup' && t.status === 'success' && isToday(t.createdAt));
  const pendingApps = adminStore.listApplications().filter((a) => a.status === 'pending');
  const holding = pendingApps.reduce((s, a) => s + (a.held || 0), 0);
  const unreconciled = all.filter((t) => t.type === 'topup' && !t.reconciled).length;
  let list = all.map(transactionView);
  if (req.query.status && req.query.status !== 'all') list = list.filter((t) => t.status === req.query.status);
  res.json({
    data: list,
    meta: {
      topupToday: topupsToday.reduce((s, t) => s + t.amount, 0),
      topupTodayCount: topupsToday.length,
      holding,
      holdingAdsCount: pendingApps.filter((a) => a.type === 'ads' && a.held > 0).length,
      unreconciled,
      reconciledAt: (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
      })(),
    },
  });
});

/* ======================= Nội dung · Bảng giá ======================= */

function validatePriceItem(body, partial = false) {
  const out = {};
  if (!partial || body.serviceSlug !== undefined) {
    const svc = adminStore.listPriceItems().find((p) => p.serviceSlug === body.serviceSlug);
    const known = svc?.serviceName || SERVICE_NAMES[body.serviceSlug];
    if (!known) throw badRequest('Dịch vụ không hợp lệ', { field: 'serviceSlug' });
    out.serviceSlug = body.serviceSlug;
    out.serviceName = known;
  }
  if (!partial || body.name !== undefined) {
    if (!isNonEmptyString(body.name, 120)) throw badRequest('Vui lòng nhập tên mục giá', { field: 'name' });
    out.name = body.name.trim();
  }
  if (!partial || body.unitPrice !== undefined) {
    const n = Number(body.unitPrice);
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000_000) throw badRequest('Đơn giá không hợp lệ', { field: 'unitPrice' });
    out.unitPrice = n;
  }
  if (!partial || body.vat !== undefined) {
    if (body.vat === null || body.vat === '') out.vat = null;
    else {
      const v = Number(body.vat);
      if (![0, 5, 8, 10].includes(v)) throw badRequest('VAT chỉ nhận 0, 5, 8 hoặc 10%', { field: 'vat' });
      out.vat = v;
    }
  }
  if (!partial || body.status !== undefined) {
    if (!['draft', 'published'].includes(body.status ?? 'draft')) throw badRequest('Trạng thái không hợp lệ', { field: 'status' });
    out.status = body.status ?? 'draft';
  }
  return out;
}

const SERVICE_NAMES = {
  'quang-cao-tren-san': 'Quảng cáo trên sàn',
  'ho-so-bo-cong-thuong': 'Hồ sơ Bộ Công Thương',
  'may-ban-hang-misa': 'Máy bán hàng + 1INVOICE',
  'tang-tuong-tac-mxh': 'Tăng tương tác MXH',
  'cong-thanh-toan-pos': 'Hồ sơ cổng thanh toán POS',
  'tai-khoan-unipay': 'Tài khoản UniPay',
  'lam-app-web-theo-yeu-cau': 'Làm app/web theo yêu cầu',
  'key-ban-quyen': 'Key phần mềm bản quyền',
};

router.get('/price-items', requireAdmin('content'), (_req, res) => {
  res.json({ data: adminStore.listPriceItems(), meta: { services: SERVICE_NAMES } });
});

router.post('/price-items', requireAdmin('content'), (req, res) => {
  const item = adminStore.addPriceItem(validatePriceItem(req.body || {}));
  adminStore.log(req.admin.username, item.status === 'published' ? 'Xuất bản bảng giá' : 'Thêm mục giá', item.name);
  res.status(201).json({ data: item });
});

router.patch('/price-items/:id', requireAdmin('content'), (req, res) => {
  const existing = adminStore.findPriceItem(req.params.id);
  if (!existing) throw notFound('Mục giá không tồn tại');
  const patch = validatePriceItem(req.body || {}, true);
  const wasPublished = existing.status === 'published';
  const item = adminStore.updatePriceItem(existing.id, patch);
  const action =
    patch.status === 'published' && !wasPublished ? 'Xuất bản bảng giá' : patch.status === 'draft' && wasPublished ? 'Gỡ xuất bản bảng giá' : 'Cập nhật bảng giá';
  adminStore.log(req.admin.username, action, item.name);
  res.json({ data: item });
});

router.delete('/price-items/:id', requireAdmin('content'), (req, res) => {
  const existing = adminStore.findPriceItem(req.params.id);
  if (!existing) throw notFound('Mục giá không tồn tại');
  adminStore.removePriceItem(existing.id);
  adminStore.log(req.admin.username, 'Xóa mục giá', existing.name);
  res.json({ data: { ok: true } });
});

/* ===================== Phí Máy bán hàng + 1INVOICE và hồ sơ POS ===================== */

router.get('/fees', requireAdmin('content'), (_req, res) => {
  res.json({ data: feeSettingsView() });
});

router.patch('/fees', requireAdmin('content'), (req, res) => {
  let changes;
  try {
    changes = applyFeeSettings(req.body || {});
  } catch (err) {
    throw badRequest(err.message, err.field ? { field: err.field } : undefined);
  }
  adminStore.log(req.admin.username, 'Cập nhật phí 1INVOICE & POS', changes.join('; ').slice(0, 300));
  res.json({ data: feeSettingsView() });
});

/* ===================== Giá dịch vụ tăng tương tác (hotrodvfb) ===================== */

const smmAdminView = (s) => ({
  id: s.id,
  platform: s.platform,
  category: s.category,
  name: s.name,
  type: s.type,
  min: s.min,
  max: s.max,
  refill: s.refill,
  providerRate: s.providerRate,
  costPer1000: s.costPer1000,
  defaultPrice: s.defaultPrice,
  customPrice: s.customPrice,
  pricePer1000: s.pricePer1000,
  disabled: s.disabled,
});

async function smmAdminCatalog(fresh) {
  if (!smmEnabled()) throw notFound('Chưa cấu hình HOTRODVFB_API_KEY');
  try {
    return await getSmmCatalog({ fresh });
  } catch (err) {
    throw new HttpError(503, `Không tải được danh mục hotrodvfb: ${err.message}`);
  }
}

router.get('/smm', requireAdmin('content'), asyncHandler(async (req, res) => {
  if (!smmEnabled()) return res.json({ data: { enabled: false } });
  const [catalog, balance] = await Promise.all([
    smmAdminCatalog(req.query.fresh === '1'),
    smmProvider.balance().catch(() => null),
  ]);
  res.json({
    data: {
      enabled: true,
      markupPercent: smmMarkup(),
      defaultMarkupPercent: config.smm.markupPercent,
      vndRate: catalog.vndRate,
      balance: balance && { usd: balance.balance, vnd: balance.balance !== null ? Math.floor(balance.balance * (balance.rate || catalog.vndRate)) : null },
      loadedAt: new Date(catalog.at).toISOString(),
      platforms: SMM_PLATFORMS.map(({ key, name }) => ({ key, name })),
      services: catalog.all.map(smmAdminView),
    },
  });
}));

router.patch('/smm/settings', requireAdmin('content'), (req, res) => {
  const v = req.body?.markupPercent;
  const markup = v === null ? null : Number(v);
  if (markup !== null && !(Number.isFinite(markup) && markup >= 0 && markup <= 1000)) {
    throw badRequest('% lãi từ 0 đến 1000', { field: 'markupPercent' });
  }
  adminStore.db.smmSettings.markupPercent = markup === null ? null : Math.round(markup * 100) / 100;
  adminStore.log(req.admin.username, 'Cập nhật % lãi dịch vụ MXH', `${smmMarkup()}%`);
  res.json({ data: { markupPercent: smmMarkup() } });
});

router.patch('/smm/services/:id', requireAdmin('content'), asyncHandler(async (req, res) => {
  const catalog = await smmAdminCatalog(false);
  const id = Number(req.params.id);
  const svc = catalog.all.find((s) => s.id === id);
  if (!svc) throw notFound('Dịch vụ không tồn tại');
  const body = req.body || {};
  const overrides = adminStore.db.smmSettings.overrides;
  const ov = { ...(overrides[id] || {}) };
  const changes = [];
  if ('price' in body) {
    if (body.price === null || body.price === '') {
      delete ov.price;
      changes.push('giá mặc định');
    } else {
      const price = Number(body.price);
      if (!Number.isInteger(price) || price < 1 || price > 1_000_000_000) {
        throw badRequest('Giá phải là số nguyên dương (VND cho 1.000)', { field: 'price' });
      }
      ov.price = price;
      changes.push(`giá ${price.toLocaleString('de-DE')} đ/1000`);
    }
  }
  if ('disabled' in body) {
    if (typeof body.disabled !== 'boolean') throw badRequest('Trạng thái không hợp lệ', { field: 'disabled' });
    if (body.disabled) ov.disabled = true;
    else delete ov.disabled;
    changes.push(body.disabled ? 'ẩn' : 'hiện');
  }
  if (!changes.length) throw badRequest('Không có thay đổi');
  if (Object.keys(ov).length) overrides[id] = ov;
  else delete overrides[id];
  adminStore.log(req.admin.username, 'Cập nhật giá dịch vụ MXH', `#${id} ${svc.name}: ${changes.join(', ')}`.slice(0, 300));
  const updated = (await getSmmCatalog()).all.find((s) => s.id === id);
  res.json({ data: smmAdminView(updated) });
}));

/* ===================== Key phần mềm bản quyền ===================== */

function licenseView(p) {
  return { ...p, ...licenseStore.stock(p.id) };
}

function validateLicenseProduct(body, partial = false) {
  const out = {};
  if (!partial || body.name !== undefined) {
    if (!isNonEmptyString(body.name, 120)) throw badRequest('Vui lòng nhập tên sản phẩm (tối đa 120 ký tự)', { field: 'name' });
    out.name = body.name.trim();
  }
  if (!partial || body.category !== undefined) {
    out.category = typeof body.category === 'string' ? body.category.trim().slice(0, 60) : '';
  }
  if (!partial || body.description !== undefined) {
    out.description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
  }
  if (!partial || body.price !== undefined) {
    const n = Number(body.price);
    if (!Number.isInteger(n) || n < 1000 || n > 1_000_000_000) throw badRequest('Giá bán từ 1.000 đ, số nguyên', { field: 'price' });
    out.price = n;
  }
  if (!partial || body.status !== undefined) {
    const st = body.status ?? 'active';
    if (!['active', 'hidden'].includes(st)) throw badRequest('Trạng thái không hợp lệ', { field: 'status' });
    out.status = st;
  }
  return out;
}

const findLicense = (id) => {
  const p = licenseStore.findProduct(id);
  if (!p) throw notFound('Sản phẩm không tồn tại');
  return p;
};

router.get('/licenses', requireAdmin('content'), (_req, res) => {
  res.json({ data: licenseStore.listProducts().map(licenseView) });
});

router.post('/licenses', requireAdmin('content'), (req, res) => {
  const fields = validateLicenseProduct(req.body || {});
  if (licenseStore.listProducts().some((p) => p.name.toLowerCase() === fields.name.toLowerCase())) throw conflict('Đã có sản phẩm cùng tên');
  const p = licenseStore.createProduct(fields);
  adminStore.log(req.admin.username, 'Thêm sản phẩm key', p.name);
  res.status(201).json({ data: licenseView(p) });
});

router.patch('/licenses/:id', requireAdmin('content'), (req, res) => {
  const p = findLicense(req.params.id);
  const patch = validateLicenseProduct(req.body || {}, true);
  if (patch.name && licenseStore.listProducts().some((x) => x.id !== p.id && x.name.toLowerCase() === patch.name.toLowerCase())) {
    throw conflict('Đã có sản phẩm cùng tên');
  }
  licenseStore.updateProduct(p.id, patch);
  adminStore.log(req.admin.username, 'Cập nhật sản phẩm key', p.name);
  res.json({ data: licenseView(p) });
});

router.delete('/licenses/:id', requireAdmin('content'), (req, res) => {
  const p = findLicense(req.params.id);
  if (licenseStore.stock(p.id).sold > 0) throw conflict('Sản phẩm đã có key được bán, hãy chuyển sang Ẩn thay vì xóa');
  licenseStore.removeProduct(p.id);
  adminStore.log(req.admin.username, 'Xóa sản phẩm key', p.name);
  res.json({ data: { ok: true } });
});

router.get('/licenses/:id/keys', requireAdmin('content'), (req, res) => {
  const p = findLicense(req.params.id);
  const list = [...licenseStore.listKeys(p.id)]
    .sort((a, b) => (a.status === b.status ? (b.soldAt || b.addedAt).localeCompare(a.soldAt || a.addedAt) : a.status === 'available' ? -1 : 1))
    .map((k) => {
      const c = k.customerId ? userStore.findById(k.customerId) : null;
      return { id: k.id, key: k.key, status: k.status, addedAt: k.addedAt, soldAt: k.soldAt, applicationCode: k.applicationCode, customer: c?.businessName || null };
    });
  res.json({ data: list, meta: { product: licenseView(p) } });
});

router.post('/licenses/:id/keys', requireAdmin('content'), (req, res) => {
  const p = findLicense(req.params.id);
  const text = req.body?.keys;
  if (typeof text !== 'string' || !text.trim()) throw badRequest('Vui lòng dán key, mỗi dòng một key', { field: 'keys' });
  if (text.length > 500_000) throw badRequest('Mỗi lần nhập tối đa 500.000 ký tự', { field: 'keys' });
  const r = licenseStore.addKeys(p.id, text);
  if (r.added) adminStore.log(req.admin.username, 'Nhập key bản quyền', `${p.name}: +${r.added} key`);
  res.status(201).json({ data: { ...r, product: licenseView(p) } });
});

router.delete('/licenses/:id/keys/:keyId', requireAdmin('content'), (req, res) => {
  const p = findLicense(req.params.id);
  const r = licenseStore.removeKey(p.id, req.params.keyId);
  if (r === 'missing') throw notFound('Key không tồn tại');
  if (r === 'sold') throw conflict('Key đã bán cho khách, không thể xóa');
  adminStore.log(req.admin.username, 'Xóa key bản quyền', p.name);
  res.json({ data: { ok: true, product: licenseView(p) } });
});

/* ============================ Phân quyền ============================ */

router.get('/roles', requireAdmin('roles'), (_req, res) => {
  res.json({ data: adminStore.listRoles(), meta: { permissions: PERMISSIONS } });
});

function validatePermissions(list) {
  const keys = PERMISSIONS.map((p) => p.key);
  if (!Array.isArray(list) || !list.every((k) => keys.includes(k))) throw badRequest('Danh sách quyền không hợp lệ');
  return [...new Set(list)];
}

router.post('/roles', requireAdmin('roles'), (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!isNonEmptyString(name, 60)) throw badRequest('Vui lòng nhập tên vai trò', { field: 'name' });
  if (adminStore.listRoles().some((r) => r.name.toLowerCase() === name.toLowerCase())) throw conflict('Vai trò đã tồn tại');
  const role = adminStore.createRole(name, validatePermissions(req.body?.permissions || []));
  adminStore.log(req.admin.username, 'Thêm vai trò', role.name);
  res.status(201).json({ data: role });
});

router.patch('/roles/:id', requireAdmin('roles'), (req, res) => {
  const role = adminStore.findRole(req.params.id);
  if (!role) throw notFound('Vai trò không tồn tại');
  if (role.locked) throw new HttpError(403, 'Không thể sửa quyền của Super Admin');
  const permissions = validatePermissions(req.body?.permissions);
  adminStore.updateRole(role.id, { permissions });
  adminStore.log(req.admin.username, 'Cập nhật phân quyền', role.name);
  res.json({ data: role });
});

router.delete('/roles/:id', requireAdmin('roles'), (req, res) => {
  const role = adminStore.findRole(req.params.id);
  if (!role) throw notFound('Vai trò không tồn tại');
  if (role.locked) throw new HttpError(403, 'Không thể xóa vai trò Super Admin');
  const inUse = adminStore.countAdminsInRole(role.id);
  if (inUse) throw conflict(`Vai trò đang được gán cho ${inUse} tài khoản, không thể xóa`);
  adminStore.removeRole(role.id);
  adminStore.log(req.admin.username, 'Xóa vai trò', role.name);
  res.json({ data: { ok: true } });
});

/* ============================ Nhật ký ============================ */

router.get('/logs', requireAdmin('roles'), (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const action = req.query.action;
  let list = [...adminStore.listLogs()].sort((a, b) => b.at.localeCompare(a.at));
  if (q) list = list.filter((l) => l.actor.toLowerCase().includes(q) || l.target.toLowerCase().includes(q));
  if (action && action !== 'all') list = list.filter((l) => l.action === action);
  const actions = [...new Set(adminStore.listLogs().map((l) => l.action))];
  res.json({ data: list.slice(0, 200), meta: { actions } });
});

export default router;
