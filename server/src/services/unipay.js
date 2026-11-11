import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Kết nối UniPay Open API (tài liệu: https://docs.unipay.net.vn/technical/openapi).
 *
 * - Body mọi request POST: `{ "data": hex(IV 16 byte + AES-256-CBC/PKCS7(JSON)) }`, khóa AES là chuỗi hex 64 ký tự.
 * - Header: `Partner-Code`, `Authorization: Bearer <access_token>` (lấy qua /auth/login), `x-service-code` theo dịch vụ.
 * - Response trả JSON thường (không mã hóa). IPN UniPay gửi về cũng là `{ data }` mã hóa cùng khóa.
 */

export class UnipayError extends Error {
  /** `kind`: 'provider' = UniPay trả lỗi rõ ràng (giao dịch KHÔNG được tạo); 'network' = không rõ kết quả. */
  constructor(message, kind, status) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

const cfg = () => config.unipay;

export const unipayEnabled = () => {
  const c = cfg();
  return Boolean(c.partnerCode && c.username && c.password && c.clientId && c.clientSecret && c.aesKey && c.bankAccountNo);
};

const key = () => Buffer.from(cfg().aesKey, 'hex');

export function encrypt(plain, k = key()) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', k, iv);
  return Buffer.concat([iv, cipher.update(plain, 'utf8'), cipher.final()]).toString('hex');
}

/** Giải mã chuỗi hex `IV + ciphertext`. Ném lỗi nếu sai định dạng / sai khóa. */
export function decrypt(hex, k = key()) {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]+$/.test(hex) || hex.length < 64 || hex.length % 32 !== 0) {
    throw new Error('Dữ liệu mã hóa không hợp lệ');
  }
  const buf = Buffer.from(hex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', k, buf.subarray(0, 16));
  return Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]).toString('utf8');
}

/* ----------------------------- token ----------------------------- */

let token = null; // { value, expiresAt }
let loggingIn = null;

