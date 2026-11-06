import { asset } from '../../utils/format.js';
import styles from './HeaderButton.module.css';

/**
 * Nút chính góc phải tiêu đề trang (cao 48px, gradient 135°, icon dấu cộng)
 * – Figma "row · Thêm mục giá" (76:823) / "row · Thêm vai trò" (76:983).
 * Khác Button primary trong ui.jsx (44px) nên tách riêng.
 */
export default function HeaderButton({ children, icon = 'admin/icons/plus.svg', ...props }) {
  return (
    <button type="button" className={styles.btn} {...props}>
      <img src={asset(icon)} width="20" height="20" alt="" />
      {children}
    </button>
  );
}
