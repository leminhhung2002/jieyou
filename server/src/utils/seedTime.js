/**
 * Mốc thời gian cho dữ liệu mẫu, luôn hợp lệ dù server khởi động lúc nào trong ngày.
 * - atToday(h, m): "hôm nay lúc h:m"; nếu giờ đó chưa tới thì dồn tỉ lệ vào khoảng 0h → hiện tại
 *   (vẫn là hôm nay, không ở tương lai, giữ thứ tự trước/sau giữa các mốc).
 * - daysAgo(n, h, m): "n ngày trước lúc h:m", luôn cũ hơn n × 24 giờ (để hồ sơ "quá 24 giờ" luôn đúng).
 */
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export function atToday(h, m, now = new Date()) {
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d <= now) return d.toISOString();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const frac = (h * 60 + m) / (24 * 60);
  return new Date(start.getTime() + (now - start) * frac).toISOString();
}

export function daysAgo(days, h, m, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  const latest = now.getTime() - days * DAY - 5 * MIN;
  if (d.getTime() <= latest) return d.toISOString();
  // Dồn về trước mốc n×24h, giữ thứ tự theo giờ trong ngày (mỗi phút ↔ 6 giây)
  return new Date(latest - (24 * 60 - (h * 60 + m)) * 6000).toISOString();
}
