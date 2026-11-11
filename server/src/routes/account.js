import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { credentialVersion } from '../utils/jwt.js';
import { securityLog } from '../utils/securityLog.js';
import { adminStore, SERVICE_TYPES } from '../services/adminStore.js';
import { accountStore, priceOf } from '../services/accountStore.js';
import { misaDevicePrice, posFee, vatRates } from '../services/feeSettings.js';
import { userStore } from '../services/userStore.js';
import { emailTopupSuccess } from '../services/accountEmails.js';
import { unipayEnabled, UnipayError } from '../services/unipay.js';
import { methodLabel, paymentView, reconcilePending, startTopup, TOPUP_METHODS } from '../services/topupPayments.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import { isEmail, isNonEmptyString, isTaxCode, normalizePhone } from '../utils/validators.js';
import { badRequest, conflict, notFound, HttpError } from '../utils/httpError.js';
import { smmEnabled, smmProvider, SmmError } from '../services/smmProvider.js';
import { getSmmCatalog, publicService, smmAmount, splitLines, SMM_PLATFORMS, SMM_TYPES } from '../services/smmCatalog.js';
import { licenseStore, LICENSE_MAX_PER_ORDER } from '../services/licenseStore.js';
import {
  AD_SLOTS,
  BCT_KINDS,
  FLAT_FEES,
  MISA_DEVICES,
  MISA_MAX_QTY,
  POS_BUSINESS_TYPES,
  SOCIAL_KINDS,
  SOCIAL_PLATFORMS,
  TOPUP_LIMITS,
  UNIPAY_INVOICE_PLAN,
  UNIPAY_MODELS,
  VAT_RATES,
  WEBAPP_BUDGETS,
  WEBAPP_DEADLINES,
  WEBAPP_KINDS,
} from '../data/accountCatalog.js';

/**
 * Web người dùng – /api/account/* (yêu cầu đăng nhập khách hàng).
 * Hồ sơ/giao dịch ghi vào kho chung với admin → hiện ngay ở màn Duyệt hồ sơ / Giao dịch.
 */
const router = Router();
router.use(requireAuth);

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

// Chống dò mật khẩu hiện tại bằng token đã đánh cắp (OWASP A07)
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 10 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  message: { error: { message: 'Quá nhiều lần thử, vui lòng thử lại sau' } },
});

// Không nhận các khóa có thể gây ô nhiễm prototype (OWASP A08)
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const DAY = 24 * 3600_000;

/* ----------------------------- tiện ích ----------------------------- */

const monthOf = (iso) => iso.slice(0, 7); // 'YYYY-MM'
const localYmd = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const currentMonth = () => localYmd().slice(0, 7);
const prevMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return localYmd(d).slice(0, 7);
};
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
const str = (v, max = 255) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const vnd = (n) => `${Math.round(n).toLocaleString('de-DE')} đ`;

