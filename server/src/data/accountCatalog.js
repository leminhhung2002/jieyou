/**
 * Danh mục dịch vụ khách hàng có thể đặt trong Web người dùng.
 * `defaultPrice` chỉ dùng khi Bảng giá (admin) chưa có mục "Đã xuất bản" cùng tên;
 * khi admin xuất bản mục có `priceName` trùng, giá admin sẽ được dùng.
 */
export const AD_SLOTS = [
  { key: 'home-top', name: 'Banner đầu trang chủ', note: 'Vị trí 1', priceName: 'Banner đầu trang chủ / ngày', defaultPrice: 500_000 },
  { key: 'service-page', name: 'Banner trang dịch vụ', note: 'Vị trí 2', priceName: 'Banner trang dịch vụ / ngày', defaultPrice: 400_000 },
  { key: 'mid-page', name: 'Banner giữa trang', note: 'Vị trí 3', priceName: 'Banner giữa trang / ngày', defaultPrice: 300_000 },
];

export const MISA_DEVICES = [
  { key: 'basic', name: 'Máy bán hàng cơ bản', priceName: 'Máy bán hàng cơ bản', defaultPrice: 2_400_000 },
  { key: 'printer', name: 'Máy kèm máy in hóa đơn', priceName: 'Máy kèm máy in hóa đơn', defaultPrice: 3_600_000 },
];

export const VAT_RATES = [0, 5, 8, 10];

export const SOCIAL_PLATFORMS = [
  { key: 'facebook', name: 'Facebook' },
  { key: 'tiktok', name: 'TikTok' },
  { key: 'youtube', name: 'YouTube' },
  { key: 'instagram', name: 'Instagram' },
];

export const SOCIAL_KINDS = [
  { key: 'like', name: 'Lượt thích', defaultPrice: 30 },
  { key: 'follow', name: 'Lượt theo dõi', defaultPrice: 50 },
  { key: 'view', name: 'Lượt xem', defaultPrice: 10 },
  { key: 'comment', name: 'Bình luận', defaultPrice: 200 },
];

export const POS_BUSINESS_TYPES = ['Bán lẻ', 'Ăn uống', 'Dịch vụ', 'Thời trang', 'Khác'];

export const BCT_KINDS = ['Thông báo website TMĐT', 'Đăng ký website TMĐT', 'Đăng ký sàn TMĐT'];

/** Làm app / web theo yêu cầu: gửi yêu cầu miễn phí, admin báo giá. */
export const WEBAPP_KINDS = ['Website giới thiệu doanh nghiệp', 'Website bán hàng', 'Landing page', 'App điện thoại (iOS / Android)', 'Phần mềm quản lý', 'Khác'];
export const WEBAPP_BUDGETS = ['Dưới 10 triệu', '10 – 30 triệu', '30 – 50 triệu', '50 – 100 triệu', 'Trên 100 triệu', 'Chưa xác định, cần tư vấn'];
export const WEBAPP_DEADLINES = ['Càng sớm càng tốt', 'Trong 1 tháng', '1 – 3 tháng', 'Trên 3 tháng', 'Linh hoạt'];

/** Phí cố định theo hồ sơ */
export const FLAT_FEES = {
  unipay: { priceName: 'Phí mở tài khoản UniPay', serviceSlug: 'tai-khoan-unipay', defaultPrice: 500_000 },
  bct: { priceName: 'Phí dịch vụ / hồ sơ', serviceSlug: 'ho-so-bo-cong-thuong', defaultPrice: 800_000 },
  pos: { priceName: 'Phí dịch vụ', serviceSlug: 'cong-thanh-toan-pos', defaultPrice: 0 },
};

/** Cài đặt mặc định của tài khoản khách (màn Cài đặt). */
export const DEFAULT_SETTINGS = {
  otpLogin: true,
  email: { topup: true, applications: true, invoices: false },
};

export const TOPUP_LIMITS = { min: 50_000, max: 50_000_000 };
