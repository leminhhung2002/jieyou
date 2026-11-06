import ServiceShell from '../../components/service/ServiceShell.jsx';
import ProcessSteps from '../../components/service/ProcessSteps.jsx';
import FeatureGrid from '../../components/service/FeatureGrid.jsx';
import PlanCards from '../../components/service/PlanCards.jsx';
import DocsWindow from '../../components/service/DocsWindow.jsx';
import MultiLine from '../../components/service/MultiLine.jsx';
import { asset } from '../../utils/format.js';

const BASE = asset('services/tai-khoan-unipay');

// Figma: Dịch vụ / Tài khoản UniPay (112:11129)
export default function UnipayPage({ service, content }) {
  const hero = content.hero || {};
  return (
    <ServiceShell
      service={service}
      hero={{
        bg: asset('services/tai-khoan-unipay/hero-bg.jpg'),
        title: <MultiLine text={hero.title} />,
        description: <MultiLine text={hero.description} />,
        art: `${BASE}/hero.png`,
        artSize: [468, 468],
        artAlt: 'Minh hoạ hồ sơ mở tài khoản đã được duyệt',
      }}
    >
      <ProcessSteps steps={content.process} />
      <FeatureGrid features={content.features} imageBase={BASE} />
      <PlanCards plans={content.plans} serviceName={service.name} />
      <DocsWindow docs={content.documents} gap={61} labelWeight="regular" />
    </ServiceShell>
  );
}
