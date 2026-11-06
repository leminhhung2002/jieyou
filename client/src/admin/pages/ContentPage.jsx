import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../adminApi.js';
import { api } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { dateVN, vnd } from '../format.js';
import { Button, DataTable, LoadingRow, Modal, PageHeader, StatusPill, Toast } from '../ui.jsx';
import HeaderButton from '../components/HeaderButton.jsx';
import form from '../components/form.module.css';
import styles from './ContentPage.module.css';

const TABS = [
  { key: 'news', label: 'Tin tức' },
  { key: 'pricing', label: 'Bảng giá' },
  { key: 'faq', label: 'FAQ' },
  { key: 'banner', label: 'Banner' },
  { key: 'legal', label: 'Trang pháp lý' },
];

export const PRICE_STATUS = {
  published: { tone: 'success', label: 'Đã xuất bản' },
  draft: { tone: 'warning', label: 'Bản nháp' },
};

const VAT_OPTIONS = [
  { value: '10', label: '10%' },
  { value: '8', label: '8%' },
  { value: '5', label: '5%' },
  { value: '0', label: '0%' },
  { value: '', label: 'Không áp dụng (—)' },
];

const priceText = (n) => (n === 0 ? 'Miễn phí' : vnd(n));

// Figma: Admin: Nội dung · Bảng giá (76:770)
export default function ContentPage() {
  useDocumentTitle('Nội dung – JIEYOU Admin');
  const [tab, setTab] = useState('pricing');
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const [toast, setToast] = useState(null);
  const tabRefs = useRef([]);

  const notify = useCallback((message, tone = 'success') => setToast({ message, tone }), []);

  // Điều hướng tab bằng phím mũi tên (WAI-ARIA tabs)
  const onTabKey = (e, i) => {
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin › Nội dung"
        title="Quản lý nội dung"
        subtitle="Bảng giá là nguồn giá duy nhất cho Website, Web người dùng và App."
        actions={tab === 'pricing' && <HeaderButton onClick={() => setEditing('new')}>Thêm mục giá</HeaderButton>}
      />

      <div className={styles.tabs} role="tablist" aria-label="Loại nội dung">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => (tabRefs.current[i] = el)}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className={styles.panel}>
        {tab === 'pricing' && <PricingTab editing={editing} setEditing={setEditing} notify={notify} />}
        {tab === 'news' && <NewsTab />}
        {tab === 'faq' && <FaqTab />}
        {tab === 'banner' && <EmptyTab text="Chưa có banner nào. Quản lý banner sẽ được bổ sung trong phiên bản sau." />}
        {tab === 'legal' && <EmptyTab text="Chưa có trang pháp lý nào. Quản lý trang pháp lý sẽ được bổ sung trong phiên bản sau." />}
      </div>

      <Toast message={toast?.message} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}

/* ============================ Bảng giá ============================ */

function PricingTab({ editing, setEditing, notify }) {
  const [items, setItems] = useState(null);
  const [services, setServices] = useState({});
  const [error, setError] = useState(null);

  const load = useCallback((o) => {
    return adminApi
      .priceItems(o)
      .then(({ data, meta }) => {
        setItems(data);
        setServices(meta.services || {});
        setError(null);
      })
      .catch((err) => err.name !== 'AbortError' && setError(err));
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load({ signal: ctrl.signal });
    return () => ctrl.abort();
  }, [load]);

  const columns = [
    { key: 'serviceName', label: 'Dịch vụ', width: 265.219 },
    { key: 'name', label: 'Mục giá', width: 284.391 },
    { key: 'unitPrice', label: 'Đơn giá', width: 150.109, align: 'right', render: (r) => priceText(r.unitPrice) },
    { key: 'vat', label: 'VAT', width: 77.953, render: (r) => (r.vat === null || r.vat === undefined ? '—' : `${r.vat}%`) },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 179.578,
      render: (r) => <StatusPill tone={PRICE_STATUS[r.status].tone}>{PRICE_STATUS[r.status].label}</StatusPill>,
    },
    { key: 'updatedAt', label: 'Cập nhật', width: 118.75, render: (r) => dateVN(r.updatedAt) },
  ];

  // Cập nhật 1 dòng trong danh sách sau khi lưu
  const upsert = (item) =>
    setItems((list) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]));

  return (
    <>
      {error && (
        <p role="alert" className={styles.error}>
          {error.message}
        </p>
      )}
      {!items ? (
        !error && <LoadingRow />
      ) : (
        <>
          <DataTable
            caption="Bảng giá dịch vụ – chọn một dòng để sửa"
            columns={columns}
            rows={items}
            rowKey={(r) => r.id}
            onRowClick={(r) => setEditing(r)}
            empty="Chưa có mục giá nào"
          />
          <p className={styles.note}>Số liệu mẫu. Chỉ mục ở trạng thái Đã xuất bản mới hiển thị cho khách.</p>
        </>
      )}

      {editing && (
        <PriceItemModal
          item={editing === 'new' ? null : editing}
          services={services}
          onClose={() => setEditing(null)}
          onSaved={(item, message) => {
            upsert(item);
            setEditing(null);
            notify(message);
          }}
          onDeleted={(item) => {
            setItems((list) => list.filter((x) => x.id !== item.id));
            setEditing(null);
            notify(`Đã xóa mục giá “${item.name}”`);
          }}
        />
      )}
    </>
  );
}

