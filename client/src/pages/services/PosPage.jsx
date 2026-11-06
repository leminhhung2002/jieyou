import ServiceShell from '../../components/service/ServiceShell.jsx';
import ProcessSteps from '../../components/service/ProcessSteps.jsx';
import DocsWindow from '../../components/service/DocsWindow.jsx';
import MultiLine from '../../components/service/MultiLine.jsx';
import { asset } from '../../utils/format.js';

const BASE = asset('services/cong-thanh-toan-pos');

// Figma: Dịch vụ / Hồ sơ cổng thanh toán POS (112:12197)
export default function PosPage({ service, content }) {
  const hero = content.hero || {};
  return (
    <ServiceShell
      service={service}
      hero={{
        bg: asset('services/cong-thanh-toan-pos/hero-bg.jpg'),
        title: <MultiLine text={hero.title} />,
        description: <MultiLine text={hero.description} />,
        art: `${BASE}/hero.png`,
        artSize: [434.571, 468],
        artAlt: 'Minh hoạ thẻ thanh toán không tiếp xúc, phí dịch vụ miễn phí',
      }}
    >
      <ProcessSteps steps={content.process} />
      <DocsWindow docs={content.documents} gap={61} />
    </ServiceShell>
  );
}
