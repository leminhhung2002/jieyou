import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import NotFoundPage from './NotFoundPage.jsx';

// Mỗi dịch vụ có bố cục riêng trong Figma -> một component trang cho mỗi slug.
const PAGES = {
  'quang-cao-tren-san': lazy(() => import('./services/AdsPage.jsx')),
  'tai-khoan-unipay': lazy(() => import('./services/UnipayPage.jsx')),
  'ho-so-bo-cong-thuong': lazy(() => import('./services/BctPage.jsx')),
  'cong-thanh-toan-pos': lazy(() => import('./services/PosPage.jsx')),
  'tang-tuong-tac-mxh': lazy(() => import('./services/SocialPage.jsx')),
  'may-ban-hang-misa': lazy(() => import('./services/MisaPage.jsx')),
};

const Blank = () => <div style={{ minHeight: '100vh', background: '#0f0f13' }} />;

export default function ServicePage() {
  const { slug } = useParams();
  const Page = PAGES[slug];
  const { data: service, error, loading } = useApi((o) => api.service(slug, o), [slug], null);
  useDocumentTitle(service ? `${service.name} – JIEYOU` : 'Dịch vụ – JIEYOU');

  if (!Page || error?.status === 404) return <NotFoundPage />;
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f0f13', color: '#fff' }}>
        <p>{error.message}</p>
      </div>
    );
  }
  if (loading || !service) return <Blank />;
  return (
    <Suspense fallback={<Blank />}>
      <Page service={service} content={service.content || {}} />
    </Suspense>
  );
}
