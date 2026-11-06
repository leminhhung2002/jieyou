import ServiceShell from '../../components/service/ServiceShell.jsx';
import MachineCards from '../../components/service/MachineCards.jsx';
import LinedPriceTable from '../../components/service/LinedPriceTable.jsx';
import BenefitsCover from '../../components/service/BenefitsCover.jsx';
import { asset, formatVnd } from '../../utils/format.js';

const BASE = asset('services/may-ban-hang-misa');

// Figma: Dịch vụ / Máy bán hàng hóa đơn (126:7918). Section "Quy trình" bị ẩn trong thiết kế nên không hiển thị.
export default function MisaPage({ service, content }) {
  const plans = content.invoicePlans;
  const table = plans && {
    title: plans.title,
    columns: plans.columns,
    rows: plans.plans.map((p) => [p.id, String(p.invoices), `${formatVnd(p.price)}đ`]),
  };

  return (
    <ServiceShell
      service={service}
      hero={{
        bg: asset('services/may-ban-hang-misa/hero-bg.jpg'),
        ...content.hero,
        art: `${BASE}/hero.png`,
        artSize: [434.571, 468],
        artAlt: 'Minh hoạ máy bán hàng in hóa đơn MISA meInvoice',
      }}
    >
      <MachineCards machines={content.machines} serviceName={service.name} imageBase={BASE} />
      <LinedPriceTable table={table} id="goi-hoa-don" />
      <BenefitsCover {...content.benefits} imageBase={BASE} id="loi-ich" />
    </ServiceShell>
  );
}
