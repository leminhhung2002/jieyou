import { Link, useNavigate } from 'react-router-dom';
import { prettyPhone } from '../../components/auth/fields.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Screen } from '../ui.jsx';
import styles from './Lists.module.css';

/** Tab "Cài đặt" – không có frame trong Figma; cài đặt đầy đủ nằm trên Web. */
export default function SettingsPage() {
  useDocumentTitle('Cài đặt – JIEYOU');
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const rows = [
    ['Doanh nghiệp', user?.businessName],
    ['Mã số thuế', user?.taxCode],
    ['Số điện thoại', prettyPhone(user?.phone)],
    ['Email', user?.email],
  ].filter(([, v]) => v);

  const logout = () => {
    signOut();
    navigate('/app/dang-nhap', { replace: true });
  };

  return (
    <Screen className={styles.tabScreen}>
      <div className={styles.content}>
        <h1 className={styles.bigTitle}>Cài đặt</h1>
        <section className={styles.group} aria-label="Tài khoản">
          <h2 className={styles.groupLabel}>Tài khoản</h2>
          <dl className={styles.card}>
            {rows.map(([k, v]) => (
              <div key={k} className={styles.infoRow}>
                <dt className={styles.infoLabel}>{k}</dt>
                <dd className={styles.infoValue}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div className={styles.card}>
          <Link to="/tai-khoan/cai-dat" className={styles.actionRow}>
            Cài đặt đầy đủ trên web
          </Link>
          <button type="button" className={`${styles.actionRow} ${styles.danger}`} onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </div>
    </Screen>
  );
}
