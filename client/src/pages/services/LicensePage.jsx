import ServiceShell from '../../components/service/ServiceShell.jsx';
import ProcessSteps from '../../components/service/ProcessSteps.jsx';
import PriceTable from '../../components/service/PriceTable.jsx';
import MultiLine from '../../components/service/MultiLine.jsx';
import { asset, formatVnd } from '../../utils/format.js';

// Dịch vụ / Key phần mềm bản quyền – bảng giá lấy trực tiếp từ kho key (sản phẩm đang bán)
export default function LicensePage({ service, content }) {
  const hero = content.hero || {};
  const products = service.licenseProducts || [];
  const table = {
    ...content.priceTable,
    rows: products.length
      ? products.map((p) => [p.category ? `${p.name} · ${p.category}` : p.name, p.inStock ? 'Còn hàng' : 'Tạm hết', `${formatVnd(p.price)}đ`])
      : [['Sản phẩm đang được cập nhật', '—', '—']],
  };
  return (
    <ServiceShell
      service={service}
      hero={{
        title: <MultiLine text={hero.title} />,
        description: <MultiLine text={hero.description} />,
        art: asset('services/key-ban-quyen/hero.svg'),
        artSize: [435, 468],
        artAlt: 'Minh hoạ chìa khoá bản quyền đã kích hoạt, nhận key ngay',
      }}
    >
      <ProcessSteps steps={content.process} />
      <PriceTable table={table} />
    </ServiceShell>
  );
}
