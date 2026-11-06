/** 6 dịch vụ của Web người dùng – thứ tự & nhãn theo Figma (74:2116). `key` = tên sticker trong /assets/account/sticker. */
export const ACCOUNT_SERVICES = [
  { key: 'ads', type: 'ads', cardLabel: 'Quảng cáo trên sàn', to: '/tai-khoan/quang-cao' },
  { key: 'unipay', type: 'unipay', cardLabel: 'Tài khoản UniPay', to: '/tai-khoan/unipay' },
  { key: 'bct', type: 'bct', cardLabel: 'Hồ sơ Bộ Công Thương', to: '/tai-khoan/bo-cong-thuong' },
  { key: 'misa', type: 'misa', cardLabel: 'Máy bán hàng + Hóa đơn MISA', to: '/tai-khoan/may-ban-hang' },
  { key: 'pos', type: 'pos', cardLabel: 'Hồ sơ cổng thanh toán POS', to: '/tai-khoan/pos' },
  { key: 'social', type: 'social', cardLabel: 'Tăng tương tác MXH', to: '/tai-khoan/tuong-tac-mxh' },
];

/** Trạng thái hồ sơ → nhãn + tone của StatusPill (admin/ui.jsx) */
export const APPLICATION_STATUS = {
  pending: { label: 'Chờ duyệt', tone: 'warning' },
  approved: { label: 'Hoàn thành', tone: 'success' },
  rejected: { label: 'Bị từ chối', tone: 'danger' },
};
