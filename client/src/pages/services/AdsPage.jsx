import ServiceShell from '../../components/service/ServiceShell.jsx';
import ProcessSteps from '../../components/service/ProcessSteps.jsx';
import Positions from '../../components/service/Positions.jsx';
import PriceTable from '../../components/service/PriceTable.jsx';
import { asset } from '../../utils/format.js';

const BASE = asset('services/quang-cao-tren-san');

// Figma: Dịch vụ / Quảng cáo trên sàn (112:11867)
export default function AdsPage({ service, content }) {
  return (
    <ServiceShell
      service={service}
      hero={{
        ...content.hero,
        art: `${BASE}/hero.png`,
        artSize: [434.94, 468.397],
        artAlt: 'Minh hoạ quảng cáo: chọn ngày chạy và tạm giữ tiền',
      }}
    >
      <ProcessSteps steps={content.process} />
      <Positions items={content.positions} imageBase={BASE} />
      <PriceTable table={content.priceTable} staggered />
    </ServiceShell>
  );
}