/** Hộp thoại thêm / sửa mục giá; có xuất bản nhanh và xóa (xác nhận 2 bước). */
function PriceItemModal({ item, services, onClose, onSaved, onDeleted }) {
  const isNew = !item;
  const serviceKeys = Object.keys(services);
  const [values, setValues] = useState(() => ({
    serviceSlug: item?.serviceSlug || serviceKeys[0] || '',
    name: item?.name || '',
    unitPrice: item ? String(item.unitPrice) : '',
    vat: item ? (item.vat === null ? '' : String(item.vat)) : '10',
    status: item?.status || 'draft',
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  // Kiểm tra phía client trước khi gửi (máy chủ vẫn kiểm tra lại)
  const validate = () => {
    const er = {};
    if (!values.serviceSlug) er.serviceSlug = 'Vui lòng chọn dịch vụ';
    if (!values.name.trim()) er.name = 'Vui lòng nhập tên mục giá';
    const digits = values.unitPrice.replace(/[.\s]/g, '');
    if (!/^\d+$/.test(digits)) er.unitPrice = 'Đơn giá phải là số nguyên không âm (đồng)';
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const payload = () => ({
    serviceSlug: values.serviceSlug,
    name: values.name.trim(),
    unitPrice: Number(values.unitPrice.replace(/[.\s]/g, '')),
    vat: values.vat === '' ? null : Number(values.vat),
    status: values.status,
  });

  // Gắn lỗi máy chủ vào đúng ô nhập nếu có field
  const showServerError = (err) => {
    if (err.details?.field) setErrors((er) => ({ ...er, [err.details.field]: err.message }));
    else setFormError(err.message);
  };

  const submit = async (e, override) => {
    e?.preventDefault();
    setFormError('');
    if (!validate()) return;
    setBusy(true);
    try {
      const body = { ...payload(), ...override };
      const saved = isNew ? await adminApi.createPriceItem(body) : await adminApi.updatePriceItem(item.id, body);
      const message =
        saved.status === 'published' && item?.status !== 'published'
          ? `Đã xuất bản “${saved.name}”`
          : saved.status === 'draft' && item?.status === 'published'
            ? `Đã gỡ xuất bản “${saved.name}”`
            : isNew
              ? `Đã thêm mục giá “${saved.name}”`
              : `Đã lưu “${saved.name}”`;
      onSaved(saved, message);
    } catch (err) {
      showServerError(err);
      setBusy(false);
    }
  };

  // Xuất bản / gỡ xuất bản nhanh: chỉ đổi trạng thái
  const togglePublish = async () => {
    setFormError('');
    setBusy(true);
    try {
      const next = item.status === 'published' ? 'draft' : 'published';
      const saved = await adminApi.updatePriceItem(item.id, { status: next });
      onSaved(saved, next === 'published' ? `Đã xuất bản “${saved.name}”` : `Đã gỡ xuất bản “${saved.name}”`);
    } catch (err) {
      showServerError(err);
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await adminApi.deletePriceItem(item.id);
      onDeleted(item);
    } catch (err) {
      setFormError(err.message);
      setConfirmDelete(false);
      setBusy(false);
    }
  };

  if (confirmDelete) {
    return (
      <Modal open onClose={() => setConfirmDelete(false)} title="Xóa mục giá?" labelledBy="price-delete-title">
        <p className={styles.modalText}>
          Mục “{item.name}” ({item.serviceName}) sẽ bị xóa vĩnh viễn
          {item.status === 'published' ? ' và không còn hiển thị cho khách' : ''}.
        </p>
        <div className={form.actions}>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
            Hủy
          </Button>
          <Button variant="danger" onClick={remove} disabled={busy}>
            {busy ? 'Đang xóa…' : 'Xóa mục giá'}
          </Button>
        </div>
      </Modal>
    );
  }

  const err = (k) =>
    errors[k] && (
      <span id={`price-${k}-error`} className={form.error}>
        {errors[k]}
      </span>
    );
  const aria = (k) => ({ 'aria-invalid': Boolean(errors[k]), 'aria-describedby': errors[k] ? `price-${k}-error` : undefined });

  return (
    <Modal open onClose={onClose} title={isNew ? 'Thêm mục giá' : 'Sửa mục giá'} labelledBy="price-modal-title">
      <form className={form.form} onSubmit={submit} noValidate>
        {formError && (
          <p role="alert" className={form.alert}>
            {formError}
          </p>
        )}
        <label className={form.field}>
          <span className={form.label}>Dịch vụ</span>
          <select className={form.input} value={values.serviceSlug} onChange={set('serviceSlug')} {...aria('serviceSlug')}>
            {serviceKeys.map((k) => (
              <option key={k} value={k}>
                {services[k]}
              </option>
            ))}
          </select>
          {err('serviceSlug')}
        </label>
        <label className={form.field}>
          <span className={form.label}>Tên mục giá</span>
          <input
            className={form.input}
            value={values.name}
            onChange={set('name')}
            maxLength={120}
            placeholder="VD: Banner đầu trang chủ / ngày"
            {...aria('name')}
          />
          {err('name')}
        </label>
        <div className={form.row}>
          <label className={form.field}>
            <span className={form.label}>Đơn giá (đ)</span>
            <input
              className={form.input}
              value={values.unitPrice}
              onChange={set('unitPrice')}
              inputMode="numeric"
              placeholder="0 = Miễn phí"
              {...aria('unitPrice')}
            />
            {err('unitPrice')}
          </label>
          <label className={form.field}>
            <span className={form.label}>VAT</span>
            <select className={form.input} value={values.vat} onChange={set('vat')} {...aria('vat')}>
              {VAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {err('vat')}
          </label>
        </div>
        <label className={form.field}>
          <span className={form.label}>Trạng thái</span>
          <select className={form.input} value={values.status} onChange={set('status')} {...aria('status')}>
            <option value="draft">Bản nháp</option>
            <option value="published">Đã xuất bản</option>
          </select>
          <span className={form.hint}>Mục đã xuất bản sẽ cập nhật giá “Từ … đ” trên website ngay.</span>
          {err('status')}
        </label>

        <div className={`${form.actions} ${!isNew ? form.actionsSplit : ''}`}>
          {!isNew && (
            <div className={form.actionsGroup}>
              <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
                Xóa
              </Button>
              <Button variant="ghost" onClick={togglePublish} disabled={busy}>
                {item.status === 'published' ? 'Gỡ xuất bản' : 'Xuất bản ngay'}
              </Button>
            </div>
          )}
          <div className={form.actionsGroup}>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang lưu…' : isNew ? 'Thêm mục giá' : 'Lưu'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ====================== Các tab chỉ đọc khác ====================== */

function NewsTab() {
  const { data, error } = useApi((o) => api.news(20, o), [], null);
  const columns = [
    { key: 'title', label: 'Tiêu đề', width: 420 },
    { key: 'tag', label: 'Nhãn', width: 180, render: (r) => r.tag || '—' },
    { key: 'publishedAt', label: 'Ngày đăng', render: (r) => (r.publishedAt ? dateVN(r.publishedAt) : '—') },
  ];
  if (error) return <p role="alert" className={styles.error}>{error.message}</p>;
  if (!data) return <LoadingRow />;
  return (
    <>
      <DataTable caption="Tin tức" columns={columns} rows={data} rowKey={(r) => r.id} empty="Chưa có bài viết" />
      <p className={styles.note}>Chế độ chỉ xem. Biên tập tin tức sẽ được bổ sung sau.</p>
    </>
  );
}

function FaqTab() {
  const { data, error } = useApi((o) => api.faqs(o), [], null);
  const columns = [
    { key: 'question', label: 'Câu hỏi', width: 420 },
    { key: 'answer', label: 'Trả lời', render: (r) => <span className={styles.clip}>{r.answer}</span> },
  ];
  if (error) return <p role="alert" className={styles.error}>{error.message}</p>;
  if (!data) return <LoadingRow />;
  return (
    <>
      <DataTable caption="Câu hỏi thường gặp" columns={columns} rows={data} rowKey={(r) => r.id} empty="Chưa có câu hỏi" />
      <p className={styles.note}>Chế độ chỉ xem. Biên tập FAQ sẽ được bổ sung sau.</p>
    </>
  );
}

function EmptyTab({ text }) {
  return <p className={styles.empty}>{text}</p>;
}
