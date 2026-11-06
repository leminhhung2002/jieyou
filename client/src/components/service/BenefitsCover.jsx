import styles from './BenefitsCover.module.css';

/**
 * Figma: Cover (126:8092 "Lợi ích" / 112:12439 "Cam kết") – nền sao + lưới phối cảnh,
 * huy hiệu ngôi sao bên trái và danh sách dấu tích bên phải.
 * `imageBase`: thư mục chứa cover-*.svg của trang.
 */
export default function BenefitsCover({ title, items, imageBase, id = 'loi-ich' }) {
  if (!items?.length) return null;
  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.grid}>
          <img src={`${imageBase}/cover-grid.svg`} alt="" />
        </div>
        <img className={styles.stars} src={`${imageBase}/cover-stars.svg`} alt="" />
        <div className={`${styles.light} ${styles.light1}`}>
          <div>
            <img src={`${imageBase}/cover-light-1.svg`} alt="" />
          </div>
        </div>
        <div className={`${styles.light} ${styles.light2}`}>
          <div>
            <img src={`${imageBase}/cover-light-2.svg`} alt="" />
          </div>
        </div>
      </div>
      <div className={styles.content}>
        <h2 id={`${id}-title`} className={styles.title}>
          {title}
        </h2>
        <div className={styles.row}>
          <div className={styles.badge}>
            <img src={`${imageBase}/cover-badge.svg`} alt="" />
          </div>
          <ul className={styles.list}>
            {items.map((text) => (
              <li key={text} className={styles.item}>
                <img className={styles.check} src={`${imageBase}/cover-check.svg`} width={38.672} height={30} alt="" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