const userApps = (userId) =>
  adminStore
    .listApplications()
    .filter((a) => a.customerId === userId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

/** Tiền đang tạm giữ = quảng cáo chờ duyệt (các dịch vụ khác trừ thẳng khi gửi, hoàn nếu bị từ chối). */
const isHolding = (app) => app?.type === 'ads' && app.status === 'pending';

function applicationView(app) {
  return {
    code: app.code,
    type: app.type,
    service: SERVICE_TYPES[app.type]?.name || app.type,
    title: app.title || app.code,
    status: app.status,
    amount: app.amount ?? app.held ?? 0,
    submittedAt: app.submittedAt,
    reviewedAt: app.reviewedAt || null,
    rejectReason: app.rejectReason || null,
    reviewNote: app.reviewNote || null,
    details: app.details,
    // Key bản quyền đã giao (chỉ chủ đơn xem được – các route đã lọc theo khách)
    ...(app.type === 'license' ? { keys: app.meta?.keys || [] } : {}),
  };
}

/** Giao dịch theo góc nhìn khách: nạp / tạm giữ / đã trừ / hoàn, kèm số dư sau giao dịch. */
function userTransactions(user) {
  const apps = new Map(userApps(user.id).map((a) => [a.code, a]));
  const list = adminStore
    .listTransactions()
    .filter((t) => t.customerId === user.id && t.status === 'success' && t.type !== 'fee')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  let running = user.balance || 0;
  return list.map((t) => {
    const app = t.note ? apps.get(t.note) : null;
    let kind = t.type;
    if (t.type === 'hold') kind = isHolding(app) ? 'held' : 'charged';
    let description = t.source === 'unipay' ? `Nạp tiền qua ${methodLabel(t)}` : 'Nạp tiền qua Bảo Việt';
    if (app) description = `${app.title || app.code}${t.type === 'refund' ? ' (từ chối)' : ''}`;
    else if (t.type !== 'topup') description = t.note || 'Giao dịch';
    const row = { id: t.id, createdAt: t.createdAt, description, kind, amount: t.amount, balanceAfter: running, applicationCode: app?.code || null };
    running -= t.amount;
    return row;
  });
}

function stats(user) {
  const apps = userApps(user.id);
  const txs = userTransactions(user);
  const holdingApps = apps.filter(isHolding);
  const spentIn = (m) =>
    txs.filter((t) => monthOf(t.createdAt) === m && t.kind === 'charged').reduce((s, t) => s - t.amount, 0) -
    txs.filter((t) => monthOf(t.createdAt) === m && t.kind === 'refund').reduce((s, t) => s + t.amount, 0);
  const spentThisMonth = Math.max(0, spentIn(currentMonth()));
  const spentLastMonth = Math.max(0, spentIn(prevMonth()));
  const topups = txs.filter((t) => t.kind === 'topup' && monthOf(t.createdAt) === currentMonth());
  const today = localYmd();
  return {
    balance: user.balance || 0,
    held: holdingApps.reduce((s, a) => s + (a.held || 0), 0),
    heldCount: holdingApps.length,
    spentThisMonth,
    spentChangePct: spentLastMonth > 0 ? Math.round(((spentThisMonth - spentLastMonth) / spentLastMonth) * 100) : null,
    topupThisMonth: topups.reduce((s, t) => s + t.amount, 0),
    topupCount: topups.length,
    pendingCount: apps.filter((a) => a.status === 'pending').length,
    runningAds: apps.filter((a) => a.type === 'ads' && a.status === 'approved' && a.meta?.from <= today && today <= a.meta?.to).length,
  };
}

function nextCode(prefix) {
  const d = new Date();
  const yymm = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const head = `${prefix}-${yymm}-`;
  const max = adminStore
    .listApplications()
    .filter((a) => a.code.startsWith(head))
    .reduce((m, a) => Math.max(m, Number(a.code.slice(head.length)) || 0), 0);
  return `${head}${String(max + 1).padStart(4, '0')}`;
}

function catalog() {
  return {
    adSlots: AD_SLOTS.map(({ key, name, note, priceName, defaultPrice }) => ({
      key, name, note, price: priceOf(priceName, defaultPrice, 'quang-cao-tren-san'),
    })),
    // Giá máy, VAT, phí POS: chỉnh ở Admin › Phí MISA & POS (services/feeSettings.js)
    misaDevices: MISA_DEVICES.map((d) => ({ key: d.key, name: d.name, price: misaDevicePrice(d) })),
    misaMaxQty: MISA_MAX_QTY,
    vatRates: vatRates(),
    unipayModels: UNIPAY_MODELS,
    unipayInvoicePlan: {
      name: UNIPAY_INVOICE_PLAN.name,
      price: priceOf(UNIPAY_INVOICE_PLAN.priceName, UNIPAY_INVOICE_PLAN.defaultPrice, UNIPAY_INVOICE_PLAN.serviceSlug),
      maxQty: UNIPAY_INVOICE_PLAN.maxQty,
    },
    socialPlatforms: SOCIAL_PLATFORMS,
    socialKinds: SOCIAL_KINDS.map(({ key, name, defaultPrice }) => ({ key, name, price: defaultPrice })),
    fees: Object.fromEntries(
      Object.entries(FLAT_FEES).map(([k, f]) => [k, k === 'pos' ? posFee() : priceOf(f.priceName, f.defaultPrice, f.serviceSlug)]),
    ),
    posBusinessTypes: POS_BUSINESS_TYPES,
    bctKinds: BCT_KINDS,
    topupLimits: TOPUP_LIMITS,
    webapp: { kinds: WEBAPP_KINDS, budgets: WEBAPP_BUDGETS, deadlines: WEBAPP_DEADLINES },
    licenseMaxPerOrder: LICENSE_MAX_PER_ORDER,
    // Đơn MXH tự động qua hotrodvfb (danh mục: GET /account/social/services)
    smm: { enabled: smmEnabled() },
  };
}

/* --------------------- kiểm tra & tính phí từng dịch vụ --------------------- */

const need = (cond, message, field) => {
  if (!cond) throw badRequest(message, { field });
};
const requireEmail = (v, field = 'email') => {
  need(isEmail(v), 'Email không hợp lệ', field);
  return v.trim().toLowerCase();
};
const requirePhoneField = (v, field = 'phone') => {
  const p = normalizePhone(v);
  need(p, 'Số điện thoại không hợp lệ', field);
  return p;
};
const requireText = (v, label, field, max = 200) => {
  need(isNonEmptyString(v, max), `Vui lòng nhập ${label}`, field);
  return v.trim();
};
const fileList = (v) =>
  (Array.isArray(v) ? v : [])
    .slice(0, 10)
    .map((f) => ({ name: str(f?.name, 200), size: Math.max(0, Number(f?.size) || 0) }))
    .filter((f) => f.name);

/** Mỗi hàm trả { amount, title, details (hiển thị cho admin), meta } */
const SERVICES = {
  ads(body) {
    const c = catalog();
    const slot = c.adSlots.find((s) => s.key === body.slot);
    need(slot, 'Vui lòng chọn vị trí banner', 'slot');
    need(isYmd(body.from), 'Ngày bắt đầu không hợp lệ', 'from');
    need(isYmd(body.to), 'Ngày kết thúc không hợp lệ', 'to');
    need(body.from >= localYmd(), 'Ngày bắt đầu không được ở quá khứ', 'from');
    need(body.to >= body.from, 'Ngày kết thúc phải sau ngày bắt đầu', 'to');
    const days = daysBetween(body.from, body.to);
    need(days <= 60, 'Mỗi lần đặt tối đa 60 ngày', 'to');
    const image = fileList([body.image])[0];
    need(image, 'Vui lòng chọn hình ảnh banner', 'image');
    const clash = adminStore
      .listApplications()
      .find((a) => a.type === 'ads' && ['pending', 'approved'].includes(a.status) && a.meta?.slot === slot.key &&
        a.meta.from <= body.to && body.from <= a.meta.to);
    if (clash) throw conflict('Vị trí này đã có người đặt trong khoảng ngày đã chọn');
    const fmt = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
    return {
      amount: slot.price * days,
      title: (code) => `Quảng cáo ${code}`,
      details: { 'Vị trí': slot.name, 'Ngày chạy': `${fmt(body.from)} đến ${fmt(body.to)}`, 'Số ngày': String(days), 'Hình ảnh': image.name },
      meta: { slot: slot.key, from: body.from, to: body.to, image },
    };
  },
  unipay(body) {
    const c = catalog();
    const model = UNIPAY_MODELS.find((m) => m.key === (body.model ?? 'starter'));
    need(model, 'Vui lòng chọn mô hình kinh doanh', 'model');
    const plan = c.unipayInvoicePlan;
    const invoiceQty = body.invoiceQty === undefined ? 0 : Number(body.invoiceQty);
    need(Number.isInteger(invoiceQty) && invoiceQty >= 0 && invoiceQty <= plan.maxQty, `Số gói hóa đơn từ 0 đến ${plan.maxQty}`, 'invoiceQty');
    const d = {
      repName: requireText(body.repName, 'họ tên người đại diện', 'repName', 120),
      phone: requirePhoneField(body.phone),
      email: requireEmail(body.email),
      position: requireText(body.position, 'chức vụ', 'position', 80),
      businessName: requireText(body.businessName, 'tên doanh nghiệp', 'businessName'),
      taxCode: (need(isTaxCode(body.taxCode), 'Mã số thuế gồm 10 hoặc 13 chữ số', 'taxCode'), String(body.taxCode).trim()),
      address: requireText(body.address, 'địa chỉ kinh doanh', 'address'),
    };
    const invoiceAmount = plan.price * invoiceQty;
    return {
      amount: c.fees.unipay + invoiceAmount,
      title: (code) => `Hồ sơ ${code}`,
      details: {
        'Mô hình kinh doanh': model.name,
        ...(invoiceQty > 0 ? { 'Gói hóa đơn': `${plan.name} × ${invoiceQty}` } : {}),
        'Người đại diện': `${d.repName} · ${d.position}`,
        'Doanh nghiệp': d.businessName,
        'MST': d.taxCode,
        'Liên hệ': `${d.phone} · ${d.email}`,
      },
      meta: { ...d, model: model.key, invoiceQty, invoicePlanPrice: plan.price, serviceFee: c.fees.unipay },
    };
  },
  bct(body) {
    need(BCT_KINDS.includes(body.kind), 'Vui lòng chọn loại hồ sơ', 'kind');
    const d = {
      kind: body.kind,
      businessName: requireText(body.businessName, 'tên doanh nghiệp', 'businessName'),
      taxCode: (need(isTaxCode(body.taxCode), 'Mã số thuế gồm 10 hoặc 13 chữ số', 'taxCode'), String(body.taxCode).trim()),
      repName: requireText(body.repName, 'họ tên người đại diện', 'repName', 120),
      website: requireText(body.website, 'địa chỉ website hoặc gian hàng', 'website'),
      license: fileList([body.license])[0],
      idCard: fileList([body.idCard])[0],
    };
    need(d.license, 'Vui lòng tải lên Giấy chứng nhận đăng ký doanh nghiệp', 'license');
    need(d.idCard, 'Vui lòng tải lên CCCD của người đại diện', 'idCard');
    return {
      amount: catalog().fees.bct,
      title: (code) => `Hồ sơ ${code}`,
      details: { 'Loại hồ sơ': d.kind, 'Website': d.website, 'Người đại diện': d.repName },
      meta: d,
    };
  },
  misa(body) {
    const c = catalog();
    // Nhiều thiết bị: items = [{ device, quantity }]; vẫn nhận dạng cũ { device, quantity } (1 thiết bị)
    const rawItems = Array.isArray(body.items) ? body.items : [{ device: body.device, quantity: body.quantity }];
    need(rawItems.length > 0 && rawItems.length <= c.misaDevices.length, 'Vui lòng chọn thiết bị', 'device');
    const items = [];
    for (const it of rawItems) {
      const device = c.misaDevices.find((x) => x.key === it?.device);
      need(device, 'Vui lòng chọn thiết bị', 'device');
      need(!items.some((x) => x.device.key === device.key), 'Thiết bị bị trùng', 'device');
      const quantity = Number(it.quantity);
      need(Number.isInteger(quantity) && quantity >= 1 && quantity <= MISA_MAX_QTY, `Số lượng từ 1 đến ${MISA_MAX_QTY}`, 'quantity');
      items.push({ device, quantity });
    }
    const address = requireText(body.address, 'địa chỉ lắp đặt', 'address');
    const einvoice = body.einvoice !== false;
    const vat = Number(body.vat);
    need(c.vatRates.includes(vat), 'Thuế VAT không hợp lệ', 'vat');
    let invoiceTaxCode = null;
    if (einvoice) {
      need(isTaxCode(body.invoiceTaxCode), 'Mã số thuế xuất hóa đơn gồm 10 hoặc 13 chữ số', 'invoiceTaxCode');
      invoiceTaxCode = String(body.invoiceTaxCode).trim();
    }
    const subtotal = items.reduce((sum, it) => sum + it.device.price * it.quantity, 0);
    const amount = subtotal + Math.round((subtotal * vat) / 100);
    const quantity = items.reduce((sum, it) => sum + it.quantity, 0);
    return {
      amount,
      title: (code) => `Máy bán hàng ${code}`,
      details: {
        'Mẫu máy': items.map((it) => `${it.device.name} × ${it.quantity}`).join('; '),
        'Số lượng': String(quantity),
        'Địa chỉ lắp đặt': address,
        'Hóa đơn MISA': einvoice ? `Có, VAT ${vat}%, MST ${invoiceTaxCode}` : 'Không',
      },
      meta: {
        items: items.map((it) => ({ device: it.device.key, quantity: it.quantity, price: it.device.price })),
        device: items[0].device.key,
        quantity,
        address,
        einvoice,
        vat,
        invoiceTaxCode,
        subtotal,
      },
    };
  },
  pos(body) {
    need(POS_BUSINESS_TYPES.includes(body.businessType), 'Vui lòng chọn loại hình kinh doanh', 'businessType');
    const d = {
      storeName: requireText(body.storeName, 'tên cửa hàng', 'storeName'),
      businessType: body.businessType,
      address: requireText(body.address, 'địa chỉ cửa hàng', 'address'),
      phone: requirePhoneField(body.phone),
      email: requireEmail(body.email),
      attachments: fileList(body.attachments),
    };
    need(d.attachments.length > 0, 'Vui lòng đính kèm giấy tờ', 'attachments');
    return {
      amount: catalog().fees.pos,
      title: (code) => `Hồ sơ ${code}`,
      details: { 'Cửa hàng': d.storeName, 'Loại hình': d.businessType, 'Địa chỉ': d.address, 'Giấy tờ': `${d.attachments.length} tệp` },
      meta: d,
    };
  },
  social(body) {
    const c = catalog();
    const platform = SOCIAL_PLATFORMS.find((p) => p.key === body.platform);
    need(platform, 'Vui lòng chọn nền tảng', 'platform');
    const kind = c.socialKinds.find((k) => k.key === body.kind);
    need(kind, 'Vui lòng chọn loại tương tác', 'kind');
    const quantity = Number(body.quantity);
    need(Number.isInteger(quantity) && quantity >= 100 && quantity <= 1_000_000, 'Số lượng từ 100 đến 1.000.000', 'quantity');
    const url = str(body.url, 500);
    let parsed = null;
    try {
      parsed = new URL(url);
    } catch {
      /* xử lý bên dưới */
    }
    need(parsed && /^https?:$/.test(parsed.protocol), 'Đường dẫn không hợp lệ', 'url');
    need(body.acceptedWarning === true, 'Vui lòng xác nhận đã đọc cảnh báo', 'acceptedWarning');
    return {
      amount: kind.price * quantity,
      title: (code) => `Tương tác ${code}`,
      details: { 'Nền tảng': platform.name, 'Loại': kind.name, 'Số lượng': quantity.toLocaleString('de-DE'), 'Đường dẫn': url },
      meta: { platform: platform.key, kind: kind.key, quantity, url },
    };
  },
  /** Yêu cầu làm app / web: miễn phí, admin xem rồi báo giá (ghi chú khi duyệt). */
  webapp(body) {
    need(WEBAPP_KINDS.includes(body.kind), 'Vui lòng chọn loại sản phẩm', 'kind');
    const projectName = requireText(body.projectName, 'tên dự án', 'projectName', 120);
    const description = str(body.description, 3000);
    need(description.length >= 20, 'Vui lòng mô tả yêu cầu (tối thiểu 20 ký tự)', 'description');
    need(WEBAPP_BUDGETS.includes(body.budget), 'Vui lòng chọn ngân sách dự kiến', 'budget');
    need(WEBAPP_DEADLINES.includes(body.deadline), 'Vui lòng chọn thời gian mong muốn', 'deadline');
    const contactName = requireText(body.contactName, 'tên người liên hệ', 'contactName', 120);
    const phone = requirePhoneField(body.phone);
    const email = requireEmail(body.email);
    const references = str(body.references, 500);
    return {
      amount: 0,
      title: (code) => `Yêu cầu ${code}`,
      details: {
        'Loại sản phẩm': body.kind,
        'Tên dự án': projectName,
        'Mô tả': description,
        'Ngân sách': body.budget,
        'Thời gian': body.deadline,
        ...(references ? { 'Tham khảo': references } : {}),
        'Liên hệ': `${contactName} · ${phone} · ${email}`,
      },
      meta: { kind: body.kind, projectName, description, budget: body.budget, deadline: body.deadline, contactName, phone, email, references },
    };
  },
  /** Mua key bản quyền: trừ số dư, giao key ngay (xem POST /applications). */
  license(body) {
    const product = licenseStore.findProduct(String(body.product || ''));
    need(product && product.status === 'active', 'Vui lòng chọn sản phẩm', 'product');
    const quantity = Number(body.quantity);
    need(
      Number.isInteger(quantity) && quantity >= 1 && quantity <= LICENSE_MAX_PER_ORDER,
      `Số lượng từ 1 đến ${LICENSE_MAX_PER_ORDER}`,
      'quantity',
    );
    const { available } = licenseStore.stock(product.id);
    if (available < quantity) {
      throw new HttpError(409, available ? `Sản phẩm chỉ còn ${available} key` : 'Sản phẩm tạm hết hàng', { field: 'quantity' });
    }
    return {
      amount: product.price * quantity,
      title: (code) => `Key bản quyền ${code}`,
      details: { 'Sản phẩm': product.name, 'Số lượng': String(quantity), 'Đơn giá': vnd(product.price) },
      meta: { productId: product.id, productName: product.name, quantity, unitPrice: product.price },
    };
  },
};
const DRAFT_TYPES = ['unipay', 'bct', 'pos'];

const parseHttpUrl = (v, max) => {
  const url = str(v, max);
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? url : null;
  } catch {
    return null;
  }
};

