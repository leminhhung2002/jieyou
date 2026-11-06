import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import { useScrollToHash } from './hooks/useScrollToHash.js';

const ServicePage = lazy(() => import('./pages/ServicePage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));
const AccountApp = lazy(() => import('./account/AccountApp.jsx'));
const MobileApp = lazy(() => import('./mobile/MobileApp.jsx'));

export default function App() {
  useScrollToHash();
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f0f13' }} />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dich-vu/:slug" element={<ServicePage />} />
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route path="/dang-ky" element={<RegisterPage />} />
        <Route path="/tai-khoan/*" element={<AccountApp />} />
        <Route path="/app/*" element={<MobileApp />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
