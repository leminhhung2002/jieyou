import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { fallbackPricing } from '../data/fallback.js';
import { asset, formatVnd } from '../utils/format.js';
import styles from './Pricing.module.css';

// Figma: S8 - Pricing (112:10985) – "Dùng dịch vụ nào, trả tiền dịch vụ đó."
export default function Pricing() {
  const { data: items } = useApi((o) => api.pricing(o), [], fallbackPricing);

  return (
    <section id="bang-gia" className={styles.section} aria-labelledby="pricing-title">
      <img className={styles.beam} src={asset('pricing/beam.svg')} alt="" aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.head}>
          <h2 id="pricing-title" className={styles.title}>
            <span>Dùng dịch vụ nào,</span>
            <span>trả tiền dịch vụ đó.</span>
          </h2>
          <p className={styles.sub}>Giá lấy trực tiếp từ Bảng giá trong Admin, cập nhật ngay khi xuất bản.</p>
        </div>

        <div className={styles.options}>
          <ul className={styles.cards}>
            {items.map((p) => (
              <li key={p.id} className={styles.card}>
                <div className={styles.details}>
                  <h3 className={styles.name}>{p.name}</h3>
                  <p className={styles.price}>
                    <span className={styles.from}>Từ </span>
                    <span className={styles.amount}>{formatVnd(p.fromPrice)} đ</span>
                    <span className={styles.unit}>{p.unit}</span>
                  </p>
                </div>
                <img className={styles.dot} src={asset('pricing/card-dot.svg')} width="44" height="44" alt="" />
              </li>
            ))}
          </ul>

          <div className={styles.folder} aria-hidden="true">
            <div className={styles.folderBody} />
            <div className={styles.folderTab} />
            <div className={styles.folderBlur} />
            <img className={styles.folderGlass} src={asset('pricing/folder-glass.svg')} alt="" />
            <span className={styles.folderLine1}>
              <span className={styles.lineInner1}>
                <img src={asset('pricing/folder-line1.svg')} alt="" />
              </span>
            </span>
            <span className={styles.folderLine2}>
              <span className={styles.lineInner2}>
                <img src={asset('pricing/folder-line2.svg')} alt="" />
              </span>
            </span>
          </div>

          <div className={styles.ctaWrap}>
            <Link to="/#dich-vu" className={styles.cta}>
              Xem bảng giá đầy đủ
              <img src={asset('pricing/arrow-right.svg')} width="24" height="24" alt="" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
