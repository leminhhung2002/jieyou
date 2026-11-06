import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MobileLayout, { GuestOnly, RequireAuth, TabLayout } from './MobileLayout.jsx';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const TopupPage = lazy(() => import('./pages/TopupPage.jsx'));
const TopupSuccessPage = lazy(() => import('./pages/TopupSuccessPage.jsx'));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage.jsx'));
const ApplicationDetailPage = lazy(() => import('./pages/ApplicationDetailPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'));
const HistoryPage = lazy(() => import('./pages/HistoryPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));

/** App mobile /app/* – Figma trang "App Mobile" (section 121:15746). Dùng chung auth + /api/account với Web. */
export default function MobileApp() {
  return (
    <Routes>
      <Route element={<MobileLayout />}>
        <Route path="dang-nhap" element={<Lazy><GuestOnly><LoginPage /></GuestOnly></Lazy>} />
        <Route path="dang-ky" element={<Lazy><GuestOnly><RegisterPage /></GuestOnly></Lazy>} />
        <Route element={<RequireAuth />}>
          <Route element={<TabLayout />}>
            <Route index element={<Lazy><HomePage /></Lazy>} />
            <Route path="lich-su" element={<Lazy><HistoryPage /></Lazy>} />
            <Route path="ho-so" element={<Lazy><ApplicationsPage /></Lazy>} />
            <Route path="cai-dat" element={<Lazy><SettingsPage /></Lazy>} />
          </Route>
          <Route path="nap-tien" element={<Lazy><TopupPage /></Lazy>} />
          <Route path="nap-tien/thanh-cong" element={<Lazy><TopupSuccessPage /></Lazy>} />
          <Route path="ho-so/:code" element={<Lazy><ApplicationDetailPage /></Lazy>} />
          <Route path="thong-bao" element={<Lazy><NotificationsPage /></Lazy>} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  );
}

function Lazy({ children }) {
  return <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#f7f8fa' }} />}>{children}</Suspense>;
}
