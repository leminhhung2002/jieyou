import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../adminApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { dateTimeShort, vnd } from '../format.js';
import { Button, DataTable, FilterChips, FilterSelect, LoadingRow, Modal, PageHeader, SearchInput, StatCard, StatGrid, StatusPill, Toast } from '../ui.jsx';
import form from '../components/form.module.css';
import styles from './SmmPricesPage.module.css';

/**
 * Giá dịch vụ tăng tương tác (hotrodvfb). Giá gốc = rate NCC × tỉ giá; giá bán = giá riêng của dịch vụ,
 * nếu không có thì giá gốc × (1 + % lãi chung). Ẩn dịch vụ → khách không thấy, không đặt được.
 */

const VIEW_OPTIONS = [
  { value: 'all', label: 'Tất cả dịch vụ' },
  { value: 'custom', label: 'Đang dùng giá riêng' },
  { value: 'hidden', label: 'Đang ẩn' },
  { value: 'loss', label: 'Bán dưới giá gốc' },
];

const num = (n) => Number(n || 0).toLocaleString('de-DE');
const margin = (s) => s.pricePer1000 - s.costPer1000;
const marginPct = (s) => (s.costPer1000 > 0 ? Math.round((margin(s) / s.costPer1000) * 100) : 0);
/** "28.000" / "28000" / "28,000" → 28000 */
const parseMoney = (v) => {
  const digits = String(v).replace(/[.,\s]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : NaN;
};

export default function SmmPricesPage() {
  useDocumentTitle('Giá MXH – JIEYOU Admin');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [platform, setPlatform] = useState('all');
  const [view, setView] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // dịch vụ đang sửa
  const [editMarkup, setEditMarkup] = useState(false);
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, tone = 'success') => setToast({ message, tone }), []);

  const load = useCallback((params, o) => {
    return adminApi
      .smm(params, o)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => err.name !== 'AbortError' && setError(err));
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load({}, { signal: ctrl.signal });
    return () => ctrl.abort();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load({ fresh: 1 });
    setRefreshing(false);
  };

  const rows = useMemo(() => {
    if (!data?.services) return [];
    const term = q.trim().toLowerCase();
    return data.services.filter((s) => {
      if (platform !== 'all' && s.platform !== platform) return false;
      if (view === 'custom' && s.customPrice === null) return false;
      if (view === 'hidden' && !s.disabled) return false;
      if (view === 'loss' && margin(s) >= 0) return false;
      if (term && !`${s.id} ${s.name} ${s.category}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [data, platform, view, q]);

  const replace = (svc) => setData((d) => ({ ...d, services: d.services.map((s) => (s.id === svc.id ? svc : s)) }));

  if (data && !data.enabled) {
    return (
      <>
        <PageHeader eyebrow="Admin › Giá MXH" title="Giá tăng tương tác" />
        <p className={styles.empty}>Chưa kết nối hotrodvfb. Thêm HOTRODVFB_API_KEY vào server/.env rồi khởi động lại server.</p>
      </>
    );
  }

  const columns = [
    { key: 'id', label: 'ID', width: 70, render: (s) => <span className={styles.muted}>#{s.id}</span> },
    {
      key: 'name',
      label: 'Dịch vụ',
      render: (s) => (
        <span className={styles.nameCell}>
          <span className={styles.name}>{s.name}</span>
          <span className={styles.sub}>
            {s.category} · {num(s.min)}–{num(s.max)}
            {s.refill ? ' · Bảo hành' : ''}
          </span>
        </span>
      ),
    },
    { key: 'cost', label: 'Giá gốc / 1.000', width: 140, align: 'right', render: (s) => <span className={styles.muted}>{vnd(s.costPer1000)}</span> },
    {
      key: 'price',
      label: 'Giá bán / 1.000',
      width: 170,
      align: 'right',
      render: (s) => (
        <span className={styles.priceCell}>
          <strong>{vnd(s.pricePer1000)}</strong>
          {s.customPrice !== null && <span className={styles.tag}>Giá riêng</span>}
        </span>
      ),
    },
    {
      key: 'margin',
      label: 'Lãi / 1.000',
      width: 150,
      align: 'right',
      render: (s) => (
        <span className={margin(s) < 0 ? styles.loss : styles.profit}>
          {vnd(margin(s))} <span className={styles.pct}>({marginPct(s)}%)</span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      width: 120,
      render: (s) => (s.disabled ? <StatusPill tone="neutral">Đã ẩn</StatusPill> : <StatusPill tone="success">Đang bán</StatusPill>),
    },
  ];

  const visible = data?.services?.filter((s) => !s.disabled).length ?? 0;
  const customCount = data?.services?.filter((s) => s.customPrice !== null).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Admin › Giá MXH"
        title="Giá tăng tương tác"
        subtitle="Giá gốc lấy từ hotrodvfb và quy đổi VND. Giá bán = giá gốc × (1 + % lãi), hoặc giá riêng bạn đặt cho từng dịch vụ."
        actions={
          <Button variant="outline" onClick={refresh} disabled={refreshing || !data}>
            {refreshing ? 'Đang tải…' : 'Tải lại giá NCC'}
          </Button>
        }
      />

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
              label="Số dư hotrodvfb"
              value={data.balance?.usd !== null && data.balance?.usd !== undefined ? `$${data.balance.usd.toFixed(2)}` : '—'}
              hint={data.balance?.vnd ? `≈ ${vnd(data.balance.vnd)}` : 'Không lấy được số dư'}
            />
            <StatCard label="Tỉ giá NCC" value={num(data.vndRate)} hint={`đ / 1 USD · cập nhật ${dateTimeShort(data.loadedAt)}`} />
            <div className={styles.markupCard}>
              <p className={styles.markupLabel}>% lãi chung</p>
              <p className={styles.markupValue}>{data.markupPercent}%</p>
              <button type="button" className={styles.link} onClick={() => setEditMarkup(true)}>
                Chỉnh % lãi
              </button>
            </div>
            <StatCard label="Dịch vụ đang bán" value={`${visible} / ${data.services.length}`} hint={`${customCount} dịch vụ dùng giá riêng`} />
          </StatGrid>

          <div className={styles.toolbar}>
            <FilterChips
              label="Nền tảng"
              value={platform}
              onChange={setPlatform}
              options={[{ value: 'all', label: 'Tất cả' }, ...data.platforms.map((p) => ({ value: p.key, label: p.name }))]}
            />
            <div className={styles.toolbarRight}>
              <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên, ID, danh mục…" className={styles.search} />
              <FilterSelect label="Lọc" value={view} onChange={setView} options={VIEW_OPTIONS} />
            </div>
          </div>

          <DataTable
            caption="Bảng giá dịch vụ tăng tương tác"
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            onRowClick={setEditing}
            empty="Không có dịch vụ phù hợp"
          />
          <p className={styles.note}>Bấm vào một dòng để đặt giá riêng hoặc ẩn dịch vụ. Giá mới áp dụng ngay cho đơn đặt sau đó.</p>
        </>
      )}

      {editing && (
        <ServiceModal
          svc={editing}
          markup={data.markupPercent}
          onClose={() => setEditing(null)}
          onSaved={(svc) => {
            replace(svc);
            setEditing(null);
            notify(`Đã cập nhật #${svc.id}`);
          }}
        />
      )}
      {editMarkup && (
        <MarkupModal
          current={data.markupPercent}
          fallback={data.defaultMarkupPercent}
          onClose={() => setEditMarkup(false)}
          onSaved={async (m) => {
            setEditMarkup(false);
            notify(`Đã đổi % lãi chung thành ${m}%`);
            await load({});
          }}
        />
      )}
      <Toast message={toast?.message} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}

