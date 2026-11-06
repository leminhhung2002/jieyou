import { defaultProcess } from './_common.js';
import { makePlans } from './tai-khoan-unipay.js';

// Figma: Dịch vụ / Hồ sơ Bộ Công Thương (112:11681)
export default {
  hero: {
    title: 'Hồ sơ Bộ Công Thương, làm gọn trong một nơi.',
    description: 'Chuẩn bị giấy tờ, gửi hồ sơ và theo dõi\ntrạng thái ngay trong tài khoản.',
  },
  process: defaultProcess,
  // Thiết kế trang này chỉ có phần "Phí giao dịch", không có danh sách "Bạn nhận được"
  plans: makePlans({ withBenefits: false }),
  documents: {
    title: 'Chúng tôi soạn',
    // width = độ rộng khung chữ theo Figma để giữ đúng bố cục lưới
    items: [
      { id: 'quy-che', label: 'Quy chế hoạt động sàn', width: 158 },
      { id: 'de-an', label: 'Đề án cung cấp dịch vụ', width: 158 },
      { id: 'khieu-nai', label: 'Cơ chế giải quyết khiếu nại', width: 181 },
      { id: 'dlcn', label: 'Chính sách bảo vệ DLCN (NĐ 13/2023)', width: 256 },
      { id: 'dieu-khoan', label: 'Điều khoản dịch vụ', width: 129 },
    ],
  },
};
