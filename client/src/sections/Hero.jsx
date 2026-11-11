import { Link } from 'react-router-dom';
import { asset } from '../utils/format.js';
import styles from './Hero.module.css';

// Figma: Gradient Backgrounds 04 (112:10423) + Container (112:10447)
export default function Hero() {
  return (
    <section className={styles.hero}>
      <img className={styles.bg} src={asset('hero/bg.png')} alt="" aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.content}>
          <div className={styles.group}>
            <p className={styles.badge}>
              <span className={styles.badgeNew}>Mới</span>
              <span>Sàn Dịch vụ Doanh nghiệp</span>
            </p>
            <h1 className={styles.title}>
              <span>Mọi dịch vụ doanh nghiệp</span>
              <span>một tài khoản.</span>
            </h1>
            <p className={styles.lead}>
              Quảng cáo, Hồ sơ Bộ Công Thương, Máy bán hàng, Hóa đơn MISA và nhiều hơn nữa. Nạp tiền một lần, dùng cho
              mọi dịch vụ.
            </p>
          </div>
          <div className={styles.ctas}>
            <Link to="/dang-ky" className={styles.ctaDark}>
              Đăng ký miễn phí
            </Link>
            <a href="#bang-gia" className={styles.ctaLight}>
              Xem bảng giá
            </a>
          </div>
        </div>

        <div className={styles.preview}>
          <img
            src={asset('hero/dashboard.png')}
            width="956"
            height="597"
            alt="Bảng điều khiển tài khoản JIEYOU: số dư khả dụng, dịch vụ và hồ sơ gần đây"
          />
        </div>

        <div className={styles.fade} aria-hidden="true" />
      </div>
    </section>
  );
}
