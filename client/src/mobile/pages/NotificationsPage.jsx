import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountApi } from '../../account/accountApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { BackButton, ErrorText, Muted, Screen, fmtDayMonth, fmtTime, isToday } from '../ui.jsx';
import styles from './Lists.module.css';

/** kind → icon 20px (Figma 121:16166 / 16178 / 16193 / 16204). */
const KIND_ICON = { success: 'success', topup: 'success', error: 'error', done: 'done', ads: 'ads' };
const CODE_RE = /\b[A-Z]{2,4}-\d{4}-\d{4}\b/;

// Figma: "Thông báo" (121:16149)
export default function NotificationsPage() {
  useDocumentTitle('Thông báo – JIEYOU');
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    accountApi
      .notifications(undefined, { signal: ctrl.signal })
      .then((res) => setItems(res.data))
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => ctrl.abort();
  }, []);

  const unread = (items || []).filter((n) => !n.read).length;

  async function markAll() {
    setBusy(true);
    try {
      await accountApi.readAll();
      setItems((list) => list.map((n) => ({ ...n, read: true })));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function open(n) {
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      accountApi.read(n.id).catch(() => {});
    }
    const code = `${n.title} ${n.body}`.match(CODE_RE)?.[0];
    if (code && n.category === 'application') navigate(`/app/ho-so/${code}`);
    else if (n.category === 'transaction') navigate('/app/lich-su');
  }

  const today = (items || []).filter((n) => isToday(n.createdAt));
  const earlier = (items || []).filter((n) => !isToday(n.createdAt));

  return (
    <Screen>
      <header className={styles.backRow}>
        <BackButton to="/app" />
      </header>
      <div className={`${styles.content} ${styles.contentAfterBack}`}>
        <div className={styles.titleRow}>
          <h1 className={styles.bigTitle}>Thông báo</h1>
          {unread > 0 && (
            <button type="button" className={styles.titleAction} onClick={markAll} disabled={busy}>
              Đánh dấu đã đọc
            </button>
          )}
        </div>
        <ErrorText>{error}</ErrorText>
        {items && items.length === 0 && <Muted>Chưa có thông báo nào.</Muted>}
        {[
          ['Hôm nay', today],
          ['Trước đó', earlier],
        ].map(
          ([label, list]) =>
            list.length > 0 && (
              <section key={label} className={styles.group} aria-label={label}>
                <h2 className={styles.groupLabel}>{label}</h2>
                <ul className={styles.card}>
                  {list.map((n) => (
                    <li key={n.id}>
                      <button type="button" className={styles.noteRow} onClick={() => open(n)}>
                        <img src={asset(`mobile/thong-bao/${KIND_ICON[n.kind] || 'ads'}.svg`)} width="20" height="20" alt="" />
                        <span className={styles.noteText}>
                          <span className={styles.noteTitle}>{n.title}</span>
                          <span className={styles.noteBody}>{n.body}</span>
                        </span>
                        <span className={styles.noteMeta}>
                          <time className={styles.noteTime} dateTime={n.createdAt}>
                            {isToday(n.createdAt) ? fmtTime(n.createdAt) : fmtDayMonth(n.createdAt)}
                          </time>
                          <span className={`${styles.dot} ${n.read ? styles.dotRead : ''}`}>
                            {!n.read && <span className={styles.srOnly}>Chưa đọc</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
        )}
      </div>
    </Screen>
  );
}