/** Danh mục hotrodvfb; NCC lỗi và chưa có bản lưu tạm → 503. */
async function smmCatalog() {
  try {
    return await getSmmCatalog();
  } catch (err) {
    console.error('[SMM] Không tải được danh mục:', err.message);
    throw new HttpError(503, 'Dịch vụ tăng tương tác tạm thời gián đoạn, vui lòng thử lại sau');
  }
}

/**
 * Đơn MXH tự động (hotrodvfb). Như SERVICES.* nhưng async và trả thêm `provider` = tham số action `add`.
 * Body: { service, link, quantity, reaction?, comments?, acceptedWarning }
 */
async function socialSmm(body) {
  const { services } = await smmCatalog();
  const svc = services.get(Number(body.service));
  need(svc, 'Vui lòng chọn dịch vụ', 'service');
  const type = SMM_TYPES[svc.type];
  const link = parseHttpUrl(body.link, 200);
  need(link, 'Đường dẫn không hợp lệ (tối đa 200 ký tự)', 'link');

  const provider = { service: svc.id, link };
  let lines = [];
  if (type.comments) {
    lines = splitLines(body.comments).map((l) => l.slice(0, 500));
    need(type.comments === 'optional' || lines.length > 0, 'Vui lòng nhập nội dung, mỗi dòng một nội dung', 'comments');
    need(lines.length <= 5000, 'Tối đa 5.000 dòng nội dung', 'comments');
    if (type.minLine) need(lines.every((l) => l.length >= type.minLine), `Mỗi dòng nội dung dài tối thiểu ${type.minLine} ký tự`, 'comments');
    if (lines.length) provider.comments = lines.join('\n');
  }
  const quantity = type.qtyFromLines ? lines.length : Number(body.quantity);
  need(
    Number.isInteger(quantity) && quantity >= svc.min && quantity <= svc.max,
    `${type.qtyFromLines ? 'Số dòng nội dung' : 'Số lượng'} từ ${svc.min.toLocaleString('de-DE')} đến ${svc.max.toLocaleString('de-DE')}`,
    type.qtyFromLines ? 'comments' : 'quantity',
  );
  provider.quantity = quantity;
  let reaction = null;
  if (type.reaction && svc.reactions.length) {
    reaction = body.reaction ? String(body.reaction) : svc.reactions[0];
    need(svc.reactions.includes(reaction), 'Cảm xúc không hợp lệ', 'reaction');
    provider.reaction = reaction;
  }
  need(body.acceptedWarning === true, 'Vui lòng xác nhận đã đọc cảnh báo', 'acceptedWarning');

  const platform = SMM_PLATFORMS.find((p) => p.key === svc.platform);
  return {
    amount: smmAmount(svc, quantity),
    title: (code) => `Tương tác ${code}`,
    details: {
      'Nền tảng': platform.name,
      'Dịch vụ': svc.name,
      'Số lượng': quantity.toLocaleString('de-DE'),
      ...(reaction ? { 'Cảm xúc': reaction } : {}),
      'Đường dẫn': link,
    },
    meta: { platform: svc.platform, service: svc.id, serviceType: svc.type, quantity, url: link, reaction },
    provider,
  };
}

