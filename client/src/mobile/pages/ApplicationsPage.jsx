import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { accountApi } from '../../account/accountApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { AppTypeIcon, ErrorText, Muted, Screen, StatusText } from '../ui.jsx';
import styles from './Lists.module.css';

const CHIPS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Đang xử lý' },
  { key: 'approved', label: 'Hoàn thành' },
];

/** Minh hoạ "digistore-orders-blue-line3" 300×300 (121:18694): [file, inset, pad] */
const EMPTY_LAYERS = [
  ['side-outline-0', '24.98% 25.77% 22.2% 20.47%', '-1.14% -1.16% -1.91% -1.12%'],
  ['side-fill-0', '24.98% 25.77% 22.2% 20.47%'],
  ['side-creases-0', '67.44% 33.19% 22.19% 36.39%', '-0.63% -0.96%'],
  ['face-outline-0', '24.98% 25.77% 24.71% 21.03%', '-1.19% -1.87% -2.19% -1.13%'],
  ['face-fill-0', '24.98% 25.77% 24.71% 21.03%'],
  ['side-outline-1', '30.47% 43.34% 55.39% 27.45%', '-4.25% -2.06%'],
  ['side-fill-1', '30.47% 43.34% 55.39% 27.45%'],
  ['side-creases-1', '43.42% 69.81% 55.5% 29.95%', '-6.03% -122.02%'],
  ['face-outline-1', '30.47% 43.33% 56.47% 27.69%', '-4.59% -2.07%'],
  ['face-fill-1', '30.47% 43.33% 56.47% 27.69%'],
  ['face-fill-2', '34.28% 49.26% 60.44% 33.55%'],
  ['part-3', '41.7% 42.06% 51.6% 32.46%', '-4.33% -0.3%'],
  ['part-4', '47.35% 46.09% 47.45% 34.12%', '-5.58% -0.39%'],
  ['part-5', '50.01% 38.72% 43.29% 35.79%', '-4.33% -0.3%'],
  ['face-fill-6', '60.09% 48.14% 34.84% 38.78%'],
];

// Figma: "Hồ sơ của tôi" (121:15947) + trạng thái rỗng "Hồ sơ trống" (121:16113)
export default function ApplicationsPage() {
  useDocumentTitle('Hồ sơ của tôi – JIEYOU');
  const [apps, setApps] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const ctrl = new AbortController();
    accountApi
      .applications(100, { signal: ctrl.signal })
      .then(setApps)
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => ctrl.abort();
  }, []);

  if (apps && apps.length === 0) {
    return (
      <Screen tone="white" className={styles.tabScreen}>
        <div className={styles.content}>
          <h1 className={styles.bigTitle}>Hồ sơ của tôi</h1>
          <div className={styles.empty}>
            <div className={styles.emptyArt} aria-hidden="true">
              {EMPTY_LAYERS.map(([file, inset, pad]) => (
                <div key={file} className={styles.layer} style={{ inset }}>
                  <div className={styles.layer} style={{ inset: pad || 0 }}>
                    <img src={asset(`mobile/ho-so/empty/${file}.svg`)} alt="" />
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.emptyText}>
              <p className={styles.emptyTitle}>Chưa có hồ sơ nào</p>
              <p className={styles.emptySub}>Hồ sơ bạn gửi trên Web sẽ hiện ở đây để theo dõi.</p>
            </div>
          </div>
        </div>
      </Screen>
    );
  }

  const shown = (apps || []).filter((a) => filter === 'all' || a.status === filter);

  return (
    <Screen className={styles.tabScreen}>
      <div className={styles.content}>
        <h1 className={styles.bigTitle}>Hồ sơ của tôi</h1>
        <div className={styles.chips} role="group" aria-label="Lọc theo trạng thái">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`${styles.chip} ${filter === c.key ? styles.chipActive : ''}`}
              aria-pressed={filter === c.key}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <ErrorText>{error}</ErrorText>
        {apps && (
          <div className={styles.card}>
            {shown.length === 0 && <Muted>Không có hồ sơ nào trong mục này.</Muted>}
            {shown.map((a) => (
              <Link key={a.code} to={`/app/ho-so/${encodeURIComponent(a.code)}`} className={styles.appRow}>
                <AppTypeIcon type={a.type} status={a.status} />
                <span className={styles.appText}>
                  <span className={styles.appTitle}>{a.service}</span>
                  <span className={styles.appCode}>{a.code}</span>
                  <StatusText status={a.status} className={styles.appStatus} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
