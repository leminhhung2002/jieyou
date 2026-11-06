import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../adminApi.js';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset, formatVnd } from '../../utils/format.js';
import { relativeDay } from '../format.js';
import { DataTable, LoadingRow, PageHeader, StatCard, StatGrid, StatusPill } from '../ui.jsx';
import styles from './OverviewPage.module.css';

export const APP_STATUS = {
  pending: { tone: 'warning', label: 'Chờ duyệt' },
  overdue: { tone: 'danger', label: 'Quá 24 giờ' },
  approved: { tone: 'success', label: 'Đã duyệt' },
  rejected: { tone: 'neutral', label: 'Đã từ chối' },
};

const ATTENTION_ICON = {
  overdue: { icon: 'admin/attention/clock.svg', bg: '#fff3dc' },
  invoice: { icon: 'admin/attention/invoice.svg', bg: '#e8fbfb' },
};

// Figma: Admin: Tổng quan (76:2)
export default function OverviewPage() {
  useDocumentTitle('Tổng quan – JIEYOU Admin');
  const navigate = useNavigate();
  const { data, error } = useApi((o) => adminApi.overview(o), [], null);

  const columns = [
    { key: 'customer', label: 'Khách hàng', width: 181.406, render: (r) => r.customer.name },
    { key: 'service', label: 'Dịch vụ', width: 228.031 },
    { key: 'submittedAt', label: 'Gửi lúc', width: 139.844, render: (r) => relativeDay(r.submittedAt) },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 122.719,
      render: (r) => <StatusPill tone={APP_STATUS[r.status].tone}>{APP_STATUS[r.status].label}</StatusPill>,
    },
  ];

  return (
    <>
      <PageHeader title="Tổng quan hôm nay" subtitle="Tình hình duyệt hồ sơ và giao dịch." />
      {error && <p role="alert">{error.message}</p>}
      {!data ? (
        <LoadingRow />
      ) : (
        <>
          <StatGrid>
            <StatCard icon="admin/stat/pending.svg" label="Hồ sơ chờ duyệt" value={data.stats.pending} hint={`${data.stats.overdue} hồ sơ quá 24 giờ`} />
            <StatCard
              icon="admin/stat/customers.svg"
              label="Khách mới hôm nay"
              value={data.stats.newCustomersToday}
              hint={`Tổng ${formatVnd(data.stats.totalCustomers)} khách`}
            />
            <StatCard
              icon="admin/stat/topup.svg"
              label="Nạp tiền hôm nay"
              value={`${formatVnd(data.stats.topupToday)} đ`}
              hint={`${data.stats.topupTodayCount} giao dịch`}
            />
            <StatCard
              icon="admin/stat/webhook.svg"
              label="Webhook Bảo Việt lỗi"
              value={data.stats.webhookErrors}
              hint={data.stats.webhookErrors ? `${data.stats.webhookErrors} giao dịch cần đối soát` : 'Không có giao dịch kẹt'}
            />
          </StatGrid>

          <div className={styles.row}>
            <section className={styles.queue} aria-labelledby="queue-title">
              <div className={styles.queueHead}>
                <h2 id="queue-title">Hàng đợi duyệt</h2>
                <Link to="/admin/duyet-ho-so">Xem tất cả</Link>
              </div>
              <DataTable
                caption="Hàng đợi duyệt"
                columns={columns}
                rows={data.queue}
                rowKey={(r) => r.code}
                onRowClick={(r) => navigate(`/admin/duyet-ho-so?code=${encodeURIComponent(r.code)}`)}
                empty="Không còn hồ sơ chờ duyệt"
              />
            </section>

            <section className={styles.attention} aria-labelledby="attention-title">
              <h2 id="attention-title">Cần chú ý</h2>
              {data.attention.length === 0 && <p className={styles.allGood}>Mọi thứ đều ổn.</p>}
              <ul>
                {data.attention.map((a) => (
                  <li key={a.kind}>
                    <Link to={a.link} className={styles.attentionItem}>
                      <span className={styles.attentionIcon} style={{ background: ATTENTION_ICON[a.kind]?.bg }}>
                        <img src={asset(ATTENTION_ICON[a.kind]?.icon)} width="22" height="22" alt="" />
                      </span>
                      <span className={styles.attentionText}>
                        <span>{a.title}</span>
                        <span>{a.subtitle}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
