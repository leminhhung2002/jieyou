import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../adminApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { dateVN, phoneVN, vnd } from '../format.js';
import { Button, DataTable, FilterSelect, LoadingRow, Modal, PageHeader, SearchInput, StatusPill, Toast } from '../ui.jsx';
import styles from './CustomersPage.module.css';

export const CUSTOMER_STATUS = {
  active: { tone: 'success', label: 'Hoạt động' },
  locked: { tone: 'danger', label: 'Bị khóa' },
};

const STATUS_FILTERS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'locked', label: 'Bị khóa' },
];

/** Trả về giá trị sau `delay` ms kể từ lần thay đổi cuối (tìm kiếm khi ngừng gõ). */
function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// Figma: Admin: Khách hàng (76:449)
export default function CustomersPage() {
  useDocumentTitle('Khách hàng – JIEYOU Admin');
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const [status, setStatus] = useState('all');
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);

  // Khách hàng đang được khóa/mở khóa (hộp thoại xác nhận)
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    adminApi
      .customers({ q: query, status }, { signal: ctrl.signal })
      .then(setList)
      .catch((e) => e.name !== 'AbortError' && setError(e));
    return () => ctrl.abort();
  }, [query, status, reload]);

  const toggleLock = async () => {
    const next = target.status === 'locked' ? 'active' : 'locked';
    setBusy(true);
    try {
      await adminApi.setCustomerStatus(target.id, next);
      setToast({ message: `${next === 'locked' ? 'Đã khóa' : 'Đã mở khóa'} tài khoản ${target.businessName}`, tone: 'success' });
      setTarget(null);
      setReload((n) => n + 1);
    } catch (e) {
      setToast({ message: e.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'businessName', label: 'Doanh nghiệp', width: 238.75 },
    { key: 'taxCode', label: 'Mã số thuế', width: 160.109 },
    { key: 'phone', label: 'Điện thoại', width: 173.188, render: (r) => phoneVN(r.phone) },
    { key: 'balance', label: 'Số dư khả dụng', width: 194.844, align: 'right', className: styles.money, render: (r) => vnd(r.balance) },
    { key: 'createdAt', label: 'Ngày tạo', width: 149.422, render: (r) => dateVN(r.createdAt) },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 159.688,
      render: (r) => {
        const s = CUSTOMER_STATUS[r.status] || CUSTOMER_STATUS.active;
        return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
      },
    },
  ];

  const locking = target?.status !== 'locked';

  return (
    <>
      <PageHeader title="Khách hàng" subtitle="Quản lý tài khoản doanh nghiệp." />
      <div className={styles.toolbar}>
        <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên, MST, số điện thoại" />
        <FilterSelect label="Lọc trạng thái" value={status} onChange={setStatus} options={STATUS_FILTERS} />
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error.message}
        </p>
      )}
      {!list ? (
        <LoadingRow />
      ) : (
        <DataTable
          caption="Danh sách khách hàng – chọn một dòng để khóa hoặc mở khóa tài khoản"
          columns={columns}
          rows={list}
          rowKey={(r) => r.id}
          onRowClick={setTarget}
          empty={query || status !== 'all' ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có khách hàng'}
        />
      )}

      {/* Bấm vào một dòng → xác nhận khóa / mở khóa tài khoản */}
      <Modal
        open={Boolean(target)}
        onClose={() => !busy && setTarget(null)}
        title={target ? `${locking ? 'Khóa' : 'Mở khóa'} tài khoản ${target.businessName}?` : ''}
        labelledBy="lock-title"
      >
        {target && (
          <>
            <p className={styles.modalText}>
              {locking
                ? 'Khách hàng sẽ không thể đăng nhập và sử dụng dịch vụ cho đến khi được mở khóa.'
                : 'Khách hàng sẽ có thể đăng nhập và sử dụng dịch vụ trở lại.'}
            </p>
            <dl className={styles.summary}>
              <div>
                <dt>Mã số thuế</dt>
                <dd>{target.taxCode}</dd>
              </div>
              <div>
                <dt>Điện thoại</dt>
                <dd>{phoneVN(target.phone)}</dd>
              </div>
              <div>
                <dt>Số dư khả dụng</dt>
                <dd>{vnd(target.balance)}</dd>
              </div>
            </dl>
            <div className={styles.actions}>
              <Button variant="ghost" size="lg" onClick={() => setTarget(null)} disabled={busy}>
                Hủy
              </Button>
              <Button variant={locking ? 'danger' : 'primary'} size="lg" onClick={toggleLock} disabled={busy}>
                {busy ? 'Đang xử lý…' : locking ? 'Khóa tài khoản' : 'Mở khóa'}
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Toast message={toast?.message} tone={toast?.tone} onDone={closeToast} />
    </>
  );
}
