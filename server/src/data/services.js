// Danh mục dịch vụ. `icon` là khoá ánh xạ sang bộ icon ở frontend.
export const services = [
  { slug: 'quang-cao-tren-san', name: 'Quảng cáo trên sàn', shortName: 'Quảng cáo', icon: 'megaphone',
    description: 'Đưa banner của bạn lên các vị trí nổi bật của sàn.', order: 1 },
  { slug: 'tai-khoan-unipay', name: 'Tài khoản UniPay', icon: 'wallet',
    description: 'Mở tài khoản UniPay cho doanh nghiệp.', order: 2 },
  { slug: 'ho-so-bo-cong-thuong', name: 'Hồ sơ Bộ Công Thương', icon: 'dossier',
    description: 'Lập và theo dõi hồ sơ với Bộ Công Thương.', order: 3 },
  { slug: 'cong-thanh-toan-pos', name: 'Hồ sơ cổng thanh toán POS', icon: 'terminal',
    description: 'Đăng ký cổng thanh toán POS, miễn phí.', order: 4 },
  { slug: 'tang-tuong-tac-mxh', name: 'Tăng tương tác MXH', icon: 'social',
    description: 'Tăng lượt thích, theo dõi, xem cho trang mạng xã hội.', order: 5 },
  { slug: 'may-ban-hang-misa', name: 'Máy bán hàng + Hóa đơn MISA', icon: 'card',
    description: 'Trang bị máy bán hàng kèm hóa đơn điện tử MISA.', order: 6 },
  // Hai ô "Dịch vụ ...." là chỗ trống dành cho dịch vụ sắp ra mắt (đúng theo thiết kế).
  { slug: null, name: 'Dịch vụ ....', icon: 'terminal', description: 'Đăng ký cổng thanh toán POS, miễn phí.', order: 7, comingSoon: true },
  { slug: null, name: 'Dịch vụ ....', icon: 'terminal', description: 'Đăng ký cổng thanh toán POS, miễn phí.', order: 8, comingSoon: true },
];
