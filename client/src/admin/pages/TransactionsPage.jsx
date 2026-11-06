import { adminApi } from '../adminApi.js';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { signedVnd, vnd } from '../format.js';
import { DataTable, LoadingRow, PageHeader, StatCard, StatGrid, StatusPill } from '../ui.jsx';
import styles from './TransactionsPage.module.css';

export const TX_TYPE = { topup: 'Nạp tiền', hold: 'Tạm giữ / trừ phí', fee: 'Trừ phí', refund: 'Hoàn tiền' };

export const TX_STATUS = {
  success: { tone: 'success', label: 'Thành công' },
  pending: { tone: 'warning', label: 'Đang chờ' },
  failed: { tone: 'danger', label: 'Thất bại' },
};

const pad = (n) => String(n).padStart(2, '0');
/** "00:00" – giờ đối soát gần nhất theo giờ máy */
const timeHM = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Độ rộng cột lấy theo Figma (bảng 1076px)
const columns = [
  { key: 'id', label: 'Mã giao dịch', width: 223.063 },
  { key: 'customer', label: 'Khách hàng', width: 173.125, render: (r) => r.customer?.shortName || r.customer?.name || '—' },
  { key: 'type', label: 'Loại', width: 131.063, render: (r) => TX_TYPE[r.type] || r.type },
  { key: 'amount', label: 'Số tiền', width: 197.719, align: 'right', render: (r) => signedVnd(r.amount) },
  { key: 'bvRef', label: 'Mã Bảo Việt', width: 169.797, render: (r) => r.bvRef || '—' },
  {
    key: 'status',
    label: 'Trạng thái',
    width: 181.234,
    render: (r) => {
      const s = TX_STATUS[r.status] || { tone: 'neutral', label: r.status };
      return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
    },
  },
];

// Figma: Admin: Giao dịch (76:599)
export default function TransactionsPage() {
  useDocumentTitle('Giao dịch – JIEYOU Admin');
  const { data, error } = useApi((o) => adminApi.transactions({}, o), [], null);

  return (
    <>
      <PageHeader title="Giao dịch" subtitle="Đối soát nạp tiền Bảo Việt và sổ cái tài khoản trả trước." />
      {error && (
        <p role="alert" className={styles.error}>
          {error.message}
        </p>
      )}
      {!data ? (
        !error && <LoadingRow />
      ) : (
        <>
          <StatGrid>
            <StatCard
              icon="admin/stat/topup.svg"
              label="Nạp tiền hôm nay"
              value={vnd(data.meta.topupToday)}
              hint={`${data.meta.topupTodayCount} giao dịch thành công`}
            />
            <StatCard
              icon="admin/stat/holding.svg"
              label="Đang tạm giữ (toàn sàn)"
              value={vnd(data.meta.holding)}
              hint={`${data.meta.holdingAdsCount} quảng cáo chờ duyệt`}
            />
            <StatCard
              icon="admin/stat/reconcile.svg"
              label="Chưa khớp Bảo Việt"
              value={data.meta.unreconciled}
              hint={`Đối soát lúc ${timeHM(data.meta.reconciledAt)}`}
            />
          </StatGrid>
          <DataTable caption="Danh sách giao dịch" columns={columns} rows={data.data} rowKey={(r) => r.id} empty="Chưa có giao dịch" />
        </>
      )}
    </>
  );
}
