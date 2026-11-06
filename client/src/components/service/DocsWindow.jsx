import { asset } from '../../utils/format.js';
import styles from './DocsWindow.module.css';

const BASE = asset('services/common/docs');

/**
 * Figma: section "mac-line" (VD 112:11580) – cửa sổ kiểu macOS liệt kê hồ sơ/giấy tờ (biểu tượng thư mục).
 * docs = { title, items: [{ id, label, width? }] } – width: độ rộng khung chữ theo Figma (tuỳ chọn).
 * gap: khoảng cách giữa các mục (UniPay/POS 61px, BCT 54px); labelWeight: 'regular' | 'medium'.
 */
export default function DocsWindow({ docs, id = 'ho-so', gap = 61, labelWeight = 'medium' }) {
  if (!docs?.items?.length) return null;
  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.bg} aria-hidden="true">
        <img src={`${BASE}/docs-bg.png`} alt="" />
      </div>
      <div className={styles.window}>
        <div className={styles.bar}>
          <img className={styles.dots} src={`${BASE}/docs-dots.svg`} width={50} height={14} alt="" aria-hidden="true" />
          <h2 id={`${id}-title`} className={styles.title}>
            {docs.title}
          </h2>
          {/* Nút điều hướng chỉ mang tính trang trí của khung cửa sổ */}
          <span className={styles.nav} aria-hidden="true">
            <span className={styles.navBtn}>
              <img src={`${BASE}/docs-arrow-left.svg`} width={16} height={16} alt="" />
            </span>
            <span className={styles.navBtn}>
              <img src={`${BASE}/docs-arrow-right.svg`} width={16} height={16} alt="" />
            </span>
          </span>
        </div>

        <div className={styles.glows} aria-hidden="true">
          <img className={styles.glowCore} src={`${BASE}/docs-glow-core.svg`} alt="" />
          <img className={styles.glowLine1} src={`${BASE}/docs-glow-line1.svg`} alt="" />
          <img className={styles.glowLine2} src={`${BASE}/docs-glow-line2.svg`} alt="" />
        </div>

        <ul className={`${styles.items} ${labelWeight === 'regular' ? styles.regular : ''}`} style={{ gap }}>
          {docs.items.map((d) => (
            <li key={d.id} style={d.width ? { width: d.width } : undefined}>
              <img className={styles.folder} src={`${BASE}/docs-folder.png`} alt="" />
              <span>{d.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