/**
 * Gửi đơn sang hotrodvfb SAU khi đã trừ tiền (trừ trước, đồng bộ, để hai request song song không tiêu lố số dư).
 * - NCC từ chối rõ ràng → huỷ hồ sơ, trả lại tiền, báo lỗi cho khách.
 * - Lỗi mạng / quá thời gian → không rõ đơn đã tạo chưa: giữ hồ sơ "chờ duyệt" để admin kiểm tra và duyệt tay.
 */
async function placeProviderOrder(app, params) {
  try {
    const r = await smmProvider.add({ ...params, note: app.code });
    const order = Number(r?.order);
    if (!order) throw new SmmError('hotrodvfb không trả mã đơn', 'network');
    app.meta.provider = { name: 'hotrodvfb', order, status: 'Pending', startCount: r.start_count ?? null, placedAt: new Date().toISOString() };
    app.details['Mã đơn NCC'] = String(order);
    app.details['Trạng thái'] = 'Chờ chạy';
    return true;
  } catch (err) {
    if (!(err instanceof SmmError) || err.kind !== 'provider') {
      console.error(`[SMM] ${app.code}: không rõ kết quả tạo đơn –`, err.message);
      app.details['Lưu ý'] = 'Chưa xác nhận được đơn với hotrodvfb, cần kiểm tra và duyệt tay';
      adminStore.log('hotrodvfb', 'Lỗi gửi đơn MXH', app.code, 'failed');
      return false;
    }
    // NCC từ chối: hoàn tác – xoá hồ sơ + giao dịch tạm giữ, trả tiền
    const list = adminStore.listApplications();
    list.splice(list.indexOf(app), 1);
    const txs = adminStore.listTransactions();
    const hold = txs.findIndex((t) => t.note === app.code && t.type === 'hold');
    if (hold >= 0) txs.splice(hold, 1);
    const customer = userStore.findById(app.customerId);
    if (customer && app.held > 0) userStore.update(customer.id, { balance: (customer.balance || 0) + app.held });
    adminStore.log('hotrodvfb', 'NCC từ chối đơn MXH', `${app.code}: ${err.message}`.slice(0, 300), 'failed');
    // Lỗi về số dư / API Key của JIEYOU tại NCC không phải lỗi của khách
    if (err.code === 401 || /tiền|key/i.test(err.message)) {
      console.error(`[SMM] Tài khoản hotrodvfb: ${err.message}`);
      throw new HttpError(503, 'Dịch vụ tăng tương tác tạm thời gián đoạn, vui lòng thử lại sau');
    }
    throw badRequest(err.message, { field: 'link' });
  }
}

