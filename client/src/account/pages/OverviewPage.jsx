import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { dateVN, vnd } from '../../admin/format.js';
import { useAccount } from '../AccountLayout.jsx';
import { ACCOUNT_SERVICES, APPLICATION_STATUS } from '../constants.js';
import { AccountTable, PrimaryButton } from '../ui.jsx';
import { StatusPill } from '../../admin/ui.jsx';
import styles from './OverviewPage.module.css';

const COLUMNS = [
  { key: 'service', label: 'Dịch vụ', width: 287.531, primary: true },
  { key: 'code', label: 'Mã hồ sơ', width: 222.969 },
  { key: 'submittedAt', label: 'Ngày tạo', width: 174.828, render: (r) => dateVN(r.submittedAt) },
  {
    key: 'status',
    label: 'Trạng thái',
    width: 225.25,
    render: (r) => {
      const s = APPLICATION_STATUS[r.status] || APPLICATION_STATUS.pending;
      return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
    },
  },
  { key: 'amount', label: 'Số tiền', align: 'right', primary: true, render: (r) => (r.amount > 0 ? vnd(r.amount) : 'Miễn phí') },
];

function spentNote(pct) {
  if (pct === null || pct === undefined) return 'Chưa có dữ liệu tháng trước.';
  if (pct === 0) return 'Bằng tháng trước.';
  return `${pct > 0 ? 'Tăng' : 'Giảm'} ${Math.abs(pct)}% so với tháng trước.`;
}

// Figma: Web người dùng: Tổng quan (74:1995)
export default function OverviewPage() {
  useDocumentTitle('Tổng quan – JIEYOU');
  const { summary } = useAccount();
  const s = summary?.stats;
  const name = summary?.user.businessName || '';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.greeting}>
          <h1 className={styles.title}>Xin chào{name ? `, ${name}` : ''}</h1>
          <p className={styles.subtitle}>
            {s ? `Hôm nay bạn có ${s.pendingCount} hồ sơ chờ duyệt và ${s.runningAds} quảng cáo đang chạy.` : ' '}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            to="/tai-khoan/thong-bao"
            className={styles.bell}
            aria-label={summary?.unreadNotifications ? `Thông báo, ${summary.unreadNotifications} tin chưa đọc` : 'Thông báo'}
          >
            <img src={asset('account/ui/bell.svg')} width="22" height="22" alt="" />
            {summary?.unreadNotifications > 0 && <span className={styles.badge} aria-hidden="true" />}
          </Link>
          <Link to="/tai-khoan/cai-dat" className={styles.avatar} aria-label="Cài đặt tài khoản">
            {name.replace(/^(Công ty TNHH|Công ty|CTCP|Cửa hàng|Hộ KD)\s+/i, '').charAt(0).toUpperCase() || 'J'}
          </Link>
        </div>
      </header>

      <section className={styles.stats} aria-label="Số dư">
        <div className={styles.balanceCard}>
          <div className={styles.balanceText}>
            <p className={styles.statLabel}>Số dư khả dụng</p>
            <p className={styles.balance}>{s ? vnd(s.balance) : '—'}</p>
          </div>
          <PrimaryButton to="/tai-khoan/nap-tien" size="xl" icon={<img src={asset('account/ui/plus-white.svg')} width="20" height="20" alt="" />}>
            Nạp tiền
          </PrimaryButton>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Đang tạm giữ</p>
          <div className={styles.statBody}>
            <p className={styles.statValue}>{s ? vnd(s.held) : '—'}</p>
            <p className={styles.statNote}>
              {s && (s.heldCount > 0 ? `Cho ${s.heldCount} quảng cáo chờ duyệt. Hoàn lại nếu bị từ chối.` : 'Không có khoản tạm giữ.')}
            </p>
          </div>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Đã chi tháng này</p>
          <div className={styles.statBody}>
            <p className={styles.statValue}>{s ? vnd(s.spentThisMonth) : '—'}</p>
            <p className={styles.statNote}>{s && spentNote(s.spentChangePct)}</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Dịch vụ</h2>
        <ul className={styles.services}>
          {ACCOUNT_SERVICES.map((svc) => (
            <li key={svc.key}>
              <Link to={svc.to} className={styles.service}>
                <img src={asset(svc.sticker || `account/sticker/${svc.key}.png`)} width="80" height="80" alt="" />
                <span>{svc.cardLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.recent}`}>
        <h2 className={styles.sectionTitle}>Hồ sơ gần đây</h2>
        <AccountTable
          caption="Hồ sơ gần đây"
          columns={COLUMNS}
          rows={summary?.recentApplications || []}
          rowKey={(r) => r.code}
          empty={summary ? 'Bạn chưa có hồ sơ nào. Chọn một dịch vụ ở trên để bắt đầu.' : 'Đang tải…'}
        />
      </section>
    </div>
  );
}
