// Dịch vụ / Key phần mềm bản quyền – danh sách sản phẩm lấy trực tiếp từ kho key (routes/content.js)
export default {
  hero: {
    title: 'Key phần mềm\nbản quyền, nhận ngay.',
    description: 'Chọn phần mềm, thanh toán bằng số dư tài khoản trả trước và nhận key ngay trên web lẫn email. Có hóa đơn cho mọi đơn hàng.',
  },
  process: [
    { n: 1, title: 'Nạp tiền', desc: 'Nạp số dư vào tài khoản trả trước.' },
    { n: 2, title: 'Chọn phần mềm', desc: 'Chọn sản phẩm và số lượng key cần mua.' },
    { n: 3, title: 'Nhận key ngay', desc: 'Key hiện ngay trên web và được gửi qua email.' },
    { n: 4, title: 'Kích hoạt', desc: 'Nhập key vào phần mềm, xem lại key bất cứ lúc nào.' },
  ],
  priceTable: {
    title: 'Bảng giá',
    columns: ['Sản phẩm', 'Tình trạng', 'Giá'],
  },
};
