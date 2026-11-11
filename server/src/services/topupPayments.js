import crypto from 'node:crypto';
import { config } from '../config.js';
import { adminStore } from './adminStore.js';
import { accountStore } from './accountStore.js';
import { userStore } from './userStore.js';
import { emailTopupSuccess } from './accountEmails.js';
import { saveSafely } from './persistence.js';
import { bvbankVerify, unipay, unipayEnabled, UnipayError } from './unipay.js';

/**
 * Nạp tiền tài khoản trả trước qua UniPay:
 * 1. Khách chọn số tiền + phương thức → tạo giao dịch "pending" + mã đơn (order_id) → UniPay trả QR / link thẻ.
 * 2. Khách thanh toán → UniPay gọi IPN (POST /api/payments/unipay/ipn, body mã hóa AES bằng khóa bí mật chung).
 * 3. Dự phòng IPN không tới: định kỳ tra cứu API giao dịch QR theo order_id.
 * Chỉ cộng tiền MỘT lần (giao dịch chuyển pending → success), và chỉ khi số tiền đã trả ≥ số tiền đơn.
 */

export const TOPUP_METHODS = {
  qr: { label: 'Chuyển khoản QR (UniPay)' },
  card: { label: 'Thẻ ATM / Visa / Master / JCB (UniPay)' },
};
export const SOURCE = 'unipay';
// Ngừng đối soát chủ động sau 24 giờ (IPN đến muộn vẫn được nhận)
const SYNC_WINDOW_MS = 24 * 3600_000;
// Trạng thái thất bại trong IPN / BvBank (PENDING… = khách chưa trả xong, vẫn chờ)
const FAILED_STATUSES = new Set(['FAILED', 'FAIL', 'FAILURE', 'ERROR', 'DECLINED', 'REJECTED', 'CANCELLED', 'CANCELED', 'CANCEL', 'EXPIRED', 'TIMEOUT']);
// UniPay có lúc treo request tạo link thẻ, gọi lại ngay thì được → thử lại với mã đơn mới (kinh nghiệm LGP)
const ECOM_ATTEMPT_TIMEOUTS_MS = [12_000, 15_000];

const vnd = (n) => `${Math.round(n).toLocaleString('de-DE')} đ`;

export const methodLabel = (tx) => TOPUP_METHODS[tx?.method]?.label || 'Cổng thanh toán Bảo Việt';

function newOrderId(tx) {
  // Tối đa 30 ký tự, chỉ chữ + số (an toàn cho nội dung chuyển khoản)
  return `JY${tx.id.replace(/\D/g, '')}${crypto.randomBytes(3).toString('hex').toUpperCase()}`.slice(0, 30);
}

const findByOrderId = (orderId) =>
  adminStore.listTransactions().find((t) => t.type === 'topup' && t.source === SOURCE && t.orderId === orderId) || null;

/** Thông tin thanh toán gửi cho khách (không lộ dữ liệu nội bộ). */
export function paymentView(tx) {
  return {
    id: tx.id,
    orderId: tx.orderId,
    amount: tx.amount,
    method: tx.method,
    status: tx.status,
    createdAt: tx.createdAt,
    paidAt: tx.paidAt || null,
    qrImage: tx.status === 'pending' ? tx.payment?.qrImage || null : null,
    qrContent: tx.status === 'pending' ? tx.payment?.qrContent || null : null,
    checkoutUrl: tx.status === 'pending' ? tx.payment?.checkoutUrl || null : null,
    paymentUrl: tx.status === 'pending' ? tx.payment?.paymentUrl || null : null,
    bank: tx.method === 'qr' ? { accountNo: config.unipay.bankAccountNo, bincode: config.unipay.bincode, name: 'BVBank' } : null,
  };
}

