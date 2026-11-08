import { useEffect, useId, useRef, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { vnd } from '../../admin/format.js';
import { asset, formatVnd } from '../../utils/format.js';
import { useAccount } from '../AccountLayout.jsx';
import { useSubmitApplication } from '../useSubmitApplication.js';
import {
  Card,
  ChoiceCard,
  ChoiceGroup,
  CostCard,
  FormGrid,
  FormLayout,
  PageHeader,
  PrimaryButton,
  SelectField,
  SubmitError,
  TextField,
} from '../ui.jsx';
import styles from './SocialPage.module.css';
import SmmSocialForm from './SmmSocialForm.jsx';

const PLATFORM_ICON = {
  facebook: 'account/social/facebook.svg',
  tiktok: 'account/social/tiktok.svg',
  youtube: 'account/social/youtube.svg',
  instagram: 'account/social/instagram.svg',
};
const URL_HINT = {
  facebook: 'https://facebook.com/ten-trang',
  tiktok: 'https://tiktok.com/@ten-kenh',
  youtube: 'https://youtube.com/@ten-kenh',
  instagram: 'https://instagram.com/ten-tai-khoan',
};
const MIN_QTY = 100;
const MAX_QTY = 1_000_000;

/** "1000" → "1.000" */
const groupDigits = (digits) => (digits ? formatVnd(Number(digits)) : '');

// Figma: Web người dùng: Tăng tương tác MXH (74:3419)
export default function SocialPage() {
  useDocumentTitle('Tăng tương tác mạng xã hội – JIEYOU');
  const { catalog } = useAccount();
  // Đã kết nối hotrodvfb → đặt đơn tự động theo danh mục NCC; chưa kết nối → form cũ, admin duyệt tay
  return catalog?.smm?.enabled ? <SmmSocialForm /> : <ManualSocialForm />;
}

function ManualSocialForm() {
  const { summary, catalog } = useAccount();
  const { submit, submitting, error, fieldErrors, insufficient, clearError } = useSubmitApplication('social');
  const [form, setForm] = useState({ platform: 'facebook', kind: 'like', quantity: '1000', url: '', accepted: false });
  const qtyRef = useRef(null);
  const caretDigits = useRef(null);
  const warnId = useId();

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearError(key);
  };

  // Ô số lượng định dạng "1.000" khi gõ: giữ vị trí con trỏ theo số chữ số đứng trước nó
  const onQuantity = (e) => {
    const el = e.target;
    qtyRef.current = el;
    caretDigits.current = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/\D/g, '').length;
    update('quantity', el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 7));
  };
  useEffect(() => {
    const el = qtyRef.current;
    if (caretDigits.current === null || !el || document.activeElement !== el) return;
    let n = caretDigits.current;
    let pos = 0;
    while (pos < el.value.length && n > 0) {
      if (/\d/.test(el.value[pos])) n -= 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [form.quantity]);

  const platforms = catalog?.socialPlatforms ?? [];
  const kinds = catalog?.socialKinds ?? [];
  const kind = kinds.find((k) => k.key === form.kind) ?? kinds[0];
  const qty = Number(form.quantity) || 0;
  const unit = kind?.price ?? 0;
  const total = unit * qty;
  const balance = summary?.stats.balance ?? 0;

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.accepted) return;
    submit({ platform: form.platform, kind: form.kind, quantity: qty, url: form.url.trim(), acceptedWarning: true });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        className={styles.header}
        sticker="account/social/sticker.png"
        eyebrow="Tăng tương tác MXH"
        title="Đặt dịch vụ tăng tương tác"
        subtitle="Chọn nền tảng, loại tương tác và số lượng."
      />
      <FormLayout
        main={
          <>
            <Card title="Nền tảng">
              <ChoiceGroup label="Nền tảng" className={styles.platforms}>
                {platforms.map((p) => (
                  <ChoiceCard
                    key={p.key}
                    selected={form.platform === p.key}
                    onSelect={() => update('platform', p.key)}
                    className={`${styles.platform} ${form.platform === p.key ? styles.platformOn : ''}`}
                    icon={<img src={asset(PLATFORM_ICON[p.key])} width="32" height="32" alt="" />}
                    title={p.name}
                  />
                ))}
              </ChoiceGroup>
              {fieldErrors.platform && <p className={styles.error}>{fieldErrors.platform}</p>}
            </Card>

            <Card aria-label="Chi tiết đơn">
              <FormGrid className={styles.grid}>
                <SelectField
                  label="Loại tương tác"
                  name="kind"
                  options={kinds.map((k) => ({ value: k.key, label: k.name }))}
                  value={form.kind}
                  onChange={(e) => update('kind', e.target.value)}
                  error={fieldErrors.kind}
                />
                <TextField
                  label="Số lượng"
                  name="quantity"
                  inputMode="numeric"
                  autoComplete="off"
                  value={groupDigits(form.quantity)}
                  onChange={onQuantity}
                  error={fieldErrors.quantity}
                  aria-description={`Từ ${formatVnd(MIN_QTY)} đến ${formatVnd(MAX_QTY)}`}
                  required
                />
                <TextField
                  span
                  label="Đường dẫn trang hoặc bài viết"
                  name="url"
                  type="url"
                  inputMode="url"
                  placeholder={URL_HINT[form.platform]}
                  value={form.url}
                  onChange={(e) => update('url', e.target.value)}
                  error={fieldErrors.url}
                  required
                />
              </FormGrid>
            </Card>

            <label className={styles.warning} htmlFor={warnId}>
              <input
                id={warnId}
                type="checkbox"
                className={styles.checkInput}
                checked={form.accepted}
                onChange={(e) => {
                  update('accepted', e.target.checked);
                  clearError('acceptedWarning');
                }}
              />
              <span className={styles.checkBox} aria-hidden="true">
                <img src={asset('account/social/check.svg')} width="14" height="14" alt="" />
              </span>
              <span>Tôi đã đọc cảnh báo: dịch vụ này có thể trái điều khoản của nền tảng mạng xã hội.</span>
            </label>
            {fieldErrors.acceptedWarning && <p className={styles.error}>{fieldErrors.acceptedWarning}</p>}
          </>
        }
        aside={
          <>
            <CostCard
              rows={[
                { label: 'Đơn giá mỗi lượt (theo Bảng giá)', value: vnd(unit) },
                { label: 'Số lượng', value: formatVnd(qty), sign: 'times' },
                { label: 'Tổng thanh toán', value: vnd(total), sign: 'equals', total: true },
                { label: 'Số dư sau khi gửi', value: vnd(balance - total) },
              ]}
            />
            <PrimaryButton type="submit" block disabled={submitting || !catalog || !form.accepted}>
              {submitting ? 'Đang gửi…' : `Đặt đơn, trừ ${vnd(total)}`}
            </PrimaryButton>
            <SubmitError error={error} insufficient={insufficient} />
          </>
        }
      />
    </form>
  );
}
