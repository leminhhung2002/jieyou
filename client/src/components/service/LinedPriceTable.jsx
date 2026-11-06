import PriceTable from './PriceTable.jsx';
import styles from './LinedPriceTable.module.css';

/**
 * Bọc PriceTable cho các bảng giá có đường kẻ gradient (Line 36) và không có kẻ đôi
 * dưới hàng cuối – Figma 126:8063 (MISA) và 112:12400 (MXH).
 */
export default function LinedPriceTable(props) {
  return (
    <div className={styles.wrap}>
      <PriceTable {...props} />
    </div>
  );
}
