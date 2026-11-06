import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AdminAuthProvider } from './AdminAuth.jsx';
import AdminLayout from './AdminLayout.jsx';
import OverviewPage from './pages/OverviewPage.jsx';

const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage.jsx'));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage.jsx'));
const CustomersPage = lazy(() => import('./pages/CustomersPage.jsx'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage.jsx'));
const ContentPage = lazy(() => import('./pages/ContentPage.jsx'));
const RolesPage = lazy(() => import('./pages/RolesPage.jsx'));
const LogsPage = lazy(() => import('./pages/LogsPage.jsx'));

/** Khu vực quản trị /admin/* (tách bundle riêng khỏi website). */
export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#edf2f3' }} />}>
        <Routes>
          <Route path="dang-nhap" element={<AdminLoginPage />} />
          <Route element={<AdminLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="duyet-ho-so" element={<ApplicationsPage />} />
            <Route path="khach-hang" element={<CustomersPage />} />
            <Route path="giao-dich" element={<TransactionsPage />} />
            <Route path="noi-dung" element={<ContentPage />} />
            <Route path="phan-quyen" element={<RolesPage />} />
            <Route path="nhat-ky" element={<LogsPage />} />
            <Route path="*" element={<OverviewPage />} />
          </Route>
        </Routes>
      </Suspense>
    </AdminAuthProvider>
  );
}
