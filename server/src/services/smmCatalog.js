import { config } from '../config.js';
import { smmProvider } from './smmProvider.js';

/**
 * Danh mục dịch vụ tăng tương tác lấy từ hotrodvfb, quy đổi sang VND cho khách JIEYOU.
 * Giá khách = rate (USD / 1000) × tỉ giá NCC × (1 + SMM_MARKUP_PERCENT %), làm tròn lên.
 * Lưu tạm 10 phút; NCC lỗi thì dùng bản cũ (nếu có).
 */

/** Nền tảng hiện trên web (khoá trùng icon ở client) ↔ tên `platform` của NCC. */
export const SMM_PLATFORMS = [
  { key: 'facebook', name: 'Facebook', provider: 'Facebook' },
  { key: 'tiktok', name: 'TikTok', provider: 'Tiktok' },
  { key: 'youtube', name: 'YouTube', provider: 'Youtube' },
  { key: 'instagram', name: 'Instagram', provider: 'Instagram' },
];

/**
 * Loại dịch vụ thường hỗ trợ (VIP và livestream chưa hỗ trợ: giá phụ thuộc số ngày / phút).
 * comments: 'required' | 'optional'; qtyFromLines: số lượng = số dòng nội dung; minLine: độ dài tối thiểu mỗi dòng.
 */
export const SMM_TYPES = {
  Default: {},
  'View Special': {},
  'Like Comment Tiktok': {},
  Reaction: { reaction: true },
  'Reaction Comment': { reaction: true },
  'Custom Comments': { comments: 'required', qtyFromLines: true },
  'Custom Reviews': { comments: 'required', qtyFromLines: true, minLine: 26 },
  'Custom Checkin': { comments: 'optional', minLine: 26 },
};
export const REACTIONS = ['like', 'love', 'care', 'wow', 'haha', 'sad', 'angry'];

const TTL = 10 * 60_000;
let cache = null; // { at, services: Map(id → service), vndRate }
let loading = null;

function toService(s, vndRate) {
  const platform = SMM_PLATFORMS.find((p) => p.provider === s.platform);
  const type = SMM_TYPES[s.type];
  const rate = Number(s.rate);
  const min = Number(s.min);
  const max = Number(s.max);
  if (!platform || !type || s.is_vip || !(rate > 0) || !(min > 0) || !(max >= min)) return null;
  // Giá khách cho 1000 đơn vị (VND)
  const pricePer1000 = Math.ceil(rate * vndRate * (1 + config.smm.markupPercent / 100));
  return {
    id: Number(s.service),
    platform: platform.key,
    name: String(s.name || '').slice(0, 120),
    category: String(s.category || 'Khác').slice(0, 80),
    description: String(s.description || '').slice(0, 500),
    type: s.type,
    min,
    max,
    pricePer1000,
    refill: Boolean(s.refill),
    refillDays: Number(s.refill_days) || 0,
    cancel: Boolean(s.cancel),
    reactions: type.reaction && s.data?.allow_reaction !== false
      ? (Array.isArray(s.data?.reactions) ? s.data.reactions.filter((r) => REACTIONS.includes(r)) : REACTIONS)
      : [],
    providerRate: rate,
  };
}

async function load() {
  const [list, bal] = await Promise.all([
    smmProvider.services(),
    smmProvider.balance().catch(() => ({ rate: null })),
  ]);
  if (!Array.isArray(list)) throw new Error('Danh sách dịch vụ hotrodvfb không hợp lệ');
  const vndRate = bal.rate > 0 ? bal.rate : config.smm.usdVnd;
  const services = new Map();
  for (const s of list) {
    const svc = toService(s, vndRate);
    if (svc) services.set(svc.id, svc);
  }
  cache = { at: Date.now(), services, vndRate };
  return cache;
}

export async function getSmmCatalog({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache;
  loading ??= load().finally(() => {
    loading = null;
  });
  try {
    return await loading;
  } catch (err) {
    if (cache) return cache; // NCC tạm lỗi: dùng danh mục cũ
    throw err;
  }
}

/** Dạng gửi cho client (bỏ giá gốc của NCC). */
export const publicService = ({ providerRate, ...s }) => s;

/** Tiền khách trả cho `quantity` đơn vị (VND, làm tròn lên). */
export const smmAmount = (svc, quantity) => Math.ceil((svc.pricePer1000 * quantity) / 1000);

/** Tách nội dung nhiều dòng, bỏ dòng trống. */
export const splitLines = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);


/** Xoá bộ nhớ tạm (dùng trong test). */
export function _resetSmmCatalog() {
  cache = null;
}
