import styles from './FeatureGrid.module.css';

/**
 * Figma: "Tính năng" (112:11175) – lưới 3 cột thẻ tính năng có icon minh hoạ.
 * features = { title, items: [{ id, name, description, icon }] }, icon = tên file PNG trong imageBase.
 */
export default function FeatureGrid({ features, imageBase, id = 'tinh-nang' }) {
  if (!features?.items?.length) return null;
  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>
        {features.title || 'Tính năng'}
      </h2>
      <ul className={styles.grid}>
        {features.items.map((f) => (
          <li key={f.id} className={styles.card}>
            {/* Icon export 2x từ Figma (80×80) */}
            <img className={styles.icon} src={`${imageBase}/${f.icon}.png`} width={80} height={80} alt="" />
            <div className={styles.text}>
              <h3>{f.name}</h3>
              <p>{f.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
