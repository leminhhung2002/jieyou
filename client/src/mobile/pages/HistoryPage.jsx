import { useEffect, useState } from 'react';
import { accountApi } from '../../account/accountApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatVnd } from '../../utils/format.js';
import { ErrorText, Muted, Screen, fmtDate, fmtTime } from '../ui.jsx';
import styles from './Lists.module.css';

/** Loại giao dịch → nhãn (giống trang Tài khoản trả trước trên Web). */
const KIND = { topup: 'Nạp tiền', held: 'Tạm giữ', charged: 'Đã trừ', refund: 'Hoàn tiền' };

/** Tab "Lịch sử" – không có frame trong Figma, dùng cùng kiểu dòng với Thông báo / Hồ sơ. */
export default function HistoryPage() {
  useDocumentTitle('Lịch sử giao dịch – JIEYOU');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    accountApi
      .transactions({}, { signal: ctrl.signal })
      .then((res) => setRows(res.data))
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => ctrl.abort();
  }, []);

  return (
    <Screen className={styles.tabScreen}>
      <div className={styles.content}>
        <h1 className={styles.bigTitle}>Lịch sử giao dịch</h1>
        <ErrorText>{error}</ErrorText>
        {rows && rows.length === 0 && <Muted>Chưa có giao dịch nào.</Muted>}
        {rows && rows.length > 0 && (
          <ul className={styles.card}>
            {rows.map((t) => (
              <li key={t.id} className={styles.txRow}>
                <span className={styles.noteText}>
                  <span className={styles.noteTitle}>{t.description}</span>
                  <span className={styles.noteBody}>
                    {KIND[t.kind] || t.kind} · {t.id}
                  </span>
                </span>
                <span className={styles.txMeta}>
                  <span className={`${styles.txAmount} ${t.amount > 0 ? styles.txPlus : ''}`}>
                    {t.amount > 0 ? '+' : '−'}
                    {formatVnd(Math.abs(t.amount))} đ
                  </span>
                  <time className={styles.noteTime} dateTime={t.createdAt}>
                    {fmtTime(t.createdAt)} {fmtDate(t.createdAt)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}
