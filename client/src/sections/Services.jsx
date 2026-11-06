import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { fallbackServices } from '../data/fallback.js';
import ServiceIcon from '../components/ServiceIcon.jsx';
import styles from './Services.module.css';

// Figma: Container (112:10510) – "Đa dạng dịch vụ, một nơi quản lý"
export default function Services() {
  const { data: services } = useApi((o) => api.services(o), [], fallbackServices);

  return (
    <section id="dich-vu" className={styles.section} aria-labelledby="services-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <h2 id="services-title" className={styles.title}>
            Đa dạng dịch vụ, một nơi quản lý
          </h2>
          <p className={styles.sub}>Chọn dịch vụ bạn cần, gửi hồ sơ và theo dõi trạng thái ngay trong tài khoản.</p>
        </div>
        <ul className={styles.grid}>
          {services.map((s, i) => (
            <li key={s.slug || `soon-${i}`} className={styles.card}>
              <ServiceIcon name={s.icon} />
              <div className={styles.text}>
                <h3 className={styles.name}>{s.name}</h3>
                <p className={styles.desc}>{s.description}</p>
              </div>
              {s.slug ? (
                <Link to={`/dich-vu/${s.slug}`} className={styles.more}>
                  Tìm hiểu thêm
                  <span className="sr-only"> về {s.name}</span>
                </Link>
              ) : (
                <span className={styles.more} aria-disabled="true" title="Sắp ra mắt">
                  Tìm hiểu thêm
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
