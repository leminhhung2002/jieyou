import { useCallback, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../adminApi.js';
import { useAdminData } from '../AdminLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { asset } from '../../utils/format.js';
import { relativeDay, vnd } from '../format.js';
import { Button, DataTable, FilterChips, LoadingRow, Modal, PageHeader, StatusPill, Toast } from '../ui.jsx';
import { APP_STATUS } from './OverviewPage.jsx';
import styles from './ApplicationsPage.module.css';

// Chip lọc theo loại dịch vụ → tham số `type` của API
const TYPE_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'ads', label: 'Quảng cáo' },
  { value: 'bct', label: 'BCT' },
  { value: 'misa', label: 'Máy bán hàng' },
  { value: 'pos', label: 'POS' },
  { value: 'unipay', label: 'UniPay' },
  { value: 'social', label: 'MXH' },
  { value: 'webapp', label: 'App/Web' },
];

const MIN_REASON = 5;
const isPending = (a) => a && (a.status === 'pending' || a.status === 'overdue');

// Figma: Admin: Duyệt hồ sơ (76:175) + hộp thoại Từ chối hồ sơ (76:343)
export default function ApplicationsPage() {
  useDocumentTitle('Duyệt hồ sơ – JIEYOU Admin');
  const { refreshPending } = useAdminData();
  const [params, setParams] = useSearchParams();
  const code = params.get('code');

  const [type, setType] = useState('all');
  const [list, setList] = useState(null);
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  // Hồ sơ không còn trong hàng đợi (đã xử lý) nhưng được mở qua ?code=
  const [outside, setOutside] = useState(null);

  const [reason, setReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(null); // 'approve' | 'reject'
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  // Tải danh sách hồ sơ chờ duyệt theo loại
  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    adminApi
      .applications({ type }, { signal: ctrl.signal })
      .then(({ data, meta }) => {
        setList(data);
        setCounts(meta.counts);
      })
      .catch((e) => e.name !== 'AbortError' && setError(e));
    return () => ctrl.abort();
  }, [type, reload]);

  const selectCode = useCallback(
    (c) => setParams(c ? { code: c } : {}, { replace: true }),
    [setParams],
  );

  // Mặc định chọn hồ sơ đầu tiên; nếu ?code= không có trong danh sách thì tải riêng hồ sơ đó
  useEffect(() => {
    if (!list) return undefined;
    if (!code) {
      if (list.length) selectCode(list[0].code);
      return undefined;
    }
    if (list.some((a) => a.code === code)) {
      setOutside(null);
      return undefined;
    }
    const ctrl = new AbortController();
    adminApi
      .application(code, { signal: ctrl.signal })
      .then(setOutside)
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setOutside(null);
        selectCode(list[0]?.code);
      });
    return () => ctrl.abort();
  }, [list, code, selectCode]);

  const selected = list?.find((a) => a.code === code) || (outside?.code === code ? outside : null);

  // Đổi hồ sơ đang xem → xoá lý do cũ
  useEffect(() => {
    setReason('');
    setReasonError('');
  }, [code]);

  const totalPending = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : null;

  /** Sau khi duyệt/từ chối: chọn hồ sơ kế tiếp, tải lại danh sách, cập nhật badge menu */
  const afterAction = (doneCode, message) => {
    const idx = list.findIndex((a) => a.code === doneCode);
    const rest = list.filter((a) => a.code !== doneCode);
    const next = rest[Math.min(Math.max(idx, 0), rest.length - 1)];
    setOutside(null);
    selectCode(next?.code);
    setReload((n) => n + 1);
    refreshPending();
    setToast({ message, tone: 'success' });
  };

  const approve = async () => {
    setBusy('approve');
    try {
      await adminApi.approve(selected.code, reason.trim());
      afterAction(selected.code, `Đã duyệt hồ sơ ${selected.code}`);
    } catch (e) {
      setToast({ message: e.message, tone: 'error' });
      if (e.status === 409) setReload((n) => n + 1);
    } finally {
      setBusy(null);
    }
  };

  const openReject = () => {
    setReasonError('');
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    const r = reason.trim();
    if (r.length < MIN_REASON) {
      setReasonError(`Vui lòng nhập lý do từ chối (tối thiểu ${MIN_REASON} ký tự)`);
      return;
    }
    setBusy('reject');
    try {
      await adminApi.reject(selected.code, r);
      setRejectOpen(false);
      afterAction(selected.code, `Đã từ chối hồ sơ ${selected.code}`);
    } catch (e) {
      // Lỗi kiểm tra dữ liệu hiển thị ngay dưới ô lý do; lỗi khác hiện toast
      if (e.status === 400) setReasonError(e.message);
      else {
        setRejectOpen(false);
        setToast({ message: e.message, tone: 'error' });
        if (e.status === 409) setReload((n) => n + 1);
      }
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    { key: 'code', label: 'Mã hồ sơ', width: 167.797 },
    { key: 'customer', label: 'Khách hàng', width: 154.641, render: (r) => r.customer.shortName },
    { key: 'serviceLabel', label: 'Dịch vụ', width: 167.234 },
    { key: 'submittedAt', label: 'Gửi lúc', width: 102.328, render: (r) => relativeDay(r.submittedAt, { withTodaySuffix: false }) },
  ];

  return (
    <>
      <PageHeader
        title="Duyệt hồ sơ"
        subtitle={totalPending === null ? ' ' : totalPending ? `${totalPending} hồ sơ đang chờ.` : 'Không còn hồ sơ chờ duyệt.'}
      />
      <FilterChips
        label="Lọc theo dịch vụ"
        value={type}
        onChange={(v) => {
          // Đổi bộ lọc → bỏ chọn để tự chọn hồ sơ đầu tiên của danh sách mới
          setType(v);
          setList(null);
          selectCode(null);
        }}
        options={TYPE_FILTERS}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error.message}
        </p>
      )}
      <div className={styles.row}>
        <section className={styles.list} aria-label="Danh sách hồ sơ chờ duyệt">
          {!list ? (
            <LoadingRow />
          ) : (
            <DataTable
              caption="Hồ sơ chờ duyệt"
              className={styles.table}
              columns={columns}
              rows={list}
              rowKey={(r) => r.code}
              onRowClick={(r) => selectCode(r.code)}
              selectedKey={selected?.code}
              empty="Không có hồ sơ chờ duyệt"
            />
          )}
        </section>

        {selected ? (
          <ReviewPanel
            app={selected}
            reason={reason}
            onReason={(v) => {
              setReason(v);
              setReasonError('');
            }}
            busy={busy}
            onApprove={approve}
            onReject={openReject}
          />
        ) : (
          list && (
            <aside className={`${styles.panel} ${styles.panelEmpty}`}>
              <p>{list.length ? 'Chọn một hồ sơ để xem chi tiết.' : 'Không còn hồ sơ nào cần duyệt.'}</p>
            </aside>
          )
        )}
      </div>

      <Modal
        open={rejectOpen && Boolean(selected)}
        onClose={() => busy !== 'reject' && setRejectOpen(false)}
        title={selected ? `Từ chối hồ sơ ${selected.code}?` : ''}
        labelledBy="reject-title"
      >
        <p className={styles.modalText}>Khách hàng sẽ nhận thông báo kèm lý do. Tiền tạm giữ sẽ được hoàn lại.</p>
        <label className={styles.modalLabel} htmlFor="reject-reason">
          Lý do từ chối
        </label>
        <textarea
          id="reject-reason"
          className={`${styles.textarea} ${reasonError ? styles.invalid : ''}`}
          value={reason}
          maxLength={500}
          placeholder="Nhập lý do…"
          aria-invalid={Boolean(reasonError)}
          aria-describedby={reasonError ? 'reject-reason-error' : undefined}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError('');
          }}
        />
        {reasonError && (
          <p id="reject-reason-error" role="alert" className={styles.fieldError}>
            {reasonError}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" size="lg" onClick={() => setRejectOpen(false)} disabled={busy === 'reject'}>
            Hủy
          </Button>
          <Button variant="danger" size="lg" onClick={confirmReject} disabled={busy === 'reject'}>
            {busy === 'reject' ? 'Đang xử lý…' : 'Xác nhận từ chối'}
          </Button>
        </div>
      </Modal>

      <Toast message={toast?.message} tone={toast?.tone} onDone={closeToast} />
    </>
  );
}

