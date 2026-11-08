import { config } from '../config.js';

/**
 * Kết nối API SMM của hotrodvfb.com (tài liệu: https://hotrodvfb.com/api-docs).
 * Mọi thao tác: POST form-urlencoded tới một endpoint, phân biệt bằng `action`, xác thực bằng `key` trong body.
 * Dùng API V2: luôn HTTP 200, lỗi nằm ở trường `error` của body.
 */

export class SmmError extends Error {
  /** `kind`: 'provider' = NCC trả lỗi rõ ràng (đơn chắc chắn KHÔNG được tạo); 'network' = không rõ kết quả. */
  constructor(message, kind, code) {
    super(message);
    this.kind = kind;
    this.code = code;
  }
}

export const smmEnabled = () => Boolean(config.smm.apiKey);

async function call(action, params = {}, { timeoutMs = 20_000 } = {}) {
  if (!smmEnabled()) throw new SmmError('Chưa cấu hình HOTRODVFB_API_KEY', 'provider');
  const body = new URLSearchParams({ key: config.smm.apiKey, action });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') body.set(k, String(v));
  let res;
  try {
    res = await fetch(config.smm.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new SmmError(`Không kết nối được hotrodvfb (${err.name === 'TimeoutError' ? 'quá thời gian' : err.message})`, 'network');
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new SmmError(`hotrodvfb trả dữ liệu không hợp lệ (HTTP ${res.status})`, 'network');
  }
  if (json && typeof json === 'object' && !Array.isArray(json) && json.error) {
    throw new SmmError(String(json.error).replace(/\*+$/, '').trim(), 'provider', Number(json.code) || res.status);
  }
  if (!res.ok) throw new SmmError(`hotrodvfb lỗi HTTP ${res.status}`, 'network');
  return json;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const smmProvider = {
  /** Danh sách dịch vụ (giá `rate` = USD / 1000 đơn vị). */
  services: () => call('services'),
  /** → { order, start_count } */
  add: (params) => call('add', params, { timeoutMs: 30_000 }),
  /**
   * Trạng thái nhiều đơn → Map(orderId → { status, charge, startCount, remains } | { error }).
   * API trả object phẳng khi chỉ có 1 mã đơn, object theo khoá khi nhiều mã.
   */
  async status(orderIds) {
    const ids = orderIds.map(String);
    const data = await call('status', { order: ids.join(',') });
    const pick = (o) =>
      o?.error
        ? { error: String(o.error).replace(/\*+$/, '').trim() }
        : { status: o?.status, charge: num(o?.charge), startCount: num(o?.start_count), remains: num(o?.remains) };
    if (ids.length === 1 && data && 'status' in data) return new Map([[ids[0], pick(data)]]);
    return new Map(ids.filter((id) => data?.[id]).map((id) => [id, pick(data[id])]));
  },
  cancel: (order) => call('cancel', { order }),
  refill: (order) => call('refill', { order }),
  /** → { balance (USD), rate (VND / 1 USD) } */
  async balance() {
    const b = await call('balance');
    return { balance: num(b.balance), rate: num(b.rate), currency: b.currency };
  },
  /** Link profile Facebook → { id, link, name } */
  getNumericUid: (link) => call('get_numeric_uid', { link }),
};
