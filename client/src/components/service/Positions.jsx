import styles from './Positions.module.css';

/** Figma: S5 "Vị trí" (112:11882) – các vị trí hiển thị quảng cáo. */
export default function Positions({ items, imageBase, title = 'Vị trí' }) {
  if (!items?.length) return null;
  return (
    <section className={styles.section} aria-labelledby="positions-title">
      <h2 id="positions-title" className={styles.title}>
        {title}
      </h2>
      <ul className={styles.list}>
        {items.map((p) => (
          <li key={p.id} className={styles.card}>
            <img className={styles.mock} src={`${imageBase}/${p.image}.png`} alt={`Minh hoạ vị trí ${p.name}`} />
            <div className={styles.text}>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
