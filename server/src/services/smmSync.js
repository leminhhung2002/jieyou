import { adminStore } from './adminStore.js';
import { accountStore } from './accountStore.js';
import { userStore } from './userStore.js';
import { smmProvider, smmEnabled } from './smmProvider.js';
import { saveSafely } from './persistence.js';

/**
 * Đồng bộ trạng thái đơn MXH đã gửi sang hotrodvfb và tự kết thúc hồ sơ:
 * - Completed → Hoàn thành (phát hành hóa đơn).
 * - Partial → Hoàn thành, hoàn tiền phần chưa chạy (`remains`).
 * - Canceled / Refunded → Từ chối, hoàn tiền phần chưa chạy (mặc định toàn bộ).
 * Các trạng thái khác (Pending, Processing, In progress, Waiting Cancel) giữ "Đang chờ".
 */

export const PROVIDER_ACTOR = 'hotrodvfb';
const STATUS_VI = {
  Pending: 'Chờ chạy',
  Processing: 'Đang xử lý',
  'In progress': 'Đang chạy',
  Completed: 'Hoàn thành',
  Partial: 'Hoàn thành một phần',
  Canceled: 'Đã huỷ',
  Refunded: 'Đã hoàn tiền',
  'Waiting Cancel': 'Đang chờ huỷ',
};
const BATCH = 100;

/** Hồ sơ MXH đang chạy tự động ở NCC (admin không duyệt tay). */
export const isProviderOrder = (app) => app?.type === 'social' && Boolean(app.meta?.provider?.order);

const vnd = (n) => `${Math.round(n).toLocaleString('de-DE')} đ`;

function refund(app, amount) {
  if (amount <= 0) return;
  const customer = userStore.findById(app.customerId);
  if (customer) userStore.update(customer.id, { balance: (customer.balance || 0) + amount });
  adminStore.addTransaction({ customerId: app.customerId, type: 'refund', amount, note: app.code });
}

/** Áp kết quả `status` của NCC vào một hồ sơ. Trả true nếu hồ sơ vừa kết thúc. */
export function applyProviderStatus(app, st) {
  const p = app.meta.provider;
  if (!st || st.error || !st.status) return false;
  p.status = st.status;
  p.remains = st.remains;
  p.startCount = st.startCount;
  p.syncedAt = new Date().toISOString();
  app.details['Trạng thái'] = STATUS_VI[st.status] || st.status;
  if (st.startCount !== null && st.startCount !== undefined) app.details['Số ban đầu'] = st.startCount.toLocaleString('de-DE');

  if (!['Completed', 'Partial', 'Canceled', 'Refunded'].includes(st.status) || app.status !== 'pending') return false;

  const amount = app.held || 0;
  const qty = app.meta.quantity || 0;
  const remains = st.status === 'Completed' ? 0 : st.remains;
  // Phần chưa chạy → hoàn tiền tương ứng. Huỷ/hoàn mà không rõ `remains` thì hoàn toàn bộ.
  let refundAmount = 0;
  if (st.status !== 'Completed') {
    refundAmount = Number.isFinite(remains) && qty > 0
      ? Math.round((amount * Math.min(Math.max(remains, 0), qty)) / qty)
      : st.status === 'Partial' ? 0 : amount;
  }
  const charged = amount - refundAmount;
  const now = new Date().toISOString();

  if (charged > 0) {
    Object.assign(app, { status: 'approved', amount: charged, reviewedBy: PROVIDER_ACTOR, reviewedAt: now });
    adminStore.addTransaction({ customerId: app.customerId, type: 'fee', amount: -charged, note: app.code });
    refund(app, refundAmount);
    if (refundAmount > 0) app.details['Hoàn tiền'] = `${vnd(refundAmount)} (${remains.toLocaleString('de-DE')} chưa chạy)`;
  } else {
    Object.assign(app, {
      status: 'rejected',
      rejectReason: `Đơn đã bị huỷ tại hệ thống cung cấp dịch vụ (${STATUS_VI[st.status]}).`,
      reviewedBy: PROVIDER_ACTOR,
      reviewedAt: now,
    });
    refund(app, refundAmount);
  }
  adminStore.log(PROVIDER_ACTOR, app.status === 'approved' ? 'Hoàn thành đơn MXH' : 'Huỷ đơn MXH', app.code);
  accountStore.onApplicationReviewed(app);
  return true;
}

let running = false;

/** Một lượt đồng bộ mọi đơn đang chạy. Trả số hồ sơ vừa kết thúc. */
export async function syncProviderOrders() {
  if (!smmEnabled() || running) return 0;
  running = true;
  let finished = 0;
  try {
    const open = adminStore.listApplications().filter((a) => isProviderOrder(a) && a.status === 'pending');
    for (let i = 0; i < open.length; i += BATCH) {
      const chunk = open.slice(i, i + BATCH);
      const result = await smmProvider.status(chunk.map((a) => a.meta.provider.order));
      for (const app of chunk) {
        // Hồ sơ có thể đã đổi trong lúc chờ NCC trả lời
        if (app.status === 'pending' && applyProviderStatus(app, result.get(String(app.meta.provider.order)))) finished += 1;
      }
    }
  } finally {
    running = false;
    saveSafely();
  }
  return finished;
}

export function startSmmSync(seconds) {
  if (!smmEnabled()) return null;
  const tick = () =>
    syncProviderOrders().catch((err) => console.error('[SMM] Đồng bộ trạng thái đơn thất bại:', err.message));
  setTimeout(tick, 5_000).unref();
  return setInterval(tick, seconds * 1000).unref();
}