/** Tạo giao dịch nạp + yêu cầu thanh toán ở UniPay. */
export async function startTopup(user, amount, method) {
  if (!unipayEnabled()) throw new UnipayError('Chưa cấu hình UniPay', 'provider');
  const tx = adminStore.addTransaction({ customerId: user.id, type: 'topup', amount, status: 'pending' });
  Object.assign(tx, { source: SOURCE, method, orderId: newOrderId(tx), payment: {} });
  saveSafely(); // ghi đơn trước khi gọi UniPay: nếu server sập giữa chừng vẫn đối soát được
  try {
    if (method === 'card') {
      let link;
      for (let attempt = 0; attempt < ECOM_ATTEMPT_TIMEOUTS_MS.length; attempt++) {
        // Mỗi lần thử một mã mới: lần trước có thể đã tạo xong link phía UniPay dù không nhận được phản hồi
        if (attempt > 0) tx.orderId = newOrderId(tx);
        try {
          link = await unipay.createEcomLink({
            orderId: tx.orderId,
            amount,
            description: `Nap tien JIEYOU ${tx.id}`,
            returnUrl: `${config.publicUrl}/tai-khoan/nap-tien?tx=${encodeURIComponent(tx.id)}`,
            ipnUrl: `${config.publicUrl}/api/payments/unipay/ipn`,
            expiresIn: 900,
            customer: { name: user.businessName || '', email: user.email || '', phone: user.phone || '' },
            timeoutMs: ECOM_ATTEMPT_TIMEOUTS_MS[attempt],
          });
          break;
        } catch (err) {
          const retryable = err instanceof UnipayError && err.kind === 'network';
          if (!retryable || attempt === ECOM_ATTEMPT_TIMEOUTS_MS.length - 1) throw err;
          console.warn(`[UniPay] Tạo link thẻ lỗi (lần ${attempt + 1}, ${tx.orderId}), thử lại:`, err.message);
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      tx.payment = { paymentUrl: link.paymentUrl, paymentId: link.paymentId, expiresAt: link.expiresAt };
    } else {
      const qr = await unipay.createQr({ orderId: tx.orderId, amount, purpose: `Nap tien JIEYOU ${tx.id}` });
      tx.payment = qr;
    }
  } catch (err) {
    tx.status = 'failed';
    tx.note = err instanceof UnipayError ? err.message.slice(0, 200) : 'Lỗi tạo thanh toán';
    saveSafely();
    throw err;
  }
  saveSafely();
  return tx;
}

/** Cộng tiền cho giao dịch (idempotent). Trả true nếu vừa cộng. */
export function creditTopup(tx, { paidAmount, bankRef, via }) {
  if (!tx || tx.status === 'success') return false;
  const paid = Number(paidAmount);
  if (!Number.isFinite(paid) || paid < tx.amount) {
    // Chuyển thiếu: không tự cộng, để kế toán xử lý tay
    tx.note = `Số tiền nhận ${vnd(paid || 0)} khác số tiền đơn ${vnd(tx.amount)} – cần kiểm tra`;
    adminStore.log(SOURCE, 'Nạp tiền lệch số tiền', `${tx.id} (${tx.orderId})`, 'failed');
    saveSafely();
    return false;
  }
  const user = userStore.findById(tx.customerId);
  if (!user) return false;
  const balance = (user.balance || 0) + tx.amount;
  userStore.update(user.id, { balance });
  Object.assign(tx, {
    status: 'success',
    bvRef: bankRef ? String(bankRef).slice(0, 64) : tx.orderId,
    reconciled: true,
    paidAt: new Date().toISOString(),
    paidVia: via,
    note: paid > tx.amount ? `Khách chuyển dư ${vnd(paid - tx.amount)} – cần kiểm tra` : null,
  });
  if (tx.payment) delete tx.payment.qrImage; // ảnh QR không cần lưu sau khi đã thanh toán
  accountStore.notify(user.id, {
    kind: 'success',
    category: 'transaction',
    title: 'Nạp tiền thành công',
    body: `+${vnd(tx.amount)} đã vào tài khoản trả trước. Số dư mới: ${vnd(balance)}.`,
  });
  emailTopupSuccess(user.id, tx, balance);
  adminStore.log(SOURCE, 'Nạp tiền thành công', `${tx.id} · ${vnd(tx.amount)} (${via})`);
  saveSafely();
  return true;
}

/** Xử lý IPN đã giải mã. Trả { ok, message } – luôn idempotent. */
export function handleIpn(payload) {
  const orderId = String(payload.order_id || '');
  const tx = orderId ? findByOrderId(orderId) : null;
  if (!tx) {
    adminStore.log(SOURCE, 'IPN không khớp đơn nạp', orderId || '(trống)', 'failed');
    saveSafely();
    return { ok: false, message: 'order not found' };
  }
  if (tx.status === 'success') return { ok: true, message: 'already processed' };
  // IPN thẻ có trường status: chỉ cộng tiền khi SUCCESS; thất bại → đánh dấu lệnh nạp thất bại
  const status = String(payload.status || '').toUpperCase();
  if (status && status !== 'SUCCESS') {
    if (FAILED_STATUSES.has(status) && tx.status === 'pending') {
      tx.status = 'failed';
      tx.note = `UniPay báo ${status}`;
      saveSafely();
    }
    return { ok: true, message: `ignored status ${status}` };
  }
  const credited = creditTopup(tx, { paidAmount: payload.amount, bankRef: payload.retrieval_ref_no, via: 'ipn' });
  return { ok: credited, message: credited ? 'success' : 'amount mismatch' };
}

/** Đối soát chủ động các giao dịch QR đang chờ qua API tra cứu của UniPay. */
export async function reconcilePending({ only } = {}) {
  if (!unipayEnabled()) return 0;
  const now = Date.now();
  const pending = adminStore
    .listTransactions()
    .filter(
      (t) =>
        t.type === 'topup' &&
        t.source === SOURCE &&
        t.status === 'pending' &&
        now - Date.parse(t.createdAt) < SYNC_WINDOW_MS &&
        (!only || t.id === only),
    );
  if (!pending.length) return 0;
  let credited = 0;

  // Thẻ: hỏi thẳng BvBank theo payment_url (UniPay có lúc không gửi IPN cho ECOM)
  for (const tx of pending.filter((t) => t.method === 'card' && t.payment?.paymentUrl)) {
    const v = await bvbankVerify(tx.payment.paymentUrl);
    if (!v || v.orderId !== tx.orderId) continue;
    if (v.status === 'SUCCESS') {
      if (v.paymentId !== v.expectedPaymentId) continue;
      if (creditTopup(tx, { paidAmount: v.amount, bankRef: v.paymentId, via: 'bvbank' })) credited++;
    } else if (FAILED_STATUSES.has(v.status)) {
      tx.status = 'failed';
      tx.note = `BvBank báo ${v.status}`;
      saveSafely();
    }
  }

  // QR: tra cứu danh sách giao dịch QR của UniPay
  const qrPending = pending.filter((t) => t.method === 'qr');
  if (!qrPending.length) return credited;
  const oldest = Math.min(...qrPending.map((t) => Date.parse(t.createdAt)));
  const rows = await unipay.qrTransactions(new Date(oldest - 5 * 60_000), new Date(now + 5 * 60_000));
  for (const tx of qrPending) {
    const hits = rows.filter((r) => r.order_id === tx.orderId);
    if (!hits.length) continue;
    const paid = hits.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    if (creditTopup(tx, { paidAmount: paid, bankRef: hits[0].trn_ref_no, via: 'sync' })) credited++;
  }
  return credited;
}

let timer = null;
export function startTopupSync(seconds) {
  if (!unipayEnabled() || timer) return false;
  const tick = () =>
    reconcilePending().catch((err) => console.error('[UniPay] Đối soát thất bại:', err.message));
  timer = setInterval(tick, seconds * 1000);
  timer.unref();
  return true;
}
