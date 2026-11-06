import { asset } from '../../utils/format.js';
import styles from './PriceTable.module.css';

/**
 * Figma: Pricing (112:11988) – bảng giá dạng bảng 3 cột, nền có vệt sáng.
 * table = { title, columns: [c1, c2, c3], rows: [[v1, v2, v3], ...] }
 * staggered: cột cuối lệch xuống 1 dòng (chỉ trang Quảng cáo)
 */
export default function PriceTable({ table, id = 'bang-gia', staggered = false }) {
  if (!table?.rows?.length) return null;
  const align = (i, n) => (i === 0 ? styles.left : i === n - 1 ? styles.right : styles.center);
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.glow} aria-hidden="true">
        <img src={asset('services/common/table-glow.png')} alt="" />
        <span />
      </div>
      <div className={styles.inner}>
        <h2 id={`${id}-title`} className={styles.title}>
          {table.title || 'Bảng giá'}
        </h2>
        <table className={`${styles.table} ${staggered ? styles.staggered : ''}`}>
          <thead>
            <tr>
              {table.columns.map((c, i) => (
                <th key={c} scope="col" className={align(i, table.columns.length)}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className={styles.left}>
                      {cell}
                    </th>
                  ) : (
                    <td key={i} className={align(i, row.length)}>
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
