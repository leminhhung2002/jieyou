import { useId, useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { fallbackFaqs } from '../data/fallback.js';
import { asset } from '../utils/format.js';
import styles from './Faq.module.css';

/**
 * Figma: S5 (112:11048) – "Giải đáp thắc mắc". Accordion, câu đầu mở sẵn như thiết kế.
 * `items` cho phép trang dịch vụ truyền bộ câu hỏi riêng; mặc định lấy từ API /faqs.
 */
export default function Faq({ items, title = 'Giải đáp thắc mắc', eyebrow = 'FAQ', className = '' }) {
  const remote = useApi((o) => api.faqs(o), [], fallbackFaqs);
  const faqs = items || remote.data;
  const [openId, setOpenId] = useState(faqs[0]?.id ?? null);
  const baseId = useId();

  return (
    <section id="faq" className={`${styles.section} ${className}`} aria-labelledby={`${baseId}-title`}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id={`${baseId}-title`} className={styles.title}>
            {title}
          </h2>
        </div>
        <ul className={styles.list}>
          {faqs.map((f, i) => {
            const open = openId === f.id;
            const panelId = `${baseId}-panel-${f.id}`;
            const btnId = `${baseId}-btn-${f.id}`;
            return (
              <li key={f.id} className={styles.item}>
                {i > 0 && <img className={styles.divider} src={asset('faq/divider.svg')} alt="" aria-hidden="true" />}
                <h3 className={styles.qWrap}>
                  <button
                    id={btnId}
                    type="button"
                    className={styles.question}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenId(open ? null : f.id)}
                  >
                    <span>{f.question}</span>
                    <img src={asset(open ? 'faq/minus.svg' : 'faq/plus.svg')} width="36" height="36" alt="" />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
                >
                  <div className={styles.panelInner}>
                    <p className={styles.answer}>
                      {f.answer}
                      {f.highlight && <strong>{f.highlight}</strong>}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
