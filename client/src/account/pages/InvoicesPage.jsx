import { useEffect, useMemo, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { dateVN, vnd } from '../../admin/format.js';
import { FilterSelect, SearchInput, StatusPill } from '../../admin/ui.jsx';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import { AccountTable, PageHeader } from '../ui.jsx';
import styles from './InvoicesPage.module.css';

const STATUS = {
  issued: { label: 'Đã phát hành', tone: 'success' },
  pending: { label: 'Chờ duyệt', tone: 'warning' },
};

const monthLabel = (m) => {
  const [y, mo] = m.split('-');
  return `Tháng ${mo}/${y}`;
};

// Figma: Web người dùng: Hóa đơn (74:3598)
export default function InvoicesPage() {
  useDocumentTitle('Hóa đơn – JIEYOU');
  const { toast } = useAccount();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [month, setMonth] = useState('all');
  const [rows, setRows] = useState(null);
  const [months, setMonths] = useState([]);
  const [error, setError] = useState(null);
  const [opening, setOpening] = useState(null);

  // Tìm theo số hóa đơn: chờ 300ms sau lần gõ cuối mới gọi API
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    accountApi
      .invoices({ q, month: month === 'all' ? undefined : month }, { signal: ctrl.signal })
      .then((res) => {
        setRows(res.data);
        if (res.meta?.months) setMonths(res.meta.months);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setRows([]);
      });
    return () => ctrl.abort();
  }, [q, month]);

  const monthOptions = useMemo(
    () => [{ value: 'all', label: 'Tất cả tháng' }, ...months.map((m) => ({ value: m, label: monthLabel(m) }))],
    [months],
  );

  const download = async (no) => {
    setOpening(no);
    try {
      await accountApi.openInvoice(no);
    } catch (e) {
      toast(e.message || 'Không tải được hóa đơn', 'error');
    } finally {
      setOpening(null);
    }
  };

  const columns = [
    { key: 'no', label: 'Số hóa đơn', width: 168.375, primary: true, render: (r) => r.no || '—' },
    { key: 'application', label: 'Hồ sơ', width: 282.656, className: styles.muted },
    { key: 'issuedAt', label: 'Ngày phát hành', width: 172.063, className: styles.muted, render: (r) => (r.issuedAt ? dateVN(r.issuedAt) : '—') },
    { key: 'total', label: 'Tổng tiền', width: 140.234, align: 'right', className: styles.muted, render: (r) => vnd(r.total) },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 180.016,
      render: (r) => {
        const s = STATUS[r.status] || STATUS.pending;
        return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
      },
    },
    {
      key: 'action',
      label: <span className="sr-only">Thao tác</span>,
      align: 'right',
      render: (r) =>
        r.status === 'issued' && r.no ? (
          <button
            type="button"
            className={styles.pdf}
            onClick={() => download(r.no)}
            disabled={opening === r.no}
            aria-label={`Tải PDF hóa đơn ${r.no}`}
          >
            <img src={asset('account/invoices/download.svg')} width="20" height="20" alt="" />
            {opening === r.no ? 'Đang mở…' : 'Tải PDF'}
          </button>
        ) : (
          <span className={styles.notIssued}>Chưa phát hành</span>
        ),
    },
  ];

  let empty = 'Đang tải…';
  if (error) empty = `Không tải được hóa đơn: ${error}`;
  else if (rows) empty = q || month !== 'all' ? 'Không tìm thấy hóa đơn phù hợp.' : 'Chưa có hóa đơn nào. Hóa đơn được phát hành sau khi hồ sơ được duyệt.';

  return (
    <div className={styles.page}>
      <PageHeader
        className={styles.header}
        sticker="account/sticker/invoices.png"
        eyebrow="Hóa đơn"
        title="Hóa đơn điện tử"
        subtitle="Hóa đơn MISA meInvoice của các hồ sơ đã duyệt."
      />

      <div className={styles.toolbar}>
        <SearchInput className={styles.search} value={search} onChange={setSearch} placeholder="Tìm theo số hóa đơn" />
        <FilterSelect value={month} onChange={setMonth} options={monthOptions} label="Tháng phát hành" />
      </div>

      <AccountTable
        className={styles.table}
        caption="Danh sách hóa đơn"
        columns={columns}
        rows={rows || []}
        rowKey={(r) => r.no || r.applicationCode}
        empty={empty}
      />

      <p className={styles.footnote}>Thời điểm phát hành hóa đơn cho quảng cáo đang chờ duyệt cần kế toán xác nhận.</p>
    </div>
  );
}
