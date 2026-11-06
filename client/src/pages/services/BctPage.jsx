import ServiceShell from '../../components/service/ServiceShell.jsx';
import ProcessSteps from '../../components/service/ProcessSteps.jsx';
import PlanCards from '../../components/service/PlanCards.jsx';
import DocsWindow from '../../components/service/DocsWindow.jsx';
import MultiLine from '../../components/service/MultiLine.jsx';
import { asset } from '../../utils/format.js';

const BASE = asset('services/ho-so-bo-cong-thuong');

// Figma: Dịch vụ / Hồ sơ Bộ Công Thương (112:11681)
export default function BctPage({ service, content }) {
  const hero = content.hero || {};
  return (
    <ServiceShell
      service={service}
      hero={{
        bg: asset('services/ho-so-bo-cong-thuong/hero-bg.jpg'),
        title: <MultiLine text={hero.title} />,
        description: <MultiLine text={hero.description} />,
        art: `${BASE}/hero.png`,
        artSize: [435.124, 468.595],
        artAlt: 'Minh hoạ ví và số dư khả dụng, hồ sơ đã gửi',
      }}
    >
      <ProcessSteps steps={content.process} />
      <PlanCards plans={content.plans} serviceName={service.name} minHeight={852} />
      <DocsWindow docs={content.documents} gap={54} />
    </ServiceShell>
  );
}
