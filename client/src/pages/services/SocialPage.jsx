import { useState } from 'react';
import ServiceShell from '../../components/service/ServiceShell.jsx';
import Platforms from '../../components/service/Platforms.jsx';
import LinedPriceTable from '../../components/service/LinedPriceTable.jsx';
import BenefitsCover from '../../components/service/BenefitsCover.jsx';
import { asset, formatVnd } from '../../utils/format.js';

const BASE = asset('services/tang-tuong-tac-mxh');

// Figma: Dịch vụ / Dịch vụ Tăng tương tác MXH (112:12315)
export default function SocialPage({ service, content }) {
  const platforms = content.platforms || [];
  const [activeId, setActiveId] = useState(platforms[0]?.id);
  const active = platforms.find((p) => p.id === activeId) || platforms[0];

  // Bảng giá đổi theo nền tảng đang chọn
  const table = active && {
    ...content.priceTable,
    rows: active.services.map((s) => [s.name, String(s.unit), `${formatVnd(s.price)}đ`]),
  };

  return (
    <ServiceShell
      service={service}
      hero={{
        bg: asset('services/tang-tuong-tac-mxh/hero-bg.jpg'),
        ...content.hero,
        art: `${BASE}/hero.png`,
        artSize: [435, 468],
        descWidth: 352,
        artAlt: 'Minh hoạ tăng tương tác: lượt thích Facebook đang chạy và số tiền đã trừ',
      }}
    >
      <Platforms platforms={platforms} activeId={active?.id} onSelect={setActiveId} imageBase={BASE} />
      <LinedPriceTable table={table} id="bang-gia" />
      <BenefitsCover {...content.commitments} imageBase={BASE} id="cam-ket" />
    </ServiceShell>
  );
}