/* ------------------------------ routes ------------------------------ */

router.get('/summary', (req, res) => {
  const u = req.user;
  res.json({
    data: {
      user: { ...userStore.toPublic(u), hasPassword: Boolean(u.passwordHash) },
      stats: stats(u),
      recentApplications: userApps(u.id).slice(0, 5).map(applicationView),
      unreadNotifications: accountStore.listNotifications(u.id).filter((n) => !n.read).length,
    },
  });
});

router.get('/catalog', (_req, res) => res.json({ data: catalog() }));

/** Sản phẩm key bản quyền đang bán (kèm số key còn trong kho). */
router.get('/licenses', (_req, res) => {
  const products = licenseStore
    .listProducts()
    .filter((p) => p.status === 'active')
    .map((p) => ({ id: p.id, name: p.name, category: p.category || '', description: p.description || '', price: p.price, stock: licenseStore.stock(p.id).available }));
  res.json({ data: products });
});

/** Các đơn key đã mua của khách, kèm key. */
router.get('/licenses/orders', (req, res) => {
  const orders = userApps(req.user.id)
    .filter((a) => a.type === 'license' && a.status === 'approved')
    .map((a) => ({
      code: a.code,
      submittedAt: a.submittedAt,
      product: a.meta?.productName || a.details?.['Sản phẩm'] || '',
      quantity: a.meta?.quantity || a.meta?.keys?.length || 0,
      amount: a.amount || 0,
      keys: a.meta?.keys || [],
    }));
  res.json({ data: orders });
});

/** Danh mục dịch vụ tăng tương tác (giá VND cho 1.000 đơn vị). */
router.get('/social/services', asyncHandler(async (_req, res) => {
  if (!smmEnabled()) throw notFound('Chưa kết nối nhà cung cấp dịch vụ tăng tương tác');
  const { services } = await smmCatalog();
  res.json({
    data: {
      platforms: SMM_PLATFORMS.map(({ key, name }) => ({ key, name })),
      services: [...services.values()].map(publicService),
    },
  });
}));

const uidLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  message: { error: { message: 'Quá nhiều lần thử, vui lòng thử lại sau' } },
});

/** Đổi link profile Facebook sang link UID dạng số (dịch vụ profile Facebook bắt buộc). */
router.post('/social/uid', uidLimiter, asyncHandler(async (req, res) => {
  if (!smmEnabled()) throw notFound();
  const link = parseHttpUrl(req.body?.link, 300);
  if (!link) throw badRequest('Đường dẫn không hợp lệ', { field: 'link' });
  try {
    const r = await smmProvider.getNumericUid(link);
    res.json({ data: { id: String(r.id), link: String(r.link), name: String(r.name || '') } });
  } catch (err) {
    if (err instanceof SmmError && err.kind === 'provider') throw badRequest(err.message, { field: 'link' });
    throw new HttpError(503, 'Không lấy được UID, vui lòng thử lại sau');
  }
}));

