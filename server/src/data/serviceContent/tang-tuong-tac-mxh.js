import { defaultProcess } from './_common.js';

// Bảng giá mặc định theo thiết kế (Figma 112:12400 – đang hiển thị cho Facebook)
const baseServices = [
  { name: 'Like / Thả cảm xúc', unit: 1000, price: 500000 },
  { name: 'Follow / Theo dõi', unit: 1000, price: 500000 },
  { name: 'View video / Live', unit: 1000, price: 500000 },
  { name: 'Bình luận', unit: 100, price: 500000 },
  { name: 'Chia sẻ', unit: 100, price: 500000 },
];

// Figma: Dịch vụ / Dịch vụ Tăng tương tác MXH (112:12315)
export default {
  hero: {
    title: 'Tăng tương tác cho trang mạng xã hội.',
    description: 'Chọn nền tảng, loại tương tác và số lượng. Tiền trừ ngay khi gửi đơn.',
  },
  process: defaultProcess,
  // "Nền tảng" (112:12329) – mỗi nền tảng có bảng giá riêng; giá cập nhật từ Admin
  platforms: [
    { id: 'facebook', name: 'Facebook', services: baseServices },
    {
      id: 'tiktok',
      name: 'TikTok',
      services: [
        { name: 'Tim / Thả tim', unit: 1000, price: 500000 },
        { name: 'Follow / Theo dõi', unit: 1000, price: 500000 },
        { name: 'View video / Live', unit: 1000, price: 500000 },
        { name: 'Bình luận', unit: 100, price: 500000 },
        { name: 'Chia sẻ', unit: 100, price: 500000 },
      ],
    },
    {
      id: 'youtube',
      name: 'YouTube',
      services: [
        { name: 'Like video', unit: 1000, price: 500000 },
        { name: 'Đăng ký kênh', unit: 1000, price: 500000 },
        { name: 'View video / Live', unit: 1000, price: 500000 },
        { name: 'Bình luận', unit: 100, price: 500000 },
      ],
    },
    {
      id: 'instagram',
      name: 'Instagram',
      services: [
        { name: 'Like / Thả tim', unit: 1000, price: 500000 },
        { name: 'Follow / Theo dõi', unit: 1000, price: 500000 },
        { name: 'View Reels / Live', unit: 1000, price: 500000 },
        { name: 'Bình luận', unit: 100, price: 500000 },
      ],
    },
    {
      id: 'zalo',
      name: 'Zalo',
      services: [
        { name: 'Quan tâm Zalo OA', unit: 1000, price: 500000 },
        { name: 'Thả cảm xúc bài viết', unit: 1000, price: 500000 },
        { name: 'Bình luận', unit: 100, price: 500000 },
      ],
    },
    {
      id: 'shopee-live',
      name: 'Shopee Live',
      services: [
        { name: 'Mắt xem Live', unit: 1000, price: 500000 },
        { name: 'Thả tim Live', unit: 1000, price: 500000 },
        { name: 'Theo dõi Shop', unit: 1000, price: 500000 },
        { name: 'Bình luận Live', unit: 100, price: 500000 },
      ],
    },
  ],
  priceTable: {
    title: 'Bảng giá',
    columns: ['Dịch vụ', 'Đơn vị', 'Giá'],
  },
  // "Cam kết" (112:12439)
  commitments: {
    title: 'Cam kết',
    items: ['Bảo hành tụt... ngày', 'Hoàn tiền phần chưa chạy', 'Không cần mật khẩu tài khoản'],
  },
};
