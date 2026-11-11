import { config } from '../config.js';
import { smmProvider } from './smmProvider.js';
import { adminStore } from './adminStore.js';

/**
 * Danh mục dịch vụ tăng tương tác lấy từ hotrodvfb, quy đổi sang VND cho khách JIEYOU.
 * Giá gốc = rate (USD / 1000) × tỉ giá NCC. Giá khách = giá admin đặt riêng cho dịch vụ, nếu không thì
 * giá gốc × (1 + % lãi), làm tròn lên. % lãi do admin chỉnh (mặc định SMM_MARKUP_PERCENT).
 * Admin có thể ẩn từng dịch vụ. Danh mục NCC lưu tạm 10 phút; NCC lỗi thì dùng bản cũ (nếu có).
 * Cài đặt giá ở adminStore.db.smmSettings = { markupPercent: number | null, overrides: { [id]: { price?, disabled? } } }.
 */

/** Nền tảng hiện trên web (khoá trùng icon ở client) ↔ tên `platform` của NCC. */
export const SMM_PLATFORMS = [
  { key: 'facebook', name: 'Facebook', provider: 'Facebook' },
  { key: 'tiktok', name: 'TikTok', provider: 'Tiktok' },
  { key: 'youtube', name: 'YouTube', provider: 'Youtube' },
  { key: 'instagram', name: 'Instagram', provider: 'Instagram' },
  { key: 'threads', name: 'Threads', provider: 'Threads' },
  { key: 'twitter', name: 'X (Twitter)', provider: 'Twitter' },
  { key: 'shopee', name: 'Shopee', provider: 'Shopee' },
  { key: 'lazada', name: 'Lazada', provider: 'Lazada' },
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

/**
 * Tách tên dịch vụ NCC thành "loại dịch vụ" + "server" giống menu hotrodvfb.
 *   "Facebook - Like bài viết sv3"                 → Like bài viết · SV3
 *   "Tiktok - Mắt xem live streams sv1 ~ 30 phút"  → Mắt xem livestream · SV1 ~ 30 phút
 *   "View video 600k phút - Video 3 giờ"           → View video 600k phút · Video 3 giờ
 */
const PLATFORM_PREFIX = /^\s*(facebook|instagram|threads|tiktok|shopee|youtube|twitter|lazada)\s*-\s*/i;
export function splitServiceName(rawName) {
  const name = String(rawName || '').replace(/\s+/g, ' ').trim();
  const body = name.replace(PLATFORM_PREFIX, '');
  // "<loại dịch vụ> sv3 <phần còn lại>" – mã server: sv3, sv 1, sv1c, V2, v13…
  const m = body.match(/^(.+?)\s+(sv\s*\d+[a-z]?|v\d+)(?=[\s,]|$)[\s,]*(.*)$/i);
  let group;
  let server;
  if (m) {
    group = m[1];
    const code = m[2].replace(/\s+/g, '').toUpperCase().replace(/^V(?=\d)/, 'SV');
    server = `${code} ${m[3].replace(/^[-\s]+/, '')}`.trim();
  } else if (body.includes(' - ')) {
    group = body.slice(0, body.indexOf(' - '));
    server = body.slice(body.indexOf(' - ') + 3);
  } else {
    group = body;
    server = 'SV1';
  }
  group = group
    .replace(/(^|\s)(tiktok|youtube|instagram|twitter|threads|shopee|lazada|facebook)(?=\s|$)/gi, '$1')
    .replace(/live\s*streams?/gi, 'livestream')
    .replace(/\s+/g, ' ')
    .trim();
  group = group.charAt(0).toUpperCase() + group.slice(1);
  return { group: group || 'Khác', server: server || 'SV1' };
}

const TTL = 10 * 60_000;
let cache = null; // { at, services: Map(id → dịch vụ chưa tính giá), vndRate }
let loading = null;

function toService(s) {
  const platform = SMM_PLATFORMS.find((p) => p.provider === s.platform);
  const type = SMM_TYPES[s.type];
  const rate = Number(s.rate);
  const min = Number(s.min);
  const max = Number(s.max);
  if (!platform || !type || s.is_vip || !(rate > 0) || !(min > 0) || !(max >= min)) return null;
  return {
    id: Number(s.service),
    platform: platform.key,
    name: String(s.name || '').slice(0, 120),
    category: String(s.category || 'Khác').slice(0, 80),
    ...((({ group, server }) => ({ group: group.slice(0, 80), server: server.slice(0, 60) }))(splitServiceName(s.name))),
    description: String(s.description || '').slice(0, 500),
    type: s.type,
    min,
    max,
    refill: Boolean(s.refill),
    refillDays: Number(s.refill_days) || 0,
    cancel: Boolean(s.cancel),
    reactions: type.reaction && s.data?.allow_reaction !== false
      ? (Array.isArray(s.data?.reactions) ? s.data.reactions.filter((r) => REACTIONS.includes(r)) : REACTIONS)
      : [],
    providerRate: rate,
  };
}

const settings = () => adminStore.db.smmSettings || { markupPercent: null, overrides: {} };

/** % lãi đang áp dụng. */
export const smmMarkup = () => settings().markupPercent ?? config.smm.markupPercent;

/** Tính giá cho một dịch vụ theo cài đặt hiện tại (VND cho 1.000 đơn vị). */
function priced(svc, vndRate) {
  const ov = settings().overrides?.[svc.id] || {};
  const costPer1000 = Math.ceil(svc.providerRate * vndRate);
  const defaultPrice = Math.ceil(svc.providerRate * vndRate * (1 + smmMarkup() / 100));
  const customPrice = Number.isInteger(ov.price) && ov.price > 0 ? ov.price : null;
  return { ...svc, costPer1000, defaultPrice, customPrice, pricePer1000: customPrice ?? defaultPrice, disabled: Boolean(ov.disabled) };
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
    const svc = toService(s);
    if (svc) services.set(svc.id, svc);
  }
  cache = { at: Date.now(), services, vndRate };
  return cache;
}

async function loadCached(fresh) {
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

/**
 * Danh mục đã tính giá theo cài đặt hiện tại.
 * `services`: dịch vụ khách đặt được (đã bỏ dịch vụ admin ẩn); `all`: mọi dịch vụ (cho trang admin).
 */
export async function getSmmCatalog({ fresh = false } = {}) {
  const c = await loadCached(fresh);
  const all = [...c.services.values()].map((svc) => priced(svc, c.vndRate));
  return { at: c.at, vndRate: c.vndRate, all, services: new Map(all.filter((s) => !s.disabled).map((s) => [s.id, s])) };
}

/** Dạng gửi cho khách (bỏ giá gốc và cài đặt nội bộ). */
export const publicService = ({ providerRate, costPer1000, defaultPrice, customPrice, disabled, ...s }) => s;

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
