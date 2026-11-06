import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { asset } from '../../utils/format.js';
import styles from './ServiceHero.module.css';

/**
 * Hero của trang dịch vụ – Figma "background" (68:4288) + "Container" (VD 112:11870).
 * `art`: ảnh minh hoạ bên phải (đã gồm các chip nổi), `artSize`: [w, h] theo Figma.
 * `bg`: nền riêng của trang (mỗi trang dịch vụ trong Figma có một nền khác nhau).
 * `descWidth`: độ rộng đoạn mô tả nếu khác 482px.
 */
export default function ServiceHero({
  serviceName, title, description, art, artSize = [434.94, 468.397], artAlt = '', descWidth, bg,
}) {
  const { user } = useAuth();
  return (
    <section className={styles.hero}>
      <div className={styles.bg} aria-hidden="true">
        {bg ? (
          // Nền riêng của trang: ảnh export nguyên node "background" (đã gồm lưới)
          <img className={styles.customBg} src={bg} alt="" />
        ) : (
          <>
            <img className={styles.glow} src={asset('services/common/hero-bg.png')} alt="" />
            <div className={styles.grid} />
          </>
        )}
      </div>
      <div className={styles.inner}>
        <div className={styles.text}>
          <p className={styles.tag}>
            <span className={styles.tagLabel}>Dịch vụ</span>
            <span>{serviceName}</span>
          </p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.desc} style={descWidth ? { width: descWidth } : undefined}>
            {description}
          </p>
          <div className={styles.ctaRow}>
            {user ? (
              <a href="#bang-gia" className={styles.cta}>
                Đăng ký dịch vụ
              </a>
            ) : (
              <Link to="/dang-ky" state={{ service: serviceName }} className={styles.cta}>
                Đăng ký dịch vụ
              </Link>
            )}
          </div>
        </div>
        {art && (
          <img className={styles.art} src={art} width={artSize[0]} height={artSize[1]} style={{ width: artSize[0], height: artSize[1] }} alt={artAlt} />
        )}
      </div>
    </section>
  );
}
