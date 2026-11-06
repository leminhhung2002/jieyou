import { useState } from 'react';
import { asset } from '../../utils/format.js';
import styles from './ProcessSteps.module.css';

const STEP_W = 322;
const GAP = 16;

/**
 * Figma: Process (68:2743) – "Quy trình". Vệt sáng trên thanh tiến trình
 * di chuyển tới bước đang được trỏ/focus (mặc định bước 1 như thiết kế).
 */
export default function ProcessSteps({ steps, title = 'Quy trình' }) {
  const [active, setActive] = useState(0);
  if (!steps?.length) return null;
  return (
    <section className={styles.section} aria-labelledby="process-title">
      <div className={styles.inner}>
        <h2 id="process-title" className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>
          <div className={styles.track} aria-hidden="true">
            <span className={styles.glow} style={{ transform: `translateX(${active * (STEP_W + GAP)}px)` }} />
          </div>
          <ol className={styles.steps}>
            {steps.map((s, i) => (
              <li
                key={s.n}
                className={styles.step}
                tabIndex={0}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
              >
                <span className={styles.number} style={{ backgroundImage: `url(${asset(`services/common/process-${((s.n - 1) % 4) + 1}.png`)})` }}>
                  {s.n}
                </span>
                <span className={styles.text}>
                  <span className={styles.stepTitle}>{s.title}</span>
                  <span className={styles.stepDesc}>{s.desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
