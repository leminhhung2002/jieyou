import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../adminApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { dateTimeShort, vnd } from '../format.js';
import { Button, LoadingRow, PageHeader, Toast } from '../ui.jsx';
import form from '../components/form.module.css';
import styles from './FeesPage.module.css';

/**
 * Phí Máy bán hàng + MISA và Hồ sơ cổng thanh toán POS.
 * Lưu là áp dụng ngay cho Web người dùng, app điện thoại và trang dịch vụ (server/src/services/feeSettings.js).
 */

const num = (n) => Number(n || 0).toLocaleString('de-DE');
/** "2.400.000" / "2400000" / "2,400,000" → 2400000; rỗng → NaN */
const parseMoney = (v) => {
  const digits = String(v).replace(/[.,\s]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : NaN;
};
const moneyInput = (v) => {
  const digits = String(v).replace(/\D/g, '').slice(0, 10);
  return digits ? num(Number(digits)) : '';
};

export default function FeesPage() {
  useDocumentTitle('Phí MISA & POS – JIEYOU Admin');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, tone = 'success') => setToast({ message, tone }), []);

  useEffect(() => {
    const ctrl = new AbortController();
    adminApi
      .fees({ signal: ctrl.signal })
      .then(setData)
      .catch((err) => err.name !== 'AbortError' && setError(err));
    return () => ctrl.abort();
  }, []);

  /** Gửi một phần cài đặt; trả về thông báo lỗi (nếu có) cho form hiển thị. */
  const save = async (patch, message) => {
    try {
      const d = await adminApi.updateFees(patch);
      setData(d);
      notify(message);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin › Phí MISA & POS"
        title="Phí máy bán hàng & POS"
        subtitle={
          data?.updatedAt
            ? `Lưu là áp dụng ngay cho Web, App và trang dịch vụ. Cập nhật lần cuối ${dateTimeShort(data.updatedAt)}.`
            : 'Lưu là áp dụng ngay cho Web, App và trang dịch vụ.'
        }
      />
      {error && <p className={styles.error}>{error.message}</p>}
      {!data && !error && <LoadingRow />}
      {data && (
        <div className={styles.grid}>
          <DevicesCard data={data} save={save} />
          <PosCard data={data} save={save} />
          <MachinesCard data={data} save={save} />
          <PlansCard data={data} save={save} />
        </div>
      )}
      <Toast message={toast?.message} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}

function Panel({ eyebrow, title, children, onSubmit, onReset, saving, err, dirty }) {
  return (
    <form className={styles.panel} onSubmit={onSubmit} noValidate>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={styles.title}>{title}</h2>
      </div>
      {children}
      {err && <p className={form.alert} role="alert">{err}</p>}
      <div className={`${form.actions} ${form.actionsSplit}`}>
        <Button variant="ghost" onClick={onReset} disabled={saving}>
          Khôi phục mặc định
        </Button>
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}

/** Hook nhỏ dùng chung: trạng thái lưu + lỗi của một thẻ. */
function useSaver(save) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const run = async (patch, message) => {
    setSaving(true);
    setErr(await save(patch, message));
    setSaving(false);
  };
  return { saving, err, setErr, run };
}

/* ---------- Máy bán hàng (Web người dùng · Đặt máy) + VAT ---------- */
function DevicesCard({ data, save }) {
  const init = () => ({
    prices: Object.fromEntries(data.misaDevices.map((d) => [d.key, num(d.price)])),
    vat: data.vatRates.join(', '),
  });
  const [f, setF] = useState(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setF(init()), [data]);
  const { saving, err, setErr, run } = useSaver(save);

  const parsedVat = f.vat
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((x) => Number(x.replace('%', '').replace(',', '.')));
  const dirty =
    data.misaDevices.some((d) => parseMoney(f.prices[d.key]) !== d.price) || parsedVat.join(',') !== data.vatRates.join(',');

  const onSubmit = (e) => {
    e.preventDefault();
    const misaDevices = {};
    for (const d of data.misaDevices) {
      const n = parseMoney(f.prices[d.key]);
      if (Number.isNaN(n)) return setErr(`Nhập giá cho "${d.name}"`);
      misaDevices[d.key] = n === d.defaultPrice && !d.custom ? null : n;
    }
    if (!parsedVat.length || parsedVat.some((r) => !Number.isFinite(r) || r < 0 || r > 100)) {
      return setErr('Thuế VAT: nhập các mức từ 0 đến 100, cách nhau bằng dấu phẩy (VD: 0, 5, 8, 10)');
    }
    return run({ misaDevices, vatRates: parsedVat }, 'Đã lưu giá máy bán hàng và thuế VAT.');
  };
  const onReset = () =>
    run(
      { misaDevices: Object.fromEntries(data.misaDevices.map((d) => [d.key, null])), vatRates: null },
      'Đã khôi phục giá máy và VAT mặc định.',
    );

  return (
    <Panel
      eyebrow="Web người dùng · Đặt máy bán hàng"
      title="Giá máy bán hàng + MISA"
      onSubmit={onSubmit}
      onReset={onReset}
      saving={saving}
      err={err}
      dirty={dirty}
    >
      {data.misaDevices.map((d) => (
        <label key={d.key} className={form.field}>
          <span className={form.label}>{d.name} (đ / máy)</span>
          <input
            className={form.input}
            inputMode="numeric"
            value={f.prices[d.key]}
            onChange={(e) => setF((x) => ({ ...x, prices: { ...x.prices, [d.key]: moneyInput(e.target.value) } }))}
          />
          <span className={form.hint}>Mặc định {vnd(d.defaultPrice)}</span>
        </label>
      ))}
      <label className={form.field}>
        <span className={form.label}>Các mức thuế VAT khách được chọn (%)</span>
        <input className={form.input} value={f.vat} onChange={(e) => setF((x) => ({ ...x, vat: e.target.value }))} placeholder="0, 5, 8, 10" />
        <span className={form.hint}>
          Cách nhau bằng dấu phẩy. Mặc định {data.defaultVatRates.join(', ')}. Tổng thanh toán = giá máy × số lượng + VAT.
        </span>
      </label>
    </Panel>
  );
}

/* ---------- Hồ sơ cổng thanh toán POS ---------- */
function PosCard({ data, save }) {
  const [v, setV] = useState(num(data.posFee));
  useEffect(() => setV(num(data.posFee)), [data.posFee]);
  const { saving, err, setErr, run } = useSaver(save);
  const n = parseMoney(v);

  const onSubmit = (e) => {
    e.preventDefault();
    if (Number.isNaN(n)) return setErr('Nhập phí dịch vụ (0 = miễn phí)');
    return run({ posFee: n }, n === 0 ? 'Hồ sơ POS: miễn phí.' : `Phí hồ sơ POS: ${vnd(n)}.`);
  };

  return (
    <Panel
      eyebrow="Web người dùng · Hồ sơ cổng thanh toán POS"
      title="Phí hồ sơ POS"
      onSubmit={onSubmit}
      onReset={() => run({ posFee: null }, 'Đã khôi phục phí POS mặc định.')}
      saving={saving}
      err={err}
      dirty={n !== data.posFee}
    >
      <label className={form.field}>
        <span className={form.label}>Phí dịch vụ / hồ sơ (đ)</span>
        <input className={form.input} inputMode="numeric" value={v} onChange={(e) => setV(moneyInput(e.target.value))} />
        <span className={form.hint}>
          Nhập 0 = Miễn phí (gửi hồ sơ không trừ tiền). Mặc định {data.defaultPosFee === 0 ? 'miễn phí' : vnd(data.defaultPosFee)}. Phí trừ vào
          tài khoản trả trước khi khách gửi hồ sơ, hoàn lại nếu bị từ chối.
        </span>
      </label>
      <p className={styles.preview}>
        Khách đang thấy: <strong>{data.posFee === 0 ? 'Miễn phí' : vnd(data.posFee)}</strong>
      </p>
    </Panel>
  );
}

/* ---------- Trang dịch vụ: Mẫu máy (giá / tháng) ---------- */
function MachinesCard({ data, save }) {
  const init = () => Object.fromEntries(data.machines.map((m) => [m.id, num(m.price)]));
  const [f, setF] = useState(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setF(init()), [data]);
  const { saving, err, setErr, run } = useSaver(save);
  const dirty = data.machines.some((m) => parseMoney(f[m.id]) !== m.price);

  const onSubmit = (e) => {
    e.preventDefault();
    const machines = {};
    for (const m of data.machines) {
      const n = parseMoney(f[m.id]);
      if (Number.isNaN(n)) return setErr(`Nhập giá cho "${m.name}"`);
      machines[m.id] = n === m.defaultPrice && !m.custom ? null : n;
    }
    return run({ machines }, 'Đã lưu giá mẫu máy trên trang dịch vụ.');
  };

  return (
    <Panel
      eyebrow="Trang dịch vụ · Máy bán hàng hóa đơn"
      title="Mẫu máy (giá theo tháng)"
      onSubmit={onSubmit}
      onReset={() => run({ machines: Object.fromEntries(data.machines.map((m) => [m.id, null])) }, 'Đã khôi phục giá mẫu máy mặc định.')}
      saving={saving}
      err={err}
      dirty={dirty}
    >
      {data.machines.map((m) => (
        <label key={m.id} className={form.field}>
          <span className={form.label}>
            {m.name} (đ {m.period})
          </span>
          <input
            className={form.input}
            inputMode="numeric"
            value={f[m.id]}
            onChange={(e) => setF((x) => ({ ...x, [m.id]: moneyInput(e.target.value) }))}
          />
          <span className={form.hint}>Mặc định {vnd(m.defaultPrice)}. Nhập 0 = hiển thị 0 đ.</span>
        </label>
      ))}
    </Panel>
  );
}

/* ---------- Trang dịch vụ: Gói hóa đơn MISA ---------- */
function PlansCard({ data, save }) {
  const init = () => data.invoicePlans.map((p) => ({ id: p.id, invoices: num(p.invoices), price: num(p.price) }));
  const [rows, setRows] = useState(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setRows(init()), [data]);
  const { saving, err, setErr, run } = useSaver(save);

  const parsed = rows.map((r) => ({ id: r.id.trim(), invoices: parseMoney(r.invoices), price: parseMoney(r.price) }));
  const dirty = JSON.stringify(parsed) !== JSON.stringify(data.invoicePlans);
  const set = (i, key, value) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  const onSubmit = (e) => {
    e.preventDefault();
    if (!parsed.length) return setErr('Cần ít nhất 1 gói hóa đơn');
    const bad = parsed.findIndex((p) => !p.id || !(p.invoices > 0) || Number.isNaN(p.price));
    if (bad >= 0) return setErr(`Gói #${bad + 1}: nhập đủ tên gói, số hóa đơn và giá`);
    return run({ invoicePlans: parsed }, 'Đã lưu gói hóa đơn MISA.');
  };

  return (
    <Panel
      eyebrow="Trang dịch vụ · Máy bán hàng hóa đơn"
      title="Gói hóa đơn MISA"
      onSubmit={onSubmit}
      onReset={() => run({ invoicePlans: null }, 'Đã khôi phục gói hóa đơn mặc định.')}
      saving={saving}
      err={err}
      dirty={dirty}
    >
      <div className={styles.plans} role="table" aria-label="Gói hóa đơn MISA">
        <div className={styles.planHead} role="row">
          <span role="columnheader">Gói</span>
          <span role="columnheader">Số hóa đơn</span>
          <span role="columnheader">Giá (đ)</span>
          <span aria-hidden="true" />
        </div>
        {rows.map((r, i) => (
          <div key={i} className={styles.planRow} role="row">
            <input
              className={form.input}
              aria-label={`Tên gói #${i + 1}`}
              value={r.id}
              maxLength={20}
              onChange={(e) => set(i, 'id', e.target.value)}
            />
            <input
              className={form.input}
              aria-label={`Số hóa đơn gói #${i + 1}`}
              inputMode="numeric"
              value={r.invoices}
              onChange={(e) => set(i, 'invoices', moneyInput(e.target.value))}
            />
            <input
              className={form.input}
              aria-label={`Giá gói #${i + 1}`}
              inputMode="numeric"
              value={r.price}
              onChange={(e) => set(i, 'price', moneyInput(e.target.value))}
            />
            <button
              type="button"
              className={styles.remove}
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              disabled={rows.length <= 1}
              aria-label={`Xóa gói #${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {rows.length < 10 && (
        <button type="button" className={styles.add} onClick={() => setRows((rs) => [...rs, { id: '', invoices: '', price: '' }])}>
          + Thêm gói
        </button>
      )}
    </Panel>
  );
}
