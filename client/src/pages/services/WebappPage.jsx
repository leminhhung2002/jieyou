import ServiceShell from '../../components/service/ServiceShell.jsx';
import ProcessSteps from '../../components/service/ProcessSteps.jsx';
import PriceTable from '../../components/service/PriceTable.jsx';
import MultiLine from '../../components/service/MultiLine.jsx';
import { asset } from '../../utils/format.js';

// Dịch vụ / Làm app, web theo yêu cầu – gửi yêu cầu trong tài khoản, admin báo giá
export default function WebappPage({ service, content }) {
  const hero = content.hero || {};
  return (
    <ServiceShell
      service={service}
      hero={{
        title: <MultiLine text={hero.title} />,
        description: <MultiLine text={hero.description} />,
        art: asset('services/lam-app-web-theo-yeu-cau/hero.svg'),
        artSize: [435, 468],
        artAlt: 'Minh hoạ cửa sổ trình duyệt với mã nguồn, báo giá trong 24 giờ',
      }}
    >
      <ProcessSteps steps={content.process} />
      <PriceTable table={content.priceTable} />
    </ServiceShell>
  );
}
