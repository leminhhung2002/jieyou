import { defaultProcess } from './_common.js';

// Phí giao dịch / quyền lợi dùng chung giữa trang UniPay và Hồ sơ Bộ Công Thương (giống nhau trong thiết kế)
export const basicFees = [
  { icon: 'fee-qr', text: 'Thanh toán qua mã QR chỉ từ 0,5%' },
  { icon: 'fee-card', text: 'Thanh toán qua Thẻ chỉ từ 1,5%' },
  { icon: 'fee-ecom', text: 'Thanh toán qua cổng E-com chỉ từ 1,7%' },
];
export const proFees = [{ icon: 'fee-scale', text: 'Ưu đãi phí giao dịch theo quy mô' }];

/** Hai gói "Cơ bản" / "Nâng cao"; `benefits` để trống thì không hiện mục "Bạn nhận được". */
export const makePlans = ({ withBenefits }) => ({
  title: 'Gói giá',
  feesLabel: 'Phí giao dịch',
  benefitsLabel: 'Bạn nhận được:',
  items: [
    {
      id: 'co-ban',
      name: 'Cơ bản',
      description: 'Đủ để bắt đầu bán hàng và nhận thanh toán.',
      price: 0,
      period: '/tháng*',
      fees: basicFees,
      benefits: withBenefits
        ? [
            { icon: 'f-software', text: 'Trọn bộ phần mềm bán hàng — tính năng cơ bản, hơn 20 ngành' },
            { icon: 'f-payment', text: 'Nhận thanh toán QR · Thẻ · Ví + Hóa đơn điện tử tích hợp' },
            { icon: 'f-box', text: 'Quản lý sản phẩm, tồn kho, khách hàng' },
            { icon: 'f-chart', text: 'Báo cáo doanh thu theo thời gian thực' },
            { icon: 'f-invoice', text: 'Tặng gói Khởi tạo + 1.000 HĐĐT (1.000.000đ)' },
          ]
        : [],
    },
    {
      id: 'nang-cao',
      name: 'Nâng cao',
      description: 'Bộ tính năng đầy đủ cho cửa hàng đang lớn.',
      price: 800000,
      period: '/tháng*',
      note: '*Miễn phí khi nhận thanh toán qua UniPay',
      popular: true,
      fees: proFees,
      benefits: withBenefits
        ? [
            { icon: 'f-check', text: 'Tất cả tính năng gói Khởi Đầu' },
            { icon: 'f-cart', text: 'Quản lý bếp (KOT/KDS) · giao hàng · bán đa kênh' },
            { icon: 'f-star', text: 'Khách hàng thân thiết & tích điểm' },
            { icon: 'f-user', text: 'Quản lý nhà cung cấp & nhân sự' },
            { icon: 'f-gear', text: 'Tính năng chuyên sâu theo ngành' },
          ]
        : [],
    },
  ],
});

// Figma: Dịch vụ / Tài khoản UniPay (112:11129)
export default {
  hero: {
    // "\n" = ngắt dòng đúng như thiết kế (chỉ áp dụng trên màn hình rộng)
    title: 'Mở tài khoản UniPay\ncho doanh nghiệp.',
    description: 'Điền thông tin đại diện và doanh nghiệp, theo dõi trạng thái mở\ntài khoản ngay trong hệ thống.',
  },
  process: defaultProcess,
  features: {
    title: 'Tính năng',
    items: [
      { id: 'ban-hang', name: 'Bán hàng', description: 'Đưa banner của bạn lên các vị trí nổi bật', icon: 'feat-sales' },
      { id: 'kho-hang', name: 'Kho hàng', description: 'Mở tài khoản UniPay cho doanh nghiệp.', icon: 'feat-wallet' },
      { id: 'cong-no', name: 'Công nợ', description: 'Lập và theo dõi hồ sơ với Bộ Công Thương.', icon: 'feat-dossier' },
      { id: 'bao-cao', name: 'Báo cáo', description: 'Trang bị máy bán hàng kèm hóa đơn điện tử MISA.', icon: 'feat-card' },
      { id: 'ket-noi-pos', name: 'Kết nối máy POS', description: 'Đăng ký cổng thanh toán POS, miễn phí.', icon: 'feat-terminal' },
      { id: 'hoa-don-misa', name: 'Hóa đơn MISA', description: 'Tăng lượt thích, theo dõi, xem cho trang mạng xã hội.', icon: 'feat-social' },
    ],
  },
  plans: makePlans({ withBenefits: true }),
  documents: {
    title: 'Cần chuẩn bị',
    items: [
      { id: 'email', label: 'Email doanh nghiệp' },
      { id: 'mst', label: 'Mã số thuế', width: 130 },
      { id: 'dai-dien', label: 'Tên người đại diện' },
      { id: 'dia-chi', label: 'Địa chỉ kinh doanh' },
    ],
  },
};
