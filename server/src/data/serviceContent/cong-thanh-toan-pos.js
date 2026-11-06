import { defaultProcess } from './_common.js';

// Figma: Dịch vụ / Hồ sơ cổng thanh toán POS (112:12197)
export default {
  hero: {
    // Nội dung hero giữ nguyên như thiết kế hiện tại
    title: 'Máy bán hàng kèm hóa đơn điện tử MISA.',
    description: 'Chọn máy, đặt hàng và xuất hóa đơn điện tử MISA meInvoice với VAT 8% hoặc 10%.',
  },
  process: defaultProcess,
  documents: {
    title: 'Hồ sơ cần',
    items: [
      { id: 'cccd', label: 'CCCD người đại diện', width: 142 },
      { id: 'dkkd', label: 'Giấy phép ĐKKD', width: 113 },
      { id: 'bien-hieu', label: 'Ảnh biển hiệu điểm bán', width: 161 },
      { id: 'cua-hang', label: 'Ảnh bên trong cửa hàng', width: 164 },
      { id: 'unipay', label: 'Đã có tài khoản Unipay', width: 156 },
    ],
  },
};