/* ---------------------- Sửa giá một dịch vụ ---------------------- */

function ServiceModal({ svc, markup, onClose, onSaved }) {
  const [price, setPrice] = useState(svc.customPrice !== null ? num(svc.customPrice) : '');
  const [hidden, setHidden] = useState(svc.disabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const parsed = price.trim() === '' ? null : parseMoney(price);
  const effective = parsed ?? svc.defaultPrice;
  const invalid = parsed !== null && !(Number.isInteger(parsed) && parsed > 0);
  const preview = { ...svc, pricePer1000: invalid ? svc.pricePer1000 : effective };

  const save = async (patch) => {
    setBusy(true);
    setErr(null);
    try {
      onSaved(await adminApi.updateSmmService(svc.id, patch));
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (invalid) return setErr('Giá phải là số nguyên dương');
    return save({ price: parsed, disabled: hidden });
  };

  return (
    <Modal open onClose={onClose} title={`#${svc.id} · Giá dịch vụ`} labelledBy="smm-modal-title">
      <p className={styles.modalName}>{svc.name}</p>
      <dl className={styles.facts}>
        <div>
          <dt>Giá gốc NCC</dt>
          <dd>
            {vnd(svc.costPer1000)} <span className={styles.muted}>(${svc.providerRate} / 1.000)</span>
          </dd>
        </div>
        <div>
          <dt>Giá theo % lãi chung ({markup}%)</dt>
          <dd>{vnd(svc.defaultPrice)}</dd>
        </div>
        <div>
          <dt>Số lượng mỗi đơn</dt>
          <dd>
            {num(svc.min)} – {num(svc.max)}
          </dd>
        </div>
      </dl>
      <form className={form.form} onSubmit={submit} noValidate>
        {err && (
          <p role="alert" className={form.alert}>
            {err}
          </p>
        )}
        <label className={form.field}>
          <span className={form.label}>Giá bán riêng (đ / 1.000)</span>
          <input
            className={form.input}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
            placeholder={`Để trống = ${num(svc.defaultPrice)} (theo % lãi chung)`}
            aria-invalid={invalid}
          />
          <span className={`${form.hint} ${margin(preview) < 0 ? styles.loss : ''}`}>
            Khách trả {vnd(preview.pricePer1000)} / 1.000 · lãi {vnd(margin(preview))} ({marginPct(preview)}%)
            {margin(preview) < 0 ? ' — thấp hơn giá gốc, bán lỗ!' : ''}
          </span>
        </label>
        <label className={form.check}>
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          Ẩn dịch vụ này với khách
        </label>
        <div className={`${form.actions} ${form.actionsSplit}`}>
          <div className={form.actionsGroup}>
            {svc.customPrice !== null && (
              <Button variant="ghost" onClick={() => save({ price: null })} disabled={busy}>
                Về giá mặc định
              </Button>
            )}
          </div>
          <div className={form.actionsGroup}>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------- % lãi chung ---------------------- */

function MarkupModal({ current, fallback, onClose, onSaved }) {
  const [value, setValue] = useState(String(current));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const save = async (v) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await adminApi.setSmmMarkup(v);
      await onSaved(r.markupPercent);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 1000) return setErr('% lãi từ 0 đến 1000');
    return save(n);
  };

  return (
    <Modal open onClose={onClose} title="% lãi chung" labelledBy="smm-markup-title">
      <form className={form.form} onSubmit={submit} noValidate>
        {err && (
          <p role="alert" className={form.alert}>
            {err}
          </p>
        )}
        <label className={form.field}>
          <span className={form.label}>% lãi cộng trên giá gốc</span>
          <input className={form.input} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
          <span className={form.hint}>Áp dụng cho mọi dịch vụ không đặt giá riêng. VD 30% → giá gốc 10.000 đ bán 13.000 đ.</span>
        </label>
        <div className={`${form.actions} ${form.actionsSplit}`}>
          <div className={form.actionsGroup}>
            {current !== fallback && (
              <Button variant="ghost" onClick={() => save(null)} disabled={busy}>
                Về mặc định ({fallback}%)
              </Button>
            )}
          </div>
          <div className={form.actionsGroup}>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
