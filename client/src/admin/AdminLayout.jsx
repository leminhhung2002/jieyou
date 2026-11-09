import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from './AdminAuth.jsx';
import { adminApi } from './adminApi.js';
import { asset } from '../utils/format.js';
import styles from './AdminLayout.module.css';

/** Menu trái – Figma "Sidebar" (76:6). `perm`: quyền cần có để thấy mục. */
export const NAV = [
  { key: 'overview', label: 'Tổng quan', to: '/admin', end: true },
  { key: 'applications', label: 'Duyệt hồ sơ', to: '/admin/duyet-ho-so', perm: 'applications', badge: true },
  { key: 'customers', label: 'Khách hàng', to: '/admin/khach-hang', perm: 'customers' },
  { key: 'transactions', label: 'Giao dịch', to: '/admin/giao-dich', perm: 'transactions' },
  { key: 'content', label: 'Nội dung', to: '/admin/noi-dung', perm: 'content' },
  { key: 'smm', label: 'Giá MXH', to: '/admin/gia-mxh', perm: 'content' },
  { key: 'roles', label: 'Phân quyền', to: '/admin/phan-quyen', perm: 'roles' },
  { key: 'logs', label: 'Nhật ký', to: '/admin/nhat-ky', perm: 'roles' },
];

const AdminDataCtx = createContext({ pendingCount: 0, refreshPending: () => {} });
/** Số hồ sơ chờ duyệt (badge ở menu) – gọi refreshPending() sau khi duyệt/từ chối. */
export const useAdminData = () => useContext(AdminDataCtx);

function NavIcon({ name, active }) {
  // Mỗi mục có 2 biến thể icon trong Figma: thường và đang chọn (-active)
  const [src, setSrc] = useState(asset(`admin/nav/${name}${active ? '-active' : ''}.svg`));
  useEffect(() => setSrc(asset(`admin/nav/${name}${active ? '-active' : ''}.svg`)), [name, active]);
  return (
    <img
      src={src}
      width="22"
      height="22"
      alt=""
      onError={() => setSrc(asset(`admin/nav/${name}${active ? '' : '-active'}.svg`))}
    />
  );
}

export default function AdminLayout() {
  const { admin, ready, can, signOut } = useAdminAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(() => {
    adminApi
      .overview()
      .then((d) => setPendingCount(d.stats.pending))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (admin) refreshPending();
  }, [admin, refreshPending]);

  if (!ready) return <div className={styles.app} />;
  if (!admin) return <Navigate to="/admin/dang-nhap" replace state={{ from: location.pathname + location.search }} />;

  const items = NAV.filter((n) => !n.perm || can(n.perm));

  return (
    <AdminDataCtx.Provider value={{ pendingCount, refreshPending }}>
      <div className={styles.app}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <img src={asset('admin/logo.svg')} width="34" height="30" alt="" />
            <span className={styles.brandName}>JIEYOU</span>
            <span className={styles.brandBadge}>ADMIN</span>
          </div>
          <nav aria-label="Quản trị">
            <ul className={styles.nav}>
              {items.map((n) => (
                <li key={n.key}>
                  <NavLink to={n.to} end={n.end} className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}>
                    {({ isActive }) => (
                      <>
                        <NavIcon name={n.key} active={isActive} />
                        <span>{n.label}</span>
                        {n.badge && pendingCount > 0 && (
                          <span className={styles.count} aria-label={`${pendingCount} hồ sơ chờ duyệt`}>
                            {pendingCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.account}>
            <div>
              <p className={styles.accountName}>{admin.name}</p>
              <p className={styles.accountRole}>{admin.role}</p>
            </div>
            <button type="button" className={styles.logout} onClick={signOut}>
              Đăng xuất
            </button>
          </div>
        </aside>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </AdminDataCtx.Provider>
  );
}