/** Khung chi tiết "Hồ sơ đang xem" – Figma "group · Hồ sơ đang xem" (76:296) */
function ReviewPanel({ app, reason, onReason, busy, onApprove, onReject }) {
  const reasonId = useId();
  const status = APP_STATUS[app.status] || APP_STATUS.pending;
  const pending = isPending(app);
  const rows = [['Khách hàng', app.customer.name], ...Object.entries(app.details || {}), ['Tạm giữ', vnd(app.held)]];
  const isWebapp = app.type === 'webapp';

  return (
    <aside className={styles.panel} aria-labelledby="review-code">
      <div className={styles.panelHead}>
        <div>
          <p className={styles.panelEyebrow}>Hồ sơ đang xem</p>
          <h2 id="review-code" className={styles.panelCode}>
            {app.code}
          </h2>
        </div>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>

      <dl className={styles.facts}>
        {rows.map(([k, v]) => (
          <div key={k} className={styles.fact}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {/* Ảnh/tệp đính kèm – chưa có API tệp nên hiển thị khung giữ chỗ như thiết kế */}
      <div className={styles.attachments} aria-label="Tệp đính kèm">
        <div className={styles.attachMain}>
          <img src={asset('admin/review/image.svg')} width="28" height="28" alt="" />
        </div>
        <div className={styles.attachThumb} />
      </div>

      {pending ? (
        <>
          <label className={styles.reasonLabel} htmlFor={reasonId}>
            {isWebapp ? 'Báo giá / phản hồi gửi khách khi duyệt, hoặc lý do khi từ chối' : 'Ghi chú gửi khách khi duyệt, hoặc lý do từ chối (bắt buộc khi từ chối)'}
          </label>
          <textarea
            id={reasonId}
            className={styles.textarea}
            value={reason}
            maxLength={isWebapp ? 2000 : 500}
            placeholder={isWebapp ? 'VD: Báo giá 18.000.000 đ, hoàn thành trong 3 tuần. Chúng tôi sẽ gọi để trao đổi chi tiết.' : 'Nhập ghi chú hoặc lý do…'}
            onChange={(e) => onReason(e.target.value)}
          />
          <div className={styles.actions}>
            <Button
              size="lg"
              className={styles.approve}
              icon={<img src={asset('admin/review/check.svg')} width="20" height="20" alt="" />}
              onClick={onApprove}
              disabled={Boolean(busy)}
            >
              {busy === 'approve' ? 'Đang duyệt…' : isWebapp ? 'Gửi báo giá' : 'Duyệt'}
            </Button>
            <Button variant="outline" size="lg" onClick={onReject} disabled={Boolean(busy)}>
              Từ chối
            </Button>
          </div>
        </>
      ) : (
        <p className={styles.processed}>
          {app.status === 'rejected' ? `Đã từ chối: ${app.rejectReason}` : app.reviewNote ? `Đã duyệt: ${app.reviewNote}` : 'Hồ sơ đã được duyệt.'}
          {app.reviewedBy && ` (${app.reviewedBy})`}
        </p>
      )}
    </aside>
  );
}
