import { defaultProcess, LOREM_SHORT } from './_common.js';

// Figma: Dịch vụ / Quảng cáo trên sàn (112:11867)
export default {
  hero: {
    title: 'Đưa thương hiệu lên vị trí nổi bật của sàn.',
    description: 'Chọn vị trí, ngày chạy và tải banner. Tiền được tạm giữ cho đến khi quảng cáo được duyệt.',
  },
  process: defaultProcess,
  positions: [
    { id: 'home-banner', name: 'Banner Trang chủ', description: LOREM_SHORT, image: 'pos-banner' },
    { id: 'sponsored-post', name: 'Bài viết tài trợ', description: LOREM_SHORT, image: 'pos-article' },
    { id: 'category-pin', name: 'Ghim chuyên mục', description: LOREM_SHORT, image: 'pos-pin' },
  ],
  // Giá cập nhật từ Admin; "..." = chưa công bố (đúng như thiết kế)
  priceTable: {
    title: 'Bảng giá',
    columns: ['Vị trí', 'Ngày', 'Tuần'],
    rows: [
      ['Banner trang chủ', '...', '...'],
      ['Bài viết tài trợ', '...', '...'],
      ['Ghim chuyên mục', '...', '...'],
    ],
  },
};
