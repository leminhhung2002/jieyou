import { useEffect } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { asset } from '../utils/format.js';
import styles from './MobileLayout.module.css';

/**
 * Khung App mobile: cột nội dung tối đa 430px căn giữa (nền xám nhạt bên ngoài trên màn hình lớn),
 * bật viewport-fit=cover để dùng env(safe-area-inset-*).
 */
export default function MobileLayout() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const prevViewport = meta?.getAttribute('content');
    if (meta && !/viewport-fit/.test(prevViewport || '')) meta.setAttribute('content', `${prevViewport}, viewport-fit=cover`);
    const prevBg = document.body.style.background;
    document.body.style.background = '#e9eaee';
    return () => {
      if (meta && prevViewport) meta.setAttribute('content', prevViewport);
      document.body.style.background = prevBg;
    };
  }, []);

  return (
    <div className={styles.shell}>
      <div className={styles.column}>
        <Outlet />
      </div>
    </div>
  );
}

/** Màn hình cần đăng nhập → chuyển về /app/dang-nhap (giữ `from`). */
export function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className={styles.blank} />;
  if (!user) return <Navigate to="/app/dang-nhap" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Màn hình đăng nhập / đăng ký: đã đăng nhập thì vào App. */
export function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className={styles.blank} />;
  if (user) return <Navigate to={location.state?.from || '/app'} replace />;
  return children;
}

const TABS = [
  { to: '/app', end: true, icon: 'house', label: 'Trang chủ' },
  { to: '/app/lich-su', icon: 'clock', label: 'Lịch sử giao dịch' },
  { to: '/app/ho-so', end: true, icon: 'files', label: 'Hồ sơ của tôi' },
  { to: '/app/cai-dat', icon: 'gear', label: 'Cài đặt' },
];

/** Màn hình có thanh tab đáy (Figma "BottomActionBar" 121:17545). */
export function TabLayout() {
  return (
    <>
      <Outlet />
      <nav className={styles.tabBar} aria-label="Điều hướng chính">
        <div className={styles.tabPill}>
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              aria-label={t.label}
              className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
            >
              <img src={asset(`mobile/ui/${t.icon}.svg`)} data-tone={t.icon === 'house' ? 'light' : 'dark'} width="20" height="20" alt="" />
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
