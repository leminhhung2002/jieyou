/** 1000000 -> "1.000.000" */
export const formatVnd = (n) => new Intl.NumberFormat('vi-VN').format(n);

/** "2026-10-19" -> "Oct 19, 2026" (đúng định dạng trong thiết kế) */
export const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const asset = (path) => `/assets/${path}`;
