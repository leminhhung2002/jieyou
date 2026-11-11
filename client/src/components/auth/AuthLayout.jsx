import { Link } from 'react-router-dom';
import { asset } from '../../utils/format.js';
import styles from './Auth.module.css';

const FEATURES = [
  ['ic-ads', 'Quảng cáo trên sàn'],
  ['ic-bct', 'Hồ sơ Bộ Công Thương'],
  ['ic-misa', 'Máy bán hàng và hóa đơn 1INVOICE'],
];

/**
 * Khung 2 cột của màn Đăng ký / Đăng nhập (Figma section "Đăng nhập/ Đăng ký").
 * `wide` = cột trái rộng hơn (700px – màn Đăng ký), mặc định 640px (màn Đăng nhập).
 */
export default function AuthLayout({ wide = false, children }) {
  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        <aside className={`${styles.panel} ${wide ? styles.panelWide : ''}`}>
          <img
            className={wide ? styles.panelBg : styles.panelBgLogin}
            src={asset(wide ? 'auth/panel-bg.png' : 'auth/panel-bg-login.png')}
            alt=""
            aria-hidden="true"
          />
          <Link to="/" className={styles.brand} aria-label="JIEYOU – Trang chủ">
            <img src={asset('auth/logo.svg')} width="64" height="56" alt="" />
            <span className={styles.brandText}>
              <span className={styles.brandName}>JIEYOU</span>
              <span className={styles.brandSub}>AGENCY</span>
            </span>
          </Link>
          <h2 className={styles.panelTitle}>Một nơi cho mọi dịch vụ doanh nghiệp.</h2>
          <ul className={styles.features}>
            {FEATURES.map(([icon, label]) => (
              <li key={icon}>
                <img src={asset(`auth/${icon}.svg`)} width="22" height="22" alt="" />
                {label}
              </li>
            ))}
          </ul>
        </aside>
        <main className={styles.main}>
          <div className={styles.card}>{children}</div>
        </main>
      </div>
    </div>
  );
}