async function http(method, path, { body, serviceCode, auth = true, timeoutMs = 20_000 } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'Partner-Code': cfg().partnerCode };
  if (auth) headers.Authorization = `Bearer ${await accessToken()}`;
  if (serviceCode) headers['x-service-code'] = serviceCode;
  let res;
  try {
    res = await fetch(cfg().baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify({ data: encrypt(JSON.stringify(body)) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new UnipayError(`Không kết nối được UniPay (${err.name === 'TimeoutError' ? 'quá thời gian' : err.message})`, 'network');
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* để trống – xử lý bên dưới */
  }
  if (res.status === 401 && auth) {
    token = null; // token hết hạn / bị thu hồi → lần sau đăng nhập lại
    throw new UnipayError('UniPay từ chối xác thực', 'provider', 401);
  }
  if (!res.ok) {
    const msg = json?.message || json?.error || `HTTP ${res.status}`;
    // 4xx: UniPay đã từ chối yêu cầu; 5xx: không chắc kết quả
    throw new UnipayError(`UniPay: ${msg}`, res.status < 500 ? 'provider' : 'network', res.status);
  }
  if (!json || typeof json !== 'object') throw new UnipayError(`UniPay trả dữ liệu không hợp lệ (HTTP ${res.status})`, 'network', res.status);
  return json;
}

async function login() {
  const c = cfg();
  const data = await http('POST', '/openapi/v1/auth/login', {
    auth: false,
    body: { username: c.username, password: c.password, client_id: c.clientId, client_secret: c.clientSecret },
  });
  if (!data.access_token) throw new UnipayError('UniPay không trả access_token', 'provider');
  // Làm mới sớm 60 giây trước khi hết hạn
  const ttl = Math.max(60, Number(data.expires_in) || 3600) - 60;
  token = { value: data.access_token, expiresAt: Date.now() + ttl * 1000 };
  return token.value;
}

async function accessToken() {
  if (token && token.expiresAt > Date.now()) return token.value;
  loggingIn ||= login().finally(() => (loggingIn = null));
  return loggingIn;
}

/** Gọi API, tự đăng nhập lại 1 lần nếu token bị từ chối. */
async function call(method, path, opts) {
  try {
    return await http(method, path, opts);
  } catch (err) {
    if (err instanceof UnipayError && err.status === 401) return http(method, path, opts);
    throw err;
  }
}

/* ----------------------------- nghiệp vụ ----------------------------- */

/**
 * UniPay production trả payment_url bị escape HTML, có khi nhiều lớp ("&amp;amp;sign=") → mất tham số `sign`,
 * trang BvBank xoay mãi (kinh nghiệm dự án Lưu Gia Phát 10/2026). Bỏ hết các lớp escape.
 */
export function cleanPaymentUrl(url) {
  let s = String(url || '');
  for (let i = 0; i < 5 && /&(amp|#0*38|#x0*26);/i.test(s); i++) s = s.replace(/&(amp|#0*38|#x0*26);/gi, '&');
  return s;
}

/**
 * Đối soát thẻ ECOM trực tiếp với BvBank – dự phòng khi UniPay không gửi IPN (đã gặp ở production LGP 23/10/2026).
 * Chỉ gọi host cố định của BvBank; paymentId + sign lấy từ payment_url UniPay trả cho server (không phải dữ liệu khách).
 */
const BVBANK_VERIFY_HOSTS = {
  'checkout-payment.bvbank.net.vn': 'https://api-inscope-pos.bvbank.net.vn',
};
export function bvbankVerifyUrl(paymentUrl) {
  try {
    const u = new URL(cleanPaymentUrl(paymentUrl));
    const base = BVBANK_VERIFY_HOSTS[u.hostname];
    const id = u.searchParams.get('paymentId') || '';
    const sign = u.searchParams.get('sign') || '';
    if (!base || !/^[0-9A-Za-z]{6,40}$/.test(id) || !sign) return null;
    return { id, url: `${base}/v1/checkout/payments/${id}/verify?sign=${encodeURIComponent(sign)}` };
  } catch {
    return null;
  }
}

/** → { status, orderId, paymentId, amount, expectedPaymentId } hoặc null nếu không hỏi được. */
export async function bvbankVerify(paymentUrl) {
  const v = bvbankVerifyUrl(paymentUrl);
  if (!v) return null;
  try {
    const res = await fetch(v.url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const d = (await res.json().catch(() => null))?.data;
    if (!d) return null;
    return {
      status: String(d.status || '').toUpperCase(),
      orderId: String(d.order_id ?? ''),
      paymentId: String(d.payment_id ?? ''),
      amount: Number(d.amount),
      expectedPaymentId: v.id,
    };
  } catch {
    return null;
  }
}

const fmtDate = (d) => {
  // 'YYYY-MM-DD HH:mm:ss' theo giờ Việt Nam
  const vn = new Date(d.getTime() + 7 * 3600_000);
  return vn.toISOString().slice(0, 19).replace('T', ' ');
};

export const unipay = {
  /** Danh sách dịch vụ được cấp phép (kiểm tra kết nối). */
  services: () => call('GET', '/openapi/v1/services?limit=50&page=1'),

  /** Tạo QR động (VietQR) cho đơn. `orderId` tối đa 30 ký tự. */
  async createQr({ orderId, amount, purpose }) {
    const c = cfg();
    const data = await call('POST', '/openapi/v1/transaction/qr/generate', {
      serviceCode: c.qrServiceCode,
      body: {
        req_id: `${orderId}-${crypto.randomBytes(3).toString('hex')}`,
        order_id: orderId,
        amount,
        va: c.bankAccountNo,
        bincode: c.bincode,
        ...(purpose ? { purpose: purpose.slice(0, 100) } : {}),
      },
    });
    if (!data.qr_content) throw new UnipayError('UniPay không trả mã QR', 'provider');
    return { qrContent: data.qr_content, qrImage: data.image_png_base64 || null, checkoutUrl: data.checkout_url || null };
  },

  /** Tạo link thanh toán thẻ ECOM (VISA / Master / JCB / ATM). */
  async createEcomLink({ orderId, amount, description, returnUrl, ipnUrl, expiresIn = 900, customer, timeoutMs }) {
    const data = await call('POST', '/openapi/v1/ecom/payments/link', {
      serviceCode: cfg().ecomServiceCode,
      timeoutMs,
      body: {
        order_id: orderId,
        amount,
        currency: 'VND',
        description,
        return_url: returnUrl,
        ipn_url: ipnUrl,
        expires_in: expiresIn,
        ...(customer && (customer.name || customer.email || customer.phone) ? { customer } : {}),
      },
    });
    if (!data.payment_url) throw new UnipayError('UniPay không trả link thanh toán', 'provider');
    return { paymentUrl: cleanPaymentUrl(data.payment_url), paymentId: data.payment_id || null, expiresAt: data.expires_at || null };
  },

  cancelEcomLink: (orderId, reason) =>
    call('POST', '/openapi/v1/ecom/payments/cancel', {
      serviceCode: cfg().ecomServiceCode,
      body: { order_id: orderId, ...(reason ? { cancellation_reason: reason } : {}) },
    }),

  /** Các giao dịch QR thành công trong khoảng thời gian (đọc hết các trang). */
  async qrTransactions(from, to) {
    const out = [];
    for (let page = 1; page <= 20; page++) {
      const res = await call('POST', '/openapi/v1/transaction/qr', {
        serviceCode: cfg().qrServiceCode,
        body: { from_date: fmtDate(from), to_date: fmtDate(to), limit: 100, page },
      });
      out.push(...(Array.isArray(res.data) ? res.data : []));
      if (page >= (res.pagination?.total_pages || 0)) break;
    }
    return out;
  },

  /** Giải mã body IPN `{ data }` → object. Ném lỗi nếu không giải mã được. */
  parseIpn(body) {
    const json = JSON.parse(decrypt(body?.data));
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('IPN không phải object');
    return json;
  },

  /** Chỉ dùng cho test. */
  _resetToken() {
    token = null;
  },
};
