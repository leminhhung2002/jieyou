import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatVnd } from '../../utils/format.js';
import styles from './MachineCards.module.css';

/**
 * Figma: "Mẫu máy" (126:7933) – các thẻ máy bán hàng: ảnh, giá/tháng, nút Đăng ký, danh sách tính năng.
 * - Chưa đăng nhập: "Đăng ký" dẫn tới /dang-ky kèm { service, plan }.
 * - Đã đăng nhập: chưa có API đặt máy => chỉ đánh dấu máy đã chọn ngay trên trang.
 */
export default function MachineCards({ machines, serviceName, imageBase, title = 'Mẫu máy' }) {
  const { user } = useAuth();
  const [chosen, setChosen] = useState(null);
  if (!machines?.length) return null;
  const chosenMachine = machines.find((m) => m.id === chosen);

  return (
    <section className={styles.section} aria-labelledby="machines-title">
      <div className={styles.inner}>
        <h2 id="machines-title" className={styles.title}>
          {title}
        </h2>
        <ul className={styles.list}>
          {machines.map((m) => {
            const isChosen = chosen === m.id;
            return (
              <li key={m.id} className={styles.card}>
                <img className={styles.image} src={`${imageBase}/${m.image}.png`} width={350} height={350} alt={`Máy bán hàng ${m.name}`} />
                <div className={styles.header}>
                  <div className={styles.nameRow}>
                    <h3 className={styles.name}>{m.name}</h3>
                    {m.popular && <span className={styles.badge}>PHỔ BIẾN NHẤT</span>}
                  </div>
                  <p className={styles.desc}>{m.description}</p>
                </div>
                <span className={styles.divider} aria-hidden="true" />
                <div className={styles.body}>
                  <p className={styles.price}>
                    <span className={styles.amount}>{formatVnd(m.price)}đ</span>
                    <span className={styles.period}>{m.period}</span>
                  </p>
                  <div className={styles.cost}>
                    {user ? (
                      <button
                        type="button"
                        className={styles.cta}
                        aria-pressed={isChosen}
                        onClick={() => setChosen(isChosen ? null : m.id)}
                      >
                        {isChosen ? 'Đã chọn' : 'Đăng ký'}
                      </button>
                    ) : (
                      <Link to="/dang-ky" state={{ service: serviceName, plan: m.name }} className={styles.cta}>
                        Đăng ký
                      </Link>
                    )}
                    <div className={styles.features}>
                      <p className={styles.featuresLabel}>Bạn nhận được:</p>
                      <ul className={styles.featureList}>
                        {m.features.map((f) => (
                          <li key={f.text} className={styles.feature}>
                            <span className={styles.featureIcon}>
                              <img src={`${imageBase}/${f.icon}.svg`} width={20} height={20} alt="" />
                            </span>
                            <span className={styles.featureText}>{f.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {chosenMachine && (
          <p className={styles.status} role="status">
            Đã ghi nhận lựa chọn {chosenMachine.name}. Chúng tôi sẽ liên hệ để hoàn tất đơn hàng.
          </p>
        )}
      </div>
    </section>
  );
}
