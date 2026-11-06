import { formatVnd } from '../utils/format.js';

export const vnd = (n) => `${formatVnd(n)} đ`;
export const signedVnd = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatVnd(Math.abs(n))} đ`;

const pad = (n) => String(n).padStart(2, '0');
const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** "10:05 hôm nay" | "Hôm qua" | "02/11/2026" – dùng ở Tổng quan */
export function relativeDay(iso, { withTodaySuffix = true } = {}) {
  const d = new Date(iso);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return `${pad(d.getHours())}:${pad(d.getMinutes())}${withTodaySuffix ? ' hôm nay' : ''}`;
  if (sameDay(d, y)) return 'Hôm qua';
  return dateVN(iso);
}

/** "15/09/2026" */
export const dateVN = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** "02/11 14:35" */
export const dateTimeShort = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "0912345678" -> "0912 345 678" */
export const phoneVN = (p) => String(p || '').replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');

export const formatThousands = (n) => formatVnd(n);
