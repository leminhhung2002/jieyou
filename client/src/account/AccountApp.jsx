import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import AccountLayout from './AccountLayout.jsx';
import OverviewPage from './pages/OverviewPage.jsx';

const PrepaidPage = lazy(() => import('./pages/PrepaidPage.jsx'));
const TopupPage = lazy(() => import('./pages/TopupPage.jsx'));
const AdsPage = lazy(() => import('./pages/AdsPage.jsx'));
const UnipayPage = lazy(() => import('./pages/UnipayPage.jsx'));
const BctPage = lazy(() => import('./pages/BctPage.jsx'));
const MisaPage = lazy(() => import('./pages/MisaPage.jsx'));
const PosPage = lazy(() => import('./pages/PosPage.jsx'));
const SocialPage = lazy(() => import('./pages/SocialPage.jsx'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));

/** Web người dùng /tai-khoan/* – Figma trang "Web người dùng" (26:3). Tách bundle riêng khỏi website. */
export default function AccountApp() {
  return (
    <Routes>
      <Route element={<AccountLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="*" element={<Suspense fallback={null}><AccountRoutes /></Suspense>} />
      </Route>
    </Routes>
  );
}

function AccountRoutes() {
  return (
    <Routes>
      <Route path="tra-truoc" element={<PrepaidPage />} />
      <Route path="nap-tien" element={<TopupPage />} />
      <Route path="quang-cao" element={<AdsPage />} />
      <Route path="unipay" element={<UnipayPage />} />
      <Route path="bo-cong-thuong" element={<BctPage />} />
      <Route path="may-ban-hang" element={<MisaPage />} />
      <Route path="pos" element={<PosPage />} />
      <Route path="tuong-tac-mxh" element={<SocialPage />} />
      <Route path="hoa-don" element={<InvoicesPage />} />
      <Route path="thong-bao" element={<NotificationsPage />} />
      <Route path="cai-dat" element={<SettingsPage />} />
      <Route path="*" element={<OverviewPage />} />
    </Routes>
  );
}
