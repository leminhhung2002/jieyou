import { useEffect, useMemo, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { dateTimeShort, signedVnd, vnd } from '../../admin/format.js';
import { FilterSelect, StatusPill } from '../../admin/ui.jsx';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import { AccountTable, PageHeader, PrimaryButton } from '../ui.jsx';
import styles from './PrepaidPage.module.css';

/** Loại giao dịch → nhãn + màu viên thuốc (Figma "row · Nạp/Tạm giữ/Đã trừ/Hoàn"). */
const KIND = {
  topup: { label: 'Nạp', tone: 'success' },
  held: { label: 'Tạm giữ', tone: 'warning' },
  charged: { label: 'Đã trừ', tone: 'info' },
  refund: { label: 'Hoàn', tone: 'success' },
};

const KIND_OPTIONS = [{ value: 'all', label: 'Tất cả loại' }, ...Object.entries(KIND).map(([value, k]) => ({ value, label: k.label }))];

const monthLabel = (m) => {
  const [y, mo] = m.split('-');
  return `Tháng ${mo}/${y}`;
};

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const COLUMNS = [
  { key: 'createdAt', label: 'Thời gian', width: 136.844, className: styles.time, render: (r) => dateTimeShort(r.createdAt) },
  { key: 'description', label: 'Nội dung', width: 425.328, className: styles.muted },
  {
    key: 'kind',
    label: 'Loại',
    width: 170.141,
    render: (r) => {
      const k = KIND[r.kind] || { label: r.kind, tone: 'neutral' };
      return <StatusPill tone={k.tone}>{k.label}</StatusPill>;
    },
  },
  { key: 'amount', label: 'Số tiền', width: 188.781, align: 'right', primary: true, render: (r) => signedVnd(r.amount) },
  { key: 'balanceAfter', label: 'Số dư sau', align: 'right', className: styles.muted, render: (r) => vnd(r.balanceAfter) },
];

// Figma: Web người dùng: Tài khoản trả trước (74:2184)
export default function PrepaidPage() {
  useDocumentTitle('Tài khoản trả trước – JIEYOU');
  const { summary } = useAccount();
  const [kind, setKind] = useState('all');
  const [month, setMonth] = useState(thisMonth);
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    accountApi
      .transactions({ kind: kind === 'all' ? undefined : kind, month: month === 'all' ? undefined : month }, { signal: ctrl.signal })
      .then((res) => {
        setRows(res.data);
        setMeta(res.meta);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setRows([]);
      });
    return () => ctrl.abort();
  }, [kind, month]);

  // Tháng hiện tại luôn có trong danh sách, kể cả khi chưa phát sinh giao dịch
  const monthOptions = useMemo(() => {
    const months = new Set([thisMonth(), ...(meta?.months || [])]);
    return [{ value: 'all', label: 'Tất cả tháng' }, ...[...months].sort().reverse().map((m) => ({ value: m, label: monthLabel(m) }))];
  }, [meta]);

  const s = meta?.stats || summary?.stats;

  let empty = 'Đang tải…';
  if (error) empty = `Không tải được lịch sử giao dịch: ${error}`;
  else if (rows) empty = kind !== 'all' || month !== 'all' ? 'Không có giao dịch phù hợp với bộ lọc.' : 'Chưa có giao dịch nào.';

  return (
    <div className={styles.page}>
      <PageHeader
        className={styles.header}
        eyebrow="Tài khoản trả trước"
        title="Tài khoản trả trước"
        subtitle="Số dư và lịch sử giao dịch của doanh nghiệp."
        actions={
          <PrimaryButton to="/tai-khoan/nap-tien" icon={<img src={asset('account/ui/plus-white.svg')} width="20" height="20" alt="" />}>
            Nạp tiền
          </PrimaryButton>
        }
      />

      <section className={styles.stats} aria-label="Tổng quan số dư">
        <div className={styles.balanceCard}>
          <p className={styles.balanceLabel}>Số dư khả dụng</p>
          <p className={styles.balance}>{s ? vnd(s.balance) : '—'}</p>
        </div>
        <StatCard icon="held" label="Đang tạm giữ" value={s && vnd(s.held)}>
          {s && (s.heldCount > 0 ? `Cho ${s.heldCount} quảng cáo chờ duyệt` : 'Không có khoản tạm giữ')}
        </StatCard>
        <StatCard icon="spent" label="Đã chi tháng này" value={s && vnd(s.spentThisMonth)}>
          Trừ trực tiếp và quảng cáo đã duyệt
        </StatCard>
        <StatCard icon="topup" label="Đã nạp tháng này" value={s && vnd(s.topupThisMonth)}>
          {s && (s.topupCount > 0 ? `${s.topupCount} lần nạp` : 'Chưa nạp lần nào')}
        </StatCard>
      </section>

      <section className={styles.history} aria-labelledby="prepaid-history">
        <div className={styles.historyHead}>
          <h2 id="prepaid-history" className={styles.sectionTitle}>
            Lịch sử giao dịch
          </h2>
          <div className={styles.filters}>
            <FilterSelect value={kind} onChange={setKind} options={KIND_OPTIONS} label="Loại giao dịch" />
            <FilterSelect value={month} onChange={setMonth} options={monthOptions} label="Tháng" />
          </div>
        </div>
        <AccountTable
          className={styles.table}
          caption="Lịch sử giao dịch"
          columns={COLUMNS}
          rows={rows || []}
          rowKey={(r) => r.id}
          empty={empty}
        />
      </section>
    </div>
  );
}

/** Thẻ số liệu nhỏ – Figma "group · Đang tạm giữ" (74:2282). */
function StatCard({ icon, label, value, children }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statHead}>
        <p className={styles.statLabel}>{label}</p>
        <img src={asset(`account/prepaid/${icon}.svg`)} width="18" height="18" alt="" />
      </div>
      <p className={styles.statValue}>{value || '—'}</p>
      <p className={styles.statNote}>{children || ' '}</p>
    </div>
  );
}
