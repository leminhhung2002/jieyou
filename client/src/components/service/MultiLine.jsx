import { Fragment } from 'react';
import styles from './MultiLine.module.css';

/**
 * Hiển thị chuỗi có "\n" (từ API) thành các dòng ngắt đúng như thiết kế.
 * Trên màn hình rộng mỗi dòng không tự xuống hàng; dưới 1100px trở lại wrap bình thường.
 */
export default function MultiLine({ text }) {
  if (typeof text !== 'string' || !text.includes('\n')) return text ?? null;
  const lines = text.split('\n');
  return lines.map((line, i) => (
    <Fragment key={i}>
      <span className={styles.line}>{line}</span>
      {i < lines.length - 1 && <br />}
    </Fragment>
  ));
}
