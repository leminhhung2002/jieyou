import { defaultProcess } from './_common.js';

// Danh sách tính năng chung của 2 mẫu máy (icon = tên file svg trong assets/services/may-ban-hang-misa)
const machineFeatures = [
  { icon: 'feat-1', text: 'Tất cả tính năng gói Khởi Đầu' },
  { icon: 'feat-2', text: 'Quản lý bếp (KOT/KDS) · giao hàng · bán đa kênh' },
  { icon: 'feat-3', text: 'Khách hàng thân thiết & tích điểm' },
  { icon: 'feat-4', text: 'Quản lý nhà cung cấp & nhân sự' },
  { icon: 'feat-5', text: 'Tính năng chuyên sâu theo ngành' },
];

// Figma: Dịch vụ / Máy bán hàng hóa đơn (126:7918)
export default {
  hero: {
    title: 'Máy bán hàng kèm hóa đơn điện tử 1INVOICE.',
    description: 'Chọn máy, đặt hàng và xuất hóa đơn điện tử 1INVOICE meInvoice với VAT 8% hoặc 10%.',
  },
  // Section "Quy trình" bị ẩn trong thiết kế (126:7932) – giữ dữ liệu nhưng trang không hiển thị
  process: defaultProcess,
  // "Mẫu máy" (126:7933) – giá theo tháng, đơn vị VNĐ
  machines: [
    {
      id: 'may-a',
      name: 'MÁY A',
      description: 'Đủ để bắt đầu bán hàng và nhận thanh toán.',
      image: 'machine',
      price: 0,
      period: '/tháng',
      features: machineFeatures,
    },
    {
      id: 'may-b',
      name: 'MÁY B',
      description: 'Bộ tính năng đầy đủ cho cửa hàng đang lớn.',
      image: 'machine',
      price: 800000,
      period: '/tháng',
      popular: true,
      features: machineFeatures,
    },
  ],
  // "Gói hóa đơn 1INVOICE" (126:8063)
  invoicePlans: {
    title: 'Gói hóa đơn 1INVOICE',
    columns: ['Gói', 'Số hóa đơn', 'Giá'],
    plans: [
      { id: 'S', invoices: 1000, price: 500000 },
      { id: 'M', invoices: 1000, price: 500000 },
      { id: 'L', invoices: 1000, price: 500000 },
    ],
  },
  // "Lợi ích" (126:8092)
  benefits: {
    title: 'Lợi ích',
    items: ['Xuất hóa đơn VAT ngay khi bán', 'Kết nối Unipay', 'Bảo hành..........'],
  },
};