router.get('/transactions', (req, res) => {
  const all = userTransactions(req.user);
  const months = [...new Set(all.map((t) => monthOf(t.createdAt)))];
  if (!months.includes(currentMonth())) months.unshift(currentMonth());
  let items = all;
  if (req.query.kind && req.query.kind !== 'all') items = items.filter((t) => t.kind === req.query.kind);
  if (req.query.month && req.query.month !== 'all') items = items.filter((t) => monthOf(t.createdAt) === req.query.month);
  res.json({ data: items, meta: { months: months.sort().reverse(), stats: stats(req.user) } });
});

/** Trạng thái lệnh nạp (trang chờ thanh toán hỏi định kỳ). Đơn QR đang chờ: tra cứu UniPay tối đa 1 lần / 10 giây. */
const lastCheck = new Map();
router.get('/topups/:id', asyncHandler(async (req, res) => {
  const tx = adminStore.listTransactions().find((t) => t.id === req.params.id && t.customerId === req.user.id && t.type === 'topup');
  if (!tx) throw notFound('Không tìm thấy giao dịch nạp');
  if (tx.status === 'pending' && tx.source === 'unipay' && unipayEnabled()) {
    const last = lastCheck.get(tx.id) || 0;
    if (Date.now() - last > 10_000) {
      lastCheck.set(tx.id, Date.now());
      if (lastCheck.size > 5000) lastCheck.clear();
      await reconcilePending({ only: tx.id }).catch((err) => console.error('[UniPay] Tra cứu thất bại:', err.message));
    }
  }
  res.json({ data: { ...paymentView(tx), balance: userStore.findById(req.user.id)?.balance || 0 } });
}));

router.post('/topups', asyncHandler(async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount < TOPUP_LIMITS.min || amount > TOPUP_LIMITS.max) {
    throw badRequest(`Số tiền nạp từ ${vnd(TOPUP_LIMITS.min)} đến ${vnd(TOPUP_LIMITS.max)}`, { field: 'amount' });
  }
  const method = req.body?.method || 'qr';

  // UniPay đã cấu hình: tạo giao dịch chờ + QR / link thẻ; chỉ cộng tiền khi UniPay báo đã thanh toán (IPN / đối soát)
  if (unipayEnabled()) {
    if (!TOPUP_METHODS[method]) throw badRequest('Phương thức thanh toán không hợp lệ', { field: 'method' });
    const open = adminStore
      .listTransactions()
      .filter((t) => t.customerId === req.user.id && t.type === 'topup' && t.status === 'pending' && Date.now() - Date.parse(t.createdAt) < DAY);
    if (open.length >= 5) throw new HttpError(429, 'Bạn có quá nhiều lệnh nạp đang chờ thanh toán, vui lòng hoàn tất hoặc thử lại sau');
    try {
      const tx = await startTopup(req.user, amount, method);
      return res.status(201).json({ data: { transaction: paymentView(tx), payment: paymentView(tx), balance: req.user.balance || 0 } });
    } catch (err) {
      if (err instanceof UnipayError) {
        console.error('[UniPay] Tạo thanh toán thất bại:', err.message);
        const hint = method === 'card' ? ' Vui lòng thử chuyển khoản QR.' : ' Vui lòng thử lại sau.';
        throw new HttpError(502, `Cổng thanh toán UniPay đang gặp sự cố.${hint}`);
      }
      throw err;
    }
  }

  if (!['qr', 'card', 'baoviet'].includes(method)) throw badRequest('Phương thức thanh toán không hợp lệ', { field: 'method' });
  // Chưa cấu hình cổng thanh toán: production từ chối; môi trường dev cộng tiền ngay để thử giao diện
  if (config.isProd) throw new HttpError(501, 'Cổng thanh toán chưa được kết nối');

  const user = req.user;
  const balance = (user.balance || 0) + amount;
  userStore.update(user.id, { balance });
  const tx = adminStore.addTransaction({
    customerId: user.id, type: 'topup', amount, status: 'success',
    bvRef: `BV${String(Date.now()).slice(-8)}`,
  });
  accountStore.notify(user.id, {
    kind: 'success', category: 'transaction', title: 'Nạp tiền thành công',
    body: `+${vnd(amount)} đã vào tài khoản trả trước. Số dư mới: ${vnd(balance)}.`,
  });
  emailTopupSuccess(user.id, tx, balance);
  res.status(201).json({ data: { transaction: tx, balance } });
}));

router.get('/applications', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  res.json({ data: userApps(req.user.id).slice(0, limit).map(applicationView) });
});

/** Chi tiết hồ sơ + mốc thời gian (Đã gửi → Duyệt → Hoàn thành / Từ chối) + tiền đã trừ / hoàn. */
router.get('/applications/:code', (req, res) => {
  const app = userApps(req.user.id).find((a) => a.code === req.params.code);
  if (!app) throw notFound('Không tìm thấy hồ sơ');
  const txs = adminStore.listTransactions().filter((t) => t.customerId === req.user.id && t.note === app.code);
  const refund = txs.find((t) => t.type === 'refund');
  const timeline = [{ key: 'submitted', label: 'Đã gửi', at: app.submittedAt, done: true }];
  if (app.status === 'pending') {
    timeline.push({ key: 'review', label: 'Duyệt', at: null, done: false, current: true });
    timeline.push({ key: 'result', label: 'Hoàn thành', at: null, done: false });
  } else {
    timeline.push({ key: 'review', label: 'Duyệt', at: app.reviewedAt, done: true });
    timeline.push(
      app.status === 'approved'
        ? { key: 'result', label: 'Hoàn thành', at: app.reviewedAt, done: true }
        : { key: 'result', label: 'Từ chối', at: app.reviewedAt, done: true, rejected: true },
    );
  }
  const amount = app.amount ?? app.held ?? 0;
  res.json({
    data: {
      ...applicationView(app),
      timeline,
      payment: {
        charged: amount,
        kind: isHolding(app) ? 'held' : 'charged',
        refund: app.status === 'rejected' && amount > 0 ? { amount: refund?.amount ?? amount, at: refund?.createdAt ?? null, done: Boolean(refund) } : null,
      },
      invoiceNo: accountStore.invoiceOf(app.code)?.no || null,
    },
  });
});

