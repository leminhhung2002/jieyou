import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { asset, formatVnd } from '../../utils/format.js';
import styles from './PlanCards.module.css';

const ICONS = asset('services/common/plan-icons');

/**
 * Figma: "Gói giá" (112:11428 / 112:11696) – 2 gói cạnh nhau, ngăn bởi đường kẻ dọc mờ.
 * plans = { title, feesLabel, benefitsLabel, items: [{ id, name, description, price, period, note,
 *           popular, fees: [{ icon, text }], benefits: [{ icon, text }] }] }
 * minHeight: chiều cao cố định của section theo Figma (VD trang BCT 852px).
 * Chưa có backend đặt gói: khách -> trang đăng ký (kèm dịch vụ + gói), đã đăng nhập -> đánh dấu gói đã chọn.
 */
export default function PlanCards({ plans, serviceName, id = 'bang-gia', minHeight }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  if (!plans?.items?.length) return null;

  return (
    <section id={id} className={styles.section} style={minHeight ? { minHeight } : undefined} aria-labelledby={`${id}-title`}>
      <div className={styles.glow} aria-hidden="true">
        <img src={asset('services/common/table-glow.png')} alt="" />
        <span />
      </div>
      <h2 id={`${id}-title`} className={styles.title}>
        {plans.title || 'Gói giá'}
      </h2>
      <div className={styles.list}>
        {plans.items.map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && <span className={styles.divider} aria-hidden="true" />}
            <article className={`${styles.plan} ${selected === p.id ? styles.selected : ''}`} aria-labelledby={`plan-${p.id}`}>
              <header className={styles.header}>
                <div className={styles.nameRow}>
                  <h3 id={`plan-${p.id}`}>{p.name}</h3>
                  {p.popular && <span className={styles.badge}>PHỔ BIẾN NHẤT</span>}
                </div>
                <p className={styles.desc}>{p.description}</p>
              </header>
              <span className={styles.rule} aria-hidden="true" />
              <div className={styles.priceInfo}>
                <div className={styles.priceBox}>
                  <p className={styles.price}>
                    <span className={styles.amount}>{formatVnd(p.price)}đ</span>
                    <span className={styles.period}>{p.period}</span>
                  </p>
                  {p.note && <p className={styles.note}>{p.note}</p>}
                </div>
                <div className={styles.cost}>
                  {user ? (
                    <button
                      type="button"
                      className={styles.cta}
                      aria-pressed={selected === p.id}
                      onClick={() => setSelected(p.id)}
                    >
                      Đăng ký
                    </button>
                  ) : (
                    <Link to="/dang-ky" state={{ service: serviceName, plan: p.name }} className={styles.cta}>
                      Đăng ký
                    </Link>
                  )}

                  {p.fees?.length > 0 && (
                    <div className={styles.fees}>
                      <p className={styles.label}>{plans.feesLabel}</p>
                      <ul>
                        {p.fees.map((f) => (
                          <li key={f.text}>
                            <span className={`${styles.circle} ${styles.circleLg}`}>
                              <img src={`${ICONS}/${f.icon}.svg`} width={20} height={20} alt="" />
                            </span>
                            <span>{f.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {p.benefits?.length > 0 && (
                    <div className={styles.benefits}>
                      <p className={styles.label}>{plans.benefitsLabel}</p>
                      <ul>
                        {p.benefits.map((b) => (
                          <li key={b.text}>
                            <span className={styles.circle}>
                              <img src={`${ICONS}/${b.icon}.svg`} width={20} height={20} alt="" />
                            </span>
                            <span>{b.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </article>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
