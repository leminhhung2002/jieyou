import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../adminApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { dateTimeShort, formatThousands, vnd } from '../format.js';
import { Button, DataTable, LoadingRow, Modal, PageHeader, StatusPill, Toast } from '../ui.jsx';
import HeaderButton from '../components/HeaderButton.jsx';
import form from '../components/form.module.css';
import styles from './LicensesPage.module.css';

const PRODUCT_STATUS = {
  active: { tone: 'success', label: 'Đang bán' },
  hidden: { tone: 'neutral', label: 'Ẩn' },
};
const KEY_STATUS = {
  available: { tone: 'info', label: 'Chưa bán' },
  sold: { tone: 'success', label: 'Đã bán' },
};

/** Admin: Key phần mềm bản quyền – sản phẩm (giá, ẩn/hiện) + kho key cho từng sản phẩm. */
export default function LicensesPage() {
  useDocumentTitle('Key bản quyền – JIEYOU Admin');
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const load = useCallback(() => {
    adminApi
      .licenses()
      .then((list) => {
        setProducts(list);
        setError(null);
        setSelectedId((id) => (list.some((p) => p.id === id) ? id : list[0]?.id ?? null));
      })
      .catch(setError);
  }, []);
  useEffect(load, [load]);

  /** Cập nhật số tồn của một sản phẩm sau khi nhập / xóa key */
  const patchProduct = (p) => setProducts((list) => list.map((x) => (x.id === p.id ? p : x)));
  const selected = products?.find((p) => p.id === selectedId) || null;

  const columns = [
    {
      key: 'name',
      label: 'Sản phẩm',
      render: (p) => (
        <span className={styles.nameCell}>
          {p.name}
          {p.category && <span className={styles.category}>{p.category}</span>}
        </span>
      ),
    },
    { key: 'price', label: 'Giá bán', align: 'right', width: 140, render: (p) => vnd(p.price) },
    { key: 'available', label: 'Còn', align: 'right', width: 90, render: (p) => <b className={p.available ? '' : styles.out}>{formatThousands(p.available)}</b> },
    { key: 'sold', label: 'Đã bán', align: 'right', width: 90, render: (p) => formatThousands(p.sold) },
    { key: 'status', label: 'Trạng thái', width: 130, render: (p) => <StatusPill tone={PRODUCT_STATUS[p.status]?.tone}>{PRODUCT_STATUS[p.status]?.label}</StatusPill> },
    {
      key: 'edit',
      label: '',
      width: 80,
      align: 'right',
      render: (p) => (
        <button
          type="button"
          className={styles.link}
          onClick={(e) => {
            e.stopPropagation();
            setEditing(p);
          }}
        >
          Sửa
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Key bản quyền"
        subtitle="Thêm sản phẩm, đặt giá và nhập kho key. Khách mua bằng số dư và nhận key ngay."
        actions={<HeaderButton onClick={() => setEditing('new')}>Thêm sản phẩm</HeaderButton>}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error.message}
        </p>
      )}
      {!products ? (
        <LoadingRow />
      ) : (
        <DataTable
          caption="Sản phẩm key bản quyền"
          columns={columns}
          rows={products}
          rowKey={(p) => p.id}
          onRowClick={(p) => setSelectedId(p.id)}
          selectedKey={selectedId}
          empty="Chưa có sản phẩm. Bấm “Thêm sản phẩm” để bắt đầu."
        />
      )}

      {selected && <KeysPanel key={selected.id} product={selected} onProduct={patchProduct} onToast={setToast} />}

      {editing && (
        <ProductModal
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(p, isNew) => {
            setEditing(null);
            if (isNew) {
              setProducts((list) => [...list, p]);
              setSelectedId(p.id);
            } else patchProduct(p);
            setToast({ message: isNew ? `Đã thêm ${p.name}. Nhập key để bắt đầu bán.` : `Đã lưu ${p.name}`, tone: 'success' });
          }}
          onDeleted={(p) => {
            setEditing(null);
            setToast({ message: `Đã xóa ${p.name}`, tone: 'success' });
            load();
          }}
        />
      )}
      <Toast message={toast?.message} tone={toast?.tone} onDone={closeToast} />
    </>
  );
}