router.post('/applications', asyncHandler(async (req, res) => {
  const type = req.body?.type;
  const auto = type === 'social' && smmEnabled();
  const spec = auto ? socialSmm : SERVICES[type];
  if (!spec) throw badRequest('Loại dịch vụ không hợp lệ', { field: 'type' });
  const user = req.user;
  const { amount, title, details, meta, provider } = await spec(req.body?.details || {});
  if (amount > (user.balance || 0)) {
    throw new HttpError(402, `Số dư không đủ, cần thêm ${vnd(amount - (user.balance || 0))}. Vui lòng nạp tiền.`, { field: 'balance' });
  }

  const code = nextCode(SERVICE_TYPES[type].prefix);
  // Key bản quyền: giữ key trước khi trừ tiền (đồng bộ → hai đơn song song không nhận trùng key)
  let keys = null;
  if (type === 'license') {
    keys = licenseStore.takeKeys(meta.productId, meta.quantity, code, user.id);
    if (!keys) throw new HttpError(409, 'Sản phẩm vừa hết hàng, vui lòng giảm số lượng hoặc chọn sản phẩm khác', { field: 'quantity' });
  }
  const app = adminStore.addApplication({
    code, customerId: user.id, type, status: 'pending', submittedAt: new Date().toISOString(),
    title: title(code), details, meta: keys ? { ...meta, keys } : meta, amount, held: amount, history: [],
  });
  if (amount > 0) {
    userStore.update(user.id, { balance: (user.balance || 0) - amount });
    adminStore.addTransaction({ customerId: user.id, type: 'hold', amount: -amount, note: code });
  }
  if (DRAFT_TYPES.includes(type)) accountStore.clearDraft(user.id, type);
  if (type === 'license') {
    // Giao ngay: hoàn thành đơn, tiền đã trừ thành phí, phát hành hóa đơn, báo + email key cho khách
    Object.assign(app, { status: 'approved', reviewedBy: 'Hệ thống', reviewedAt: new Date().toISOString() });
    if (amount > 0) adminStore.addTransaction({ customerId: user.id, type: 'fee', amount: -amount, note: code });
    adminStore.log('Hệ thống', 'Giao key bản quyền', `${code}: ${meta.quantity} × ${meta.productName}`.slice(0, 300));
    accountStore.onApplicationReviewed(app);
    return res.status(201).json({ data: { application: applicationView(app), balance: userStore.findById(user.id)?.balance ?? 0 } });
  }
  const running = auto && (await placeProviderOrder(app, provider));
  let body = amount > 0 ? `${type === 'ads' ? 'Đã tạm giữ' : 'Đã trừ'} ${vnd(amount)}.` : 'Dịch vụ miễn phí.';
  if (type === 'webapp') body = 'Chúng tôi sẽ liên hệ tư vấn và báo giá trong 24 giờ làm việc.';
  accountStore.notify(user.id, {
    kind: type === 'ads' ? 'ads' : 'pending',
    category: 'application',
    title: running ? `${app.title} đang chạy` : type === 'webapp' ? `${app.title} đã được tiếp nhận` : `${app.title} đang chờ duyệt`,
    body,
  });
  res.status(201).json({ data: { application: applicationView(app), balance: userStore.findById(user.id)?.balance ?? 0 } });
}));

router.get('/drafts/:type', (req, res) => {
  if (!DRAFT_TYPES.includes(req.params.type)) throw notFound();
  res.json({ data: accountStore.getDraft(req.user.id, req.params.type) });
});

router.put('/drafts/:type', (req, res) => {
  if (!DRAFT_TYPES.includes(req.params.type)) throw notFound();
  const details = req.body?.details;
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw badRequest('Dữ liệu nháp không hợp lệ');
  // Chỉ giữ các trường chuỗi/số/boolean/tệp (tên + dung lượng), giới hạn độ dài
  const clean = {};
  for (const [k, v] of Object.entries(details).slice(0, 30)) {
    if (UNSAFE_KEYS.has(k) || k.length > 60) continue;
    if (['string', 'number', 'boolean'].includes(typeof v)) clean[k] = typeof v === 'string' ? v.slice(0, 500) : v;
    else if (Array.isArray(v)) clean[k] = fileList(v);
    else if (v && typeof v === 'object') clean[k] = fileList([v])[0] || null;
  }
  res.json({ data: accountStore.saveDraft(req.user.id, req.params.type, clean) });
});

router.get('/ads/bookings', (req, res) => {
  const slot = String(req.query.slot || '');
  const today = localYmd();
  const list = adminStore
    .listApplications()
    .filter((a) => a.type === 'ads' && ['pending', 'approved'].includes(a.status) && a.meta?.slot === slot && a.meta.to >= today)
    .map((a) => ({ from: a.meta.from, to: a.meta.to }));
  res.json({ data: list });
});

/* ------------------------------ hóa đơn ------------------------------ */

function invoiceRows(user) {
  const rows = [];
  for (const app of userApps(user.id)) {
    if (!(app.amount > 0) || app.status === 'rejected') continue;
    const inv = accountStore.invoiceOf(app.code);
    if (inv) rows.push({ no: inv.no, applicationCode: app.code, application: app.title || app.code, issuedAt: inv.issuedAt, total: inv.total, status: 'issued' });
    else if (app.status === 'pending') rows.push({ no: null, applicationCode: app.code, application: app.title || app.code, issuedAt: null, total: app.amount, status: 'pending', submittedAt: app.submittedAt });
  }
  return rows.sort((a, b) => (b.issuedAt || b.submittedAt).localeCompare(a.issuedAt || a.submittedAt));
}

