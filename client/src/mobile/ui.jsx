import { Link, useNavigate } from 'react-router-dom';
import { asset, formatVnd } from '../utils/format.js';
import styles from './ui.module.css';

/* ---------- định dạng ---------- */
const TZ = 'Asia/Ho_Chi_Minh';
const parts = (iso, opts) => new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, ...opts }).format(new Date(iso));

export const vnd = (n) => `${formatVnd(n || 0)} đ`;
/** 14:32 */
export const fmtTime = (iso) => parts(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
/** 20/10/2026 */
export const fmtDate = (iso) => parts(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
/** 20/10 */
export const fmtDayMonth = (iso) => fmtDate(iso).slice(0, 5);
/** 12:00 - 20/10/2026 (định dạng trong Figma 121:16061) */
export const fmtDateTime = (iso) => `${fmtTime(iso)} - ${fmtDate(iso)}`;
export const isToday = (iso) => fmtDate(iso) === fmtDate(new Date().toISOString());

/* ---------- dữ liệu dùng chung ---------- */

/** Trang dịch vụ trên Web theo loại hồ sơ (đặt hàng thực hiện trên Web). */
export const SERVICE_PAGES = {
  ads: '/tai-khoan/quang-cao',
  unipay: '/tai-khoan/unipay',
  bct: '/tai-khoan/bo-cong-thuong',
  misa: '/tai-khoan/may-ban-hang',
  pos: '/tai-khoan/pos',
  social: '/tai-khoan/tuong-tac-mxh',
};

/** Trạng thái hồ sơ → nhãn + màu chữ (Figma 121:16014 / 121:16026 / 121:16038) + badge trên icon. */
export const STATUS = {
  approved: { label: 'Hoàn thành', className: styles.stApproved, badge: 'badge-check', badgeClass: styles.badgeApproved },
  rejected: { label: 'Từ chối', className: styles.stRejected, badge: 'badge-x', badgeClass: styles.badgeRejected },
  pending: { label: 'Chờ duyệt', className: styles.stPending, badge: 'badge-pending', badgeClass: styles.badgePending },
};

/**
 * Icon loại hồ sơ trong ô tròn 40px. Glyph & màu nền theo Figma (121:16004/16016/16028, 121:17526).
 * UniPay / MXH chưa có glyph trong frame App → dùng icon menu của Web (account/nav) tô trắng.
 */
const TYPE_ICON = {
  ads: { src: 'mobile/home/ads.svg', size: 22, bg: '#009dd2' },
  bct: { src: 'mobile/ho-so/bct.svg', size: 20, bg: '#30a46c' },
  misa: { src: 'mobile/ho-so/misa.svg', size: 20, bg: '#12a594' },
  pos: { src: 'mobile/ho-so/pos.svg', size: 20, bg: '#00a2c7' },
  unipay: { src: 'account/nav/unipay.svg', size: 22, bg: '#3e63dd', tint: true },
  social: { src: 'account/nav/social.svg', size: 22, bg: '#e93d82', tint: true },
};

export function AppTypeIcon({ type, status, badge = true }) {
  const t = TYPE_ICON[type] || TYPE_ICON.ads;
  const st = STATUS[status];
  return (
    <span className={styles.typeIcon} style={{ background: t.bg }} aria-hidden="true">
      <img
        src={asset(t.src)}
        width={t.size}
        height={t.size}
        alt=""
        className={t.tint ? styles.tintWhite : undefined}
      />
      {badge && st && (
        <span className={`${styles.badge} ${st.badgeClass}`}>
          <img
            src={asset(`mobile/ho-so/${st.badge}.svg`)}
            width={st.badge === 'badge-pending' ? 8 : 6.857}
            height={st.badge === 'badge-pending' ? 8 : 6.857}
            alt=""
          />
        </span>
      )}
    </span>
  );
}

export function StatusText({ status, className = '' }) {
  const st = STATUS[status] || STATUS.pending;
  return <span className={`${st.className} ${className}`}>{st.label}</span>;
}

/* ---------- khung ---------- */

/** Nút tròn 36px (Figma "icon button" 47:12756) với mũi tên quay lại. */
export function BackButton({ to = '/app', label = 'Quay lại' }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate(to, { replace: true });
  };
  return (
    <button type="button" className={styles.iconBtn} onClick={goBack} aria-label={label}>
      <img src={asset('mobile/ui/arrow-left.svg')} width="20" height="20" alt="" />
    </button>
  );
}

/** Thanh tiêu đề 52px: nút quay lại + tiêu đề căn giữa (Figma 121:15838). */
export function TopBar({ title, backTo }) {
  return (
    <header className={styles.topBar}>
      <BackButton to={backTo} />
      {title && <h1 className={styles.topTitle}>{title}</h1>}
    </header>
  );
}

/** Màn hình con: nền + vùng an toàn phía trên. */
export function Screen({ tone = 'subtle', className = '', children }) {
  return <div className={`${styles.screen} ${styles[tone]} ${className}`}>{children}</div>;
}

/** Thanh hành động cố định đáy (Figma "BottomActionBar" 121:15773 / 121:15906). */
export function BottomBar({ panel = false, children }) {
  return (
    <div className={`${styles.bottomBar} ${panel ? styles.bottomPanel : styles.bottomPlain}`}>{children}</div>
  );
}

/** Nút chính 48px (Figma component "btn" 66:736). */
export function PrimaryButton({ to, loading, children, className = '', ...props }) {
  const cls = `${styles.btn} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} disabled={loading || props.disabled} aria-busy={loading || undefined} {...props}>
      {loading ? 'Đang xử lý…' : children}
    </button>
  );
}

export function Muted({ children }) {
  return <p className={styles.muted}>{children}</p>;
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p className={styles.error} role="alert">
      {children}
    </p>
  );
}

/** Hiển thị mã OTP ở môi trường dev (server trả devCode khi không phải production). */
export function DevCode({ code }) {
  if (!code || import.meta.env.PROD) return null;
  return <p className={styles.devCode}>[DEV] Mã OTP: {code}</p>;
}

export { styles as uiStyles };
