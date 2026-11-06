import { useEffect, useMemo, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { dateVN, vnd } from '../../admin/format.js';
import { asset } from '../../utils/format.js';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import { useSubmitApplication } from '../useSubmitApplication.js';
import { Card, ChoiceCard, ChoiceGroup, CostCard, FormLayout, PageHeader, PrimaryButton, SubmitError, TextField } from '../ui.jsx';
import FileDrop, { fileMeta } from './FileDrop.jsx';
import styles from './AdsPage.module.css';

const MAX_DAYS = 60;
const DEFAULT_DAYS = 3;
const DAY = 24 * 3600_000;

// Ngày dạng 'YYYY-MM-DD' theo giờ máy
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
const overlaps = (from, to, bookings) => bookings.find((b) => b.from <= to && from <= b.to);

/** Khoảng trống sớm nhất (DEFAULT_DAYS ngày) kể từ hôm nay trên lịch của vị trí. */
function firstFreeRange(bookings, today) {
  let from = today;
  for (let i = 0; i < 365; i += 1) {
    const to = addDays(from, DEFAULT_DAYS - 1);
    const clash = overlaps(from, to, bookings);
    if (!clash) return { from, to };
    from = addDays(clash.to, 1);
  }
  return { from: today, to: addDays(today, DEFAULT_DAYS - 1) };
}

// Figma: Web người dùng: Tạo quảng cáo (74:2574)
export default function AdsPage() {
  useDocumentTitle('Tạo quảng cáo – JIEYOU');
  const { summary, catalog } = useAccount();
  const { submit, submitting, error, fieldErrors, insufficient, clearError } = useSubmitApplication('ads');
  const today = ymd(new Date());

  const [slot, setSlot] = useState('');
  const [bookings, setBookings] = useState({ slot: '', list: [], loading: true });
  const [range, setRange] = useState({ from: '', to: '', touched: false });
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});

  const slots = catalog?.adSlots || [];
  const current = slots.find((s) => s.key === slot);

  // Chọn sẵn vị trí đầu tiên khi có danh mục
  useEffect(() => {
    if (!slot && slots.length) setSlot(slots[0].key);
  }, [slot, slots]);

  // Lịch đã đặt của vị trí đang chọn
  useEffect(() => {
    if (!slot) return undefined;
    const ctrl = new AbortController();
    setBookings((b) => ({ ...b, loading: true }));
    accountApi
      .adBookings(slot, { signal: ctrl.signal })
      .then((list) => {
        const sorted = [...(list || [])].sort((a, b) => a.from.localeCompare(b.from));
        setBookings({ slot, list: sorted, loading: false });
        // Chưa sửa ngày → gợi ý khoảng trống sớm nhất
        setRange((r) => (r.touched ? r : { ...firstFreeRange(sorted, today), touched: false }));
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setBookings({ slot, list: [], loading: false });
      });
    return () => ctrl.abort();
  }, [slot, today]);

  const validRange = range.from && range.to && range.to >= range.from;
  const days = validRange ? daysBetween(range.from, range.to) : 0;
  const clash = validRange && bookings.slot === slot ? overlaps(range.from, range.to, bookings.list) : null;
  const price = current?.price ?? 0;
  const hold = price * days;
  const balance = summary?.stats.balance ?? 0;

  // Lỗi hiển thị: lỗi kiểm tra tại chỗ, lỗi máy chủ theo trường, và trùng lịch
  const rangeError = useMemo(() => {
    if (clash) return `Vị trí này đã có người đặt từ ${dateVN(clash.from)} đến ${dateVN(clash.to)}. Vui lòng chọn ngày khác.`;
    if (range.to && range.from && range.to < range.from) return 'Ngày kết thúc phải sau ngày bắt đầu';
    if (days > MAX_DAYS) return `Mỗi lần đặt tối đa ${MAX_DAYS} ngày`;
    return '';
  }, [clash, range.from, range.to, days]);

  const fromError = errors.from || fieldErrors.from;
  const toError = errors.to || fieldErrors.to || rangeError;

  const setDate = (key) => (e) => {
    const v = e.target.value;
    setRange((r) => {
      const next = { ...r, [key]: v, touched: true };
      // Ngày kết thúc theo ngày bắt đầu nếu đang trước nó
      if (key === 'from' && v && (!r.to || r.to < v)) next.to = v;
      return next;
    });
    setErrors((x) => ({ ...x, [key]: undefined, ...(key === 'from' ? { to: undefined } : {}) }));
    clearError(key);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!range.from) errs.from = 'Vui lòng chọn ngày bắt đầu';
    else if (range.from < today) errs.from = 'Ngày bắt đầu không được ở quá khứ';
    if (!range.to) errs.to = 'Vui lòng chọn ngày kết thúc';
    if (!image) errs.image = 'Vui lòng chọn hình ảnh banner';
    setErrors(errs);
    if (Object.keys(errs).length || rangeError || !current) return;
    submit({ slot, from: range.from, to: range.to, image: fileMeta(image) });
  };

  const upcoming = bookings.slot === slot ? bookings.list : [];

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        sticker="account/sticker/ads.png"
        eyebrow="Quảng cáo trên sàn"
        title="Tạo quảng cáo"
        subtitle="Chọn vị trí và ngày chạy. Tiền được tạm giữ cho đến khi quảng cáo được duyệt."
      />
      <FormLayout
        className={styles.layout}
        main={
          <>
            <Card title="Vị trí banner">
              <ChoiceGroup label="Vị trí banner" className={styles.slots}>
                {slots.map((s) => (
                  <ChoiceCard
                    key={s.key}
                    selected={s.key === slot}
                    onSelect={() => {
                      setSlot(s.key);
                      clearError('slot');
                    }}
                    className={styles.slot}
                    icon={
                      <span className={styles.slotIcon}>
                        <img src={asset('account/ads/image.svg')} width="22" height="22" alt="" />
                      </span>
                    }
                    title={s.name}
                    subtitle={s.note}
                  />
                ))}
              </ChoiceGroup>
              {fieldErrors.slot && (
                <p className={styles.error} role="alert">
                  {fieldErrors.slot}
                </p>
              )}
              <p className={styles.note}>Mỗi vị trí chỉ có 1 banner mỗi ngày. Ngày đã có người đặt sẽ bị khóa trên lịch.</p>
            </Card>

            <Card aria-label="Lịch chạy và hình ảnh">
              <div className={styles.dates}>
                <TextField
                  label="Từ ngày"
                  type="date"
                  name="from"
                  icon="account/ads/calendar.svg"
                  inputClassName={styles.dateInput}
                  value={range.from}
                  min={today}
                  onChange={setDate('from')}
                  error={fromError}
                  required
                />
                <TextField
                  label="Đến ngày"
                  type="date"
                  name="to"
                  icon="account/ads/calendar.svg"
                  inputClassName={styles.dateInput}
                  value={range.to}
                  min={range.from || today}
                  max={range.from ? addDays(range.from, MAX_DAYS - 1) : undefined}
                  onChange={setDate('to')}
                  error={toError}
                  required
                />
              </div>
              {upcoming.length > 0 && (
                <div className={styles.booked}>
                  <span className={styles.bookedLabel}>Ngày đã có người đặt:</span>
                  <ul className={styles.bookedList}>
                    {upcoming.map((b) => (
                      <li key={`${b.from}-${b.to}`} className={styles.bookedChip}>
                        {b.from === b.to ? dateVN(b.from) : `${dateVN(b.from)} – ${dateVN(b.to)}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <FileDrop
                label="Hình ảnh banner"
                text="Kéo thả ảnh vào đây hoặc chọn từ máy"
                accept="image/*"
                preview
                height={120}
                value={image}
                onChange={(f) => {
                  setImage(f);
                  setErrors((x) => ({ ...x, image: undefined }));
                  clearError('image');
                }}
                error={errors.image || fieldErrors.image}
              />
            </Card>
          </>
        }
        aside={
          <>
            <CostCard
              rows={[
                { label: 'Đơn giá mỗi ngày (theo Bảng giá)', value: vnd(price) },
                { label: 'Số ngày', value: String(days), sign: 'times' },
                { label: 'Cần tạm giữ', value: vnd(hold), sign: 'equals', total: true },
                { label: 'Khả dụng sau khi tạm giữ', value: vnd(balance - hold) },
              ]}
              note="Tiền tạm giữ trừ hẳn khi được duyệt và hoàn lại nếu bị từ chối."
            />
            <PrimaryButton type="submit" block disabled={submitting || !catalog || bookings.loading}>
              {submitting ? 'Đang gửi…' : `Gửi duyệt, tạm giữ ${vnd(hold)}`}
            </PrimaryButton>
            <SubmitError error={error} insufficient={insufficient} />
          </>
        }
      />
    </form>
  );
}