router.get('/invoices', (req, res) => {
  const all = invoiceRows(req.user);
  const months = [...new Set(all.map((r) => monthOf(r.issuedAt || r.submittedAt)))].sort().reverse();
  let items = all;
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) items = items.filter((r) => r.no?.toLowerCase().includes(q) || r.application.toLowerCase().includes(q));
  if (req.query.month && req.query.month !== 'all') items = items.filter((r) => monthOf(r.issuedAt || r.submittedAt) === req.query.month);
  res.json({ data: items, meta: { months } });
});

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Bản in hóa đơn (HTML) – trình duyệt in / lưu thành PDF. */
router.get('/invoices/:no/document', (req, res) => {
  const inv = accountStore.findInvoice(req.user.id, req.params.no);
  if (!inv) throw notFound('Không tìm thấy hóa đơn');
  const app = adminStore.findApplication(inv.applicationCode);
  const u = req.user;
  const date = new Date(inv.issuedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const rows = Object.entries(app?.details || {})
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('');
  res.type('html').send(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Hóa đơn ${escapeHtml(inv.no)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;color:#0b0c0e}h1{font-size:24px;margin:0 0 4px}
p{margin:4px 0;color:#3a3d44}table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:10px 0;border-top:1px solid #e3e5e9}
td:last-child{text-align:right}.total td{font-weight:600;font-size:18px}</style></head><body>
<h1>HÓA ĐƠN ĐIỆN TỬ</h1><p>Số: <b>${escapeHtml(inv.no)}</b> · Ngày phát hành: ${escapeHtml(date)}</p>
<p>Đơn vị bán: JIEYOU – Sàn Dịch vụ Doanh nghiệp (phát hành qua MISA meInvoice)</p>
<p>Người mua: ${escapeHtml(u.businessName)} · MST ${escapeHtml(u.taxCode)}</p>
<table><tr><td>Hồ sơ</td><td>${escapeHtml(app?.title || inv.applicationCode)}</td></tr>${rows}
<tr class="total"><td>Tổng tiền</td><td>${escapeHtml(vnd(inv.total))}</td></tr></table>
<script>window.onload=()=>window.print()</script></body></html>`);
});

/* ----------------------------- thông báo ----------------------------- */

router.get('/notifications', (req, res) => {
  let list = accountStore.listNotifications(req.user.id);
  const f = req.query.filter;
  if (f === 'unread') list = list.filter((n) => !n.read);
  else if (f === 'transaction' || f === 'application') list = list.filter((n) => n.category === f);
  res.json({ data: list, meta: { unread: accountStore.listNotifications(req.user.id).filter((n) => !n.read).length } });
});

router.post('/notifications/read-all', (req, res) => {
  accountStore.markAllRead(req.user.id);
  res.json({ data: { ok: true } });
});

router.post('/notifications/:id/read', (req, res) => {
  if (!accountStore.markRead(req.user.id, req.params.id)) throw notFound('Không tìm thấy thông báo');
  res.json({ data: { ok: true } });
});

/* ------------------------------ cài đặt ------------------------------ */

router.get('/settings', (req, res) => {
  res.json({ data: { settings: accountStore.settingsOf(req.user), hasPassword: Boolean(req.user.passwordHash) } });
});

router.patch('/profile', (req, res) => {
  const { businessName, taxCode, email } = req.body || {};
  const patch = {};
  if (businessName !== undefined) patch.businessName = requireText(businessName, 'tên doanh nghiệp', 'businessName');
  if (taxCode !== undefined) {
    need(isTaxCode(taxCode), 'Mã số thuế gồm 10 hoặc 13 chữ số', 'taxCode');
    patch.taxCode = String(taxCode).replace(/[^\d-]/g, '');
  }
  if (email !== undefined) {
    patch.email = requireEmail(email);
    const other = userStore.findByEmail(patch.email);
    if (other && other.id !== req.user.id) throw conflict('Email đã được sử dụng');
  }
  const u = userStore.update(req.user.id, patch);
  res.json({ data: { ...userStore.toPublic(u), hasPassword: Boolean(u.passwordHash) } });
});

router.patch('/settings', (req, res) => {
  const cur = accountStore.settingsOf(req.user);
  const b = req.body || {};
  if (b.otpLogin !== undefined) {
    need(typeof b.otpLogin === 'boolean', 'Giá trị không hợp lệ', 'otpLogin');
    if (!b.otpLogin && !req.user.passwordHash) {
      throw badRequest('Hãy đặt mật khẩu trước khi tắt đăng nhập bằng mã OTP', { field: 'otpLogin' });
    }
    cur.otpLogin = b.otpLogin;
  }
  if (b.email && typeof b.email === 'object') {
    for (const k of ['topup', 'applications', 'invoices']) {
      if (typeof b.email[k] === 'boolean') cur.email[k] = b.email[k];
    }
  }
  userStore.update(req.user.id, { settings: cur });
  res.json({ data: { settings: cur, hasPassword: Boolean(req.user.passwordHash) } });
});

router.post(
  '/password',
  passwordLimiter,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const user = req.user;
    const current = String(currentPassword || '').slice(0, MAX_PASSWORD + 1);
    if (user.passwordHash && (current.length > MAX_PASSWORD || !(await verifyPassword(current, user.passwordHash)))) {
      securityLog('password.change.failed', req, { userId: user.id });
      throw badRequest('Mật khẩu hiện tại không đúng', { field: 'currentPassword' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD) {
      throw badRequest(`Mật khẩu mới phải có ít nhất ${MIN_PASSWORD} ký tự`, { field: 'newPassword' });
    }
    if (newPassword.length > MAX_PASSWORD) throw badRequest(`Mật khẩu tối đa ${MAX_PASSWORD} ký tự`, { field: 'newPassword' });
    // Tăng phiên bản → đăng xuất mọi thiết bị khác; trả token mới cho thiết bị hiện tại
    const u = userStore.update(user.id, { passwordHash: await hashPassword(newPassword), tokenVersion: credentialVersion(user) + 1 });
    securityLog('password.changed', req, { userId: user.id });
    res.json({ data: { ok: true, token: signToken(u) } });
  }),
);

export default router;
