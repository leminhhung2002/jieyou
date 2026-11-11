import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { asset } from '../utils/format.js';
import { accountApi } from './accountApi.js';
import { Toast } from '../admin/ui.jsx';
import styles from './AccountLayout.module.css';

/** Menu trái – Figma "Sidebar" (74:1997). `icon`: tên file trong /assets/account/nav (+ "-active"). */
export const NAV_GROUPS = [
  {
    items: [
      { icon: 'overview', label: 'Tổng quan', to: '/tai-khoan', end: true },
      { icon: 'prepaid', label: 'Tài khoản trả trước', to: '/tai-khoan/tra-truoc', also: ['/tai-khoan/nap-tien'] },
    ],
  },
  {
    title: 'Dịch vụ',
    items: [
      { icon: 'ads', label: 'Quảng cáo trên sàn', to: '/tai-khoan/quang-cao' },
      { icon: 'unipay', label: 'Tài khoản UniPay', to: '/tai-khoan/unipay' },
      { icon: 'bct', label: 'Hồ sơ Bộ Công Thương', to: '/tai-khoan/bo-cong-thuong' },
      { icon: 'misa', label: 'Máy bán hàng + 1INVOICE', to: '/tai-khoan/may-ban-hang' },
      { icon: 'pos', label: 'Cổng thanh toán POS', to: '/tai-khoan/pos' },
      { icon: 'social', label: 'Tăng tương tác MXH', to: '/tai-khoan/tuong-tac-mxh' },
      { icon: 'webapp', label: 'Làm app/web', to: '/tai-khoan/lam-app-web' },
      { icon: 'license', label: 'Key bản quyền', to: '/tai-khoan/key-ban-quyen' },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { icon: 'invoices', label: 'Hóa đơn', to: '/tai-khoan/hoa-don' },
      { icon: 'notifications', label: 'Thông báo', to: '/tai-khoan/thong-bao' },
      { icon: 'settings', label: 'Cài đặt', to: '/tai-khoan/cai-dat' },
    ],
  },
];

const AccountCtx = createContext(null);

/**
 * Dữ liệu dùng chung của Web người dùng: `summary` (user, stats, hồ sơ gần đây, số thông báo chưa đọc),
 * `refresh()` – gọi sau khi nạp tiền / gửi hồ sơ / đọc thông báo để số dư & badge cập nhật,
 * `catalog` – bảng giá & danh mục cho các form đặt dịch vụ, `toast(message, tone)` – thông báo nhỏ góc dưới.
 */
export const useAccount = () => useContext(AccountCtx);

const COLLAPSE_KEY = 'jieyou.sidebarCollapsed';

export default function AccountLayout() {
  const { user, ready, signOut } = useAuth();
  const location = useLocation();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [toastState, setToastState] = useState({ message: '', tone: 'success' });
  const toast = useCallback((message, tone = 'success') => setToastState({ message, tone }), []);
  const clearToast = useCallback(() => setToastState((t) => ({ ...t, message: '' })), []);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  const refresh = useCallback(
    () =>
      accountApi
        .summary()
        .then((s) => {
          setSummary(s);
          setError(null);
          return s;
        })
        .catch((e) => {
          setError(e);
          if (e.status === 401) signOut();
        }),
    [signOut],
  );

  useEffect(() => {
    if (!user) return;
    refresh();
    accountApi.catalog().then(setCatalog).catch(() => {});
  }, [user, refresh]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      return !c;
    });

  if (!ready) return <div className={styles.app} />;
  if (!user) return <Navigate to="/dang-nhap" replace state={{ from: location.pathname + location.search }} />;

  return (
    <AccountCtx.Provider value={{ summary, refresh, error, catalog, toast }}>
      <div className={`${styles.app} ${collapsed ? styles.collapsed : ''}`}>
        <aside className={styles.sidebar}>
          <div className={styles.brandRow}>
            <Link to="/" className={styles.brand} aria-label="JIEYOU – Trang chủ">
              <img src={asset('account/logo.svg')} width="34" height="30" alt="" />
              <span className={styles.brandName}>JIEYOU</span>
            </Link>
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
              aria-expanded={!collapsed}
            >
              <img src={asset('account/ui/collapse.svg')} width="20" height="20" alt="" />
            </button>
          </div>
          <nav aria-label="Tài khoản" className={styles.nav}>
            {NAV_GROUPS.map((g, gi) => (
              <div key={gi} className={styles.group}>
                {g.title && <p className={styles.groupTitle}>{g.title}</p>}
                <ul className={styles.list}>
                  {g.items.map((n) => (
                    <li key={n.to}>
                      <NavLink
                        to={n.to}
                        end={n.end}
                        title={collapsed ? n.label : undefined}
                        className={({ isActive }) => `${styles.item} ${isActive || n.also?.includes(location.pathname) ? styles.active : ''}`}
                      >
                        {({ isActive: exact }) => {
                          const isActive = exact || n.also?.includes(location.pathname);
                          return (
                          <>
                            <img src={asset(`account/nav/${n.icon}${isActive ? '-active' : ''}.svg`)} width="22" height="22" alt="" />
                            <span className={styles.label}>{n.label}</span>
                          </>
                          );
                        }}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          {/* Không có trong Figma – cần để đăng xuất */}
          <div className={styles.account}>
            <div className={styles.accountText}>
              <p className={styles.accountName}>{summary?.user.businessName || user.businessName}</p>
              <p className={styles.accountSub}>{summary?.user.taxCode ? `MST ${summary.user.taxCode}` : user.phone}</p>
            </div>
            <button type="button" className={styles.logout} onClick={signOut}>
              Đăng xuất
            </button>
          </div>
        </aside>
        <main className={styles.main}>
          {error && !summary ? (
            <p className={styles.loadError} role="alert">
              {error.message}.{' '}
              <button type="button" onClick={refresh}>
                Thử lại
              </button>
            </p>
          ) : (
            <Outlet />
          )}
        </main>
        <Toast message={toastState.message} tone={toastState.tone} onDone={clearToast} />
      </div>
    </AccountCtx.Provider>
  );
}
