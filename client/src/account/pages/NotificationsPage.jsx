import { useCallback, useEffect, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { relativeDay } from '../../admin/format.js';
import { FilterChips } from '../../admin/ui.jsx';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import { OutlineButton, PageHeader } from '../ui.jsx';
import styles from './NotificationsPage.module.css';

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unread', label: 'Chưa đọc' },
  { value: 'transaction', label: 'Giao dịch' },
  { value: 'application', label: 'Hồ sơ' },
];

const EMPTY = {
  all: 'Bạn chưa có thông báo nào.',
  unread: 'Không có thông báo chưa đọc.',
  transaction: 'Chưa có thông báo giao dịch.',
  application: 'Chưa có thông báo hồ sơ.',
};

/** kind → ô biểu tượng 44px (Figma 74:3855, 74:3867, 74:3879, 74:3891, 74:3903). */
const KIND = {
  success: { icon: 'success', tone: 'green' },
  error: { icon: 'error', tone: 'red' },
  ads: { icon: 'ads', tone: 'teal' },
  pending: { icon: 'ads', tone: 'teal' },
  done: { icon: 'done', tone: 'green' },
  topup: { icon: 'topup', tone: 'teal' },
};

const pad = (n) => String(n).padStart(2, '0');

/** "14:32 hôm nay" cho hôm nay, còn lại "dd/mm". */
function timeLabel(iso) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return relativeDay(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

// Figma: Web người dùng: Thông báo (74:3756)
export default function NotificationsPage() {
  useDocumentTitle('Thông báo – JIEYOU');
  const { refresh, toast } = useAccount();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(
    (signal) =>
      accountApi
        .notifications(filter === 'all' ? undefined : filter, { signal })
        .then((res) => {
          setItems(res.data);
          setUnread(res.meta?.unread ?? 0);
          setError(null);
        })
        .catch((e) => {
          if (e.name === 'AbortError') return;
          setError(e.message);
          setItems([]);
        }),
    [filter],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const markRead = async (n) => {
    // Cập nhật ngay trên giao diện, lỗi thì hoàn lại
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await accountApi.read(n.id);
      refresh();
    } catch (e) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: false } : x)));
      setUnread((u) => u + 1);
      toast(e.message || 'Không đánh dấu được thông báo', 'error');
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await accountApi.readAll();
      setItems((list) => list.map((x) => ({ ...x, read: true })));
      setUnread(0);
      refresh();
      toast('Đã đánh dấu tất cả thông báo là đã đọc.');
    } catch (e) {
      toast(e.message || 'Không đánh dấu được thông báo', 'error');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        className={styles.header}
        sticker="account/sticker/notifications.png"
        eyebrow="Thông báo"
        title="Thông báo"
        subtitle="Thay đổi trạng thái hồ sơ và giao dịch."
        actions={
          <OutlineButton
            size="md"
            className={styles.markAll}
            onClick={markAll}
            disabled={unread === 0 || markingAll}
            icon={<img src={asset('account/notifications/check.svg')} width="20" height="20" alt="" />}
          >
            Đánh dấu tất cả đã đọc
          </OutlineButton>
        }
      />

      <div className={styles.body}>
        <FilterChips value={filter} onChange={setFilter} options={FILTERS} label="Lọc thông báo" />

        {items === null && (
          <p className={styles.state} role="status">
            Đang tải…
          </p>
        )}
        {error && (
          <p className={styles.state} role="alert">
            Không tải được thông báo: {error}{' '}
            <button type="button" className={styles.retry} onClick={() => load()}>
              Thử lại
            </button>
          </p>
        )}
        {items && !error && items.length === 0 && <p className={styles.state}>{EMPTY[filter]}</p>}

        {items && items.length > 0 && (
          <ul className={styles.list} aria-label="Danh sách thông báo">
            {items.map((n) => {
              const k = KIND[n.kind] || KIND.ads;
              const inner = (
                <>
                  <span className={`${styles.tile} ${styles[`tile_${k.tone}`]}`}>
                    <img src={asset(`account/notifications/${k.icon}.svg`)} width="22" height="22" alt="" />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.title}>{n.title}</span>
                    <span className={styles.desc}>{n.body}</span>
                  </span>
                  <span className={styles.meta}>
                    <time dateTime={n.createdAt}>{timeLabel(n.createdAt)}</time>
                    {!n.read && (
                      <>
                        <span className={styles.dot} aria-hidden="true" />
                        <span className="sr-only">Chưa đọc</span>
                      </>
                    )}
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.read ? (
                    <div className={styles.item}>{inner}</div>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.item} ${styles.unread}`}
                      onClick={() => markRead(n)}
                      title="Đánh dấu đã đọc"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