/** Kho key của một sản phẩm: nhập thêm (mỗi dòng một key) + danh sách key. */
function KeysPanel({ product, onProduct, onToast }) {
  const [keys, setKeys] = useState(null);
  const [filter, setFilter] = useState('all');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    adminApi
      .licenseKeys(product.id)
      .then(({ data, meta }) => {
        setKeys(data);
        onProduct(meta.product);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  useEffect(load, [load]);

  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  const importKeys = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await adminApi.addLicenseKeys(product.id, text);
      setText('');
      const extra = [r.duplicates && `${r.duplicates} key trùng`, r.tooLong && `${r.tooLong} dòng quá dài`].filter(Boolean).join(', ');
      onToast({ message: `Đã nhập ${r.added} key${extra ? ` (bỏ qua ${extra})` : ''}`, tone: r.added ? 'success' : 'error' });
      load();
    } catch (e) {
      setError(e.status === 413 ? 'Dữ liệu quá lớn, hãy chia nhỏ (khoảng 2.000 key mỗi lần)' : e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeKey = async (k) => {
    try {
      const r = await adminApi.deleteLicenseKey(product.id, k.id);
      setKeys((list) => list.filter((x) => x.id !== k.id));
      onProduct(r.product);
      onToast({ message: 'Đã xóa key', tone: 'success' });
    } catch (e) {
      onToast({ message: e.message, tone: 'error' });
    }
  };

  const shown = (keys || []).filter((k) => filter === 'all' || k.status === filter);
  const columns = [
    { key: 'key', label: 'Key', render: (k) => <code className={styles.key}>{k.key}</code> },
    { key: 'status', label: 'Trạng thái', width: 120, render: (k) => <StatusPill tone={KEY_STATUS[k.status].tone}>{KEY_STATUS[k.status].label}</StatusPill> },
    {
      key: 'order',
      label: 'Đơn / khách',
      width: 220,
      render: (k) => (k.applicationCode ? <span className={styles.sub}>{k.applicationCode}<br />{k.customer}</span> : '—'),
    },
    { key: 'at', label: 'Thời gian', width: 140, render: (k) => dateTimeShort(k.soldAt || k.addedAt) },
    {
      key: 'del',
      label: '',
      width: 70,
      align: 'right',
      render: (k) =>
        k.status === 'available' ? (
          <button type="button" className={`${styles.link} ${styles.danger}`} onClick={() => removeKey(k)}>
            Xóa
          </button>
        ) : null,
    },
  ];

  return (
    <section className={styles.panel} aria-labelledby="keys-title">
      <div className={styles.panelHead}>
        <div>
          <p className={styles.eyebrow}>Kho key</p>
          <h2 id="keys-title" className={styles.panelTitle}>
            {product.name}
          </h2>
        </div>
        <p className={styles.counts}>
          Còn <b>{formatThousands(product.available)}</b> · Đã bán <b>{formatThousands(product.sold)}</b>
        </p>
      </div>

      <label className={form.field}>
        <span className={form.label}>Nhập key mới (mỗi dòng một key)</span>
        <textarea
          className={styles.textarea}
          rows={5}
          value={text}
          placeholder={'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY-YYYYY-YYYYY'}
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
          spellCheck={false}
        />
        <span className={form.hint}>Dòng trống và key đã có trong kho sẽ tự bỏ qua.</span>
        {error && (
          <span role="alert" className={form.error}>
            {error}
          </span>
        )}
      </label>
      <div className={styles.importRow}>
        <Button onClick={importKeys} disabled={busy || !lines}>
          {busy ? 'Đang nhập…' : lines ? `Nhập ${formatThousands(lines)} key` : 'Nhập key'}
        </Button>
      </div>

      <div className={styles.filters} role="group" aria-label="Lọc key">
        {[
          ['all', 'Tất cả'],
          ['available', 'Chưa bán'],
          ['sold', 'Đã bán'],
        ].map(([v, l]) => (
          <button key={v} type="button" className={`${styles.chip} ${filter === v ? styles.chipOn : ''}`} aria-pressed={filter === v} onClick={() => setFilter(v)}>
            {l}
          </button>
        ))}
      </div>
      {!keys ? <LoadingRow /> : <DataTable caption={`Key của ${product.name}`} columns={columns} rows={shown} rowKey={(k) => k.id} empty="Chưa có key" />}
    </section>
  );
}

function ProductModal({ product, onClose, onSaved, onDeleted }) {
  const isNew = !product;
  const [values, setValues] = useState({
    name: product?.name || '',
    category: product?.category || '',
    description: product?.description || '',
    price: product ? String(product.price) : '',
    status: product?.status || 'active',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k) => (e) => {
    const v = k === 'price' ? e.target.value.replace(/\D/g, '') : e.target.value;
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((s) => ({ ...s, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!values.name.trim()) errs.name = 'Vui lòng nhập tên sản phẩm';
    if (!(Number(values.price) >= 1000)) errs.price = 'Giá bán từ 1.000 đ';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError('');
    const body = { ...values, price: Number(values.price) };
    try {
      const p = isNew ? await adminApi.createLicense(body) : await adminApi.updateLicense(product.id, body);
      onSaved(p, isNew);
    } catch (err) {
      const field = err.details?.field;
      if (field) setErrors({ [field]: err.message });
      else setFormError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await adminApi.deleteLicense(product.id);
      onDeleted(product);
    } catch (err) {
      setConfirmDelete(false);
      setFormError(err.message);
      setBusy(false);
    }
  };

  const err = (k) =>
    errors[k] && (
      <span id={`lic-${k}-error`} className={form.error}>
        {errors[k]}
      </span>
    );
  const aria = (k) => ({ 'aria-invalid': Boolean(errors[k]), 'aria-describedby': errors[k] ? `lic-${k}-error` : undefined });

  if (confirmDelete) {
    return (
      <Modal open onClose={() => setConfirmDelete(false)} title={`Xóa ${product.name}?`} labelledBy="lic-delete-title">
        <p className={styles.modalText}>Sản phẩm và các key chưa bán sẽ bị xóa. Sản phẩm đã bán key thì chỉ ẩn được, không xóa được.</p>
        <div className={form.actions}>
          <div className={form.actionsGroup}>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? 'Đang xóa…' : 'Xóa sản phẩm'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Thêm sản phẩm' : 'Sửa sản phẩm'} labelledBy="lic-modal-title">
      <form className={form.form} onSubmit={submit} noValidate>
        {formError && (
          <p role="alert" className={form.alert}>
            {formError}
          </p>
        )}
        <label className={form.field}>
          <span className={form.label}>Tên sản phẩm</span>
          <input className={form.input} value={values.name} onChange={set('name')} maxLength={120} placeholder="VD: Windows 11 Pro" {...aria('name')} />
          {err('name')}
        </label>
        <div className={form.row}>
          <label className={form.field}>
            <span className={form.label}>Nhóm (không bắt buộc)</span>
            <input className={form.input} value={values.category} onChange={set('category')} maxLength={60} placeholder="VD: Windows, Office, Diệt virus" />
          </label>
          <label className={form.field}>
            <span className={form.label}>Giá bán / key (đ)</span>
            <input className={form.input} value={values.price} onChange={set('price')} inputMode="numeric" placeholder="VD: 150000" {...aria('price')} />
            {err('price')}
          </label>
        </div>
        <label className={form.field}>
          <span className={form.label}>Mô tả ngắn (không bắt buộc)</span>
          <input className={form.input} value={values.description} onChange={set('description')} maxLength={500} placeholder="VD: Kích hoạt vĩnh viễn, 1 máy" />
        </label>
        <label className={form.field}>
          <span className={form.label}>Trạng thái</span>
          <select className={form.input} value={values.status} onChange={set('status')}>
            <option value="active">Đang bán</option>
            <option value="hidden">Ẩn (khách không thấy)</option>
          </select>
        </label>
        <div className={`${form.actions} ${!isNew ? form.actionsSplit : ''}`}>
          {!isNew && (
            <div className={form.actionsGroup}>
              <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
                Xóa
              </Button>
            </div>
          )}
          <div className={form.actionsGroup}>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang lưu…' : isNew ? 'Thêm sản phẩm' : 'Lưu'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
