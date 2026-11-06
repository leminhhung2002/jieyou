// Dữ liệu mặc định giống thiết kế – hiển thị ngay khi trang tải và khi API không phản hồi.
// Nguồn dữ liệu chính vẫn là backend (/api/*).
export const fallbackServices = [
  { slug: 'quang-cao-tren-san', name: 'Quảng cáo trên sàn', icon: 'megaphone', description: 'Đưa banner của bạn lên các vị trí nổi bật của sàn.' },
  { slug: 'tai-khoan-unipay', name: 'Tài khoản UniPay', icon: 'wallet', description: 'Mở tài khoản UniPay cho doanh nghiệp.' },
  { slug: 'ho-so-bo-cong-thuong', name: 'Hồ sơ Bộ Công Thương', icon: 'dossier', description: 'Lập và theo dõi hồ sơ với Bộ Công Thương.' },
  { slug: 'cong-thanh-toan-pos', name: 'Hồ sơ cổng thanh toán POS', icon: 'terminal', description: 'Đăng ký cổng thanh toán POS, miễn phí.' },
  { slug: 'tang-tuong-tac-mxh', name: 'Tăng tương tác MXH', icon: 'social', description: 'Tăng lượt thích, theo dõi, xem cho trang mạng xã hội.' },
  { slug: 'may-ban-hang-misa', name: 'Máy bán hàng + Hóa đơn MISA', icon: 'card', description: 'Trang bị máy bán hàng kèm hóa đơn điện tử MISA.' },
  { slug: null, name: 'Dịch vụ ....', icon: 'terminal', description: 'Đăng ký cổng thanh toán POS, miễn phí.', comingSoon: true },
  { slug: null, name: 'Dịch vụ ....', icon: 'terminal', description: 'Đăng ký cổng thanh toán POS, miễn phí.', comingSoon: true },
];

export const fallbackPricing = [
  { id: 'ads', name: 'Quảng cáo', fromPrice: 1000000, unit: '/ ngày' },
  { id: 'pos-machine', name: 'Máy bán hàng', fromPrice: 1000000, unit: '/ máy' },
  { id: 'misa', name: 'Gói HĐ MISA', fromPrice: 1000000, unit: '/gói' },
  { id: 'bct', name: 'Hồ sơ BCT', fromPrice: 1000000, unit: '/hồ sơ' },
  { id: 'social', name: 'Tương tác MXH', fromPrice: 1000000, unit: '/1000 lượt' },
];

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit enim urna porttitor neque ';
export const fallbackFaqs = [
  { id: 1, question: 'Tài khoản trả trước dùng để làm gì?', answer: LOREM.repeat(5), highlight: LOREM },
  { id: 2, question: 'Hồ sơ POS duyệt trong bao lâu?', answer: LOREM.repeat(3), highlight: LOREM },
  { id: 3, question: 'Kết quả gửi về email nào?', answer: LOREM.repeat(3), highlight: LOREM },
  { id: 4, question: 'Hóa đơn VAT nhận ở đâu?', answer: LOREM.repeat(3), highlight: LOREM },
];

export const fallbackNews = [1, 2, 3].map((id) => ({
  id,
  slug: `tieu-de-bai-viet-${id}`,
  title: 'Tiêu đề bài viết',
  excerpt: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit enim urna porttitor neque elementum cursus.',
  tag: 'Tài trợ',
  publishedAt: '2026-10-19',
  image: null,
}));
