import { useEffect, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { phoneVN, vnd } from '../../admin/format.js';
import { asset } from '../../utils/format.js';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import { useSubmitApplication } from '../useSubmitApplication.js';
import { Card, CostCard, FormGrid, FormLayout, OutlineButton, PageHeader, PrimaryButton, SelectField, SubmitError, TextField } from '../ui.jsx';
import FileDrop, { fileMeta } from './FileDrop.jsx';
import styles from './PosPage.module.css';

const EMPTY = { storeName: '', businessType: '', address: '', phone: '', email: '', attachments: [] };

function validate(f) {
  const e = {};
  if (!f.storeName.trim()) e.storeName = 'Vui lòng nhập tên cửa hàng';
  if (!f.businessType) e.businessType = 'Vui lòng chọn loại hình kinh doanh';
  if (!f.address.trim()) e.address = 'Vui lòng nhập địa chỉ cửa hàng';
  if (!/^(\+?84|0)\d{9}$/.test(f.phone.replace(/[\s.-]/g, ''))) e.phone = 'Số điện thoại không hợp lệ';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Email không hợp lệ';
  if (!f.attachments.length) e.attachments = 'Vui lòng đính kèm giấy tờ';
  return e;
}

// Figma: Web người dùng: Hồ sơ cổng thanh toán POS (74:3269)
export default function PosPage() {
  useDocumentTitle('Đăng ký cổng thanh toán POS – JIEYOU');
  const { summary, catalog, toast } = useAccount();
  const { submit, submitting, error, fieldErrors, insufficient, clearError } = useSubmitApplication('pos');
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [savingDraft, setSavingDraft] = useState(false);

  // Điền sẵn SĐT/email từ hồ sơ, sau đó ghi đè bằng bản nháp nếu có
  useEffect(() => {
    if (!summary) return undefined;
    const u = summary.user;
    const base = { ...EMPTY, phone: phoneVN(u.phone), email: u.email || '' };
    const ctrl = new AbortController();
    setForm((f) => (f === EMPTY ? base : f));
    accountApi
      .draft('pos', { signal: ctrl.signal })
      .then((d) => d && setForm({ ...base, ...d.details, attachments: d.details?.attachments || [] }))
      .catch(() => {});
    return () => ctrl.abort();
    // Chỉ chạy lần đầu có summary
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(summary)]);

  // Mặc định loại hình đầu tiên khi có danh mục
  useEffect(() => {
    if (catalog?.posBusinessTypes?.length) setForm((f) => (f.businessType ? f : { ...f, businessType: catalog.posBusinessTypes[0] }));
  }, [catalog]);

  const fee = catalog?.fees.pos ?? 0;
  const err = (k) => errors[k] || fieldErrors[k];

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    clearError(key);
  };
  const set = (key) => (e) => update(key, e.target.value);

  const payload = () => ({ ...form, attachments: form.attachments.map(fileMeta) });

  const onSubmit = (e) => {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    submit(payload());
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      await accountApi.saveDraft('pos', payload());
      toast('Đã lưu nháp hồ sơ cổng thanh toán POS.');
    } catch (ex) {
      toast(ex.message, 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const field = (key, label, props = {}) => (
    <TextField label={label} value={form[key]} onChange={set(key)} error={err(key)} name={key} {...props} />
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        sticker="account/sticker/pos.png"
        eyebrow="Hồ sơ cổng thanh toán POS"
        title="Đăng ký cổng thanh toán POS"
        subtitle="Điền thông tin cửa hàng để kích hoạt cổng thanh toán POS."
        className={styles.header}
      />
      {fee === 0 && (
        <p className={styles.notice}>
          <img src={asset('account/pos/check-circle.svg')} width="24" height="24" alt="" />
          Dịch vụ miễn phí. Gửi hồ sơ không trừ tiền trong tài khoản trả trước.
        </p>
      )}
      <FormLayout
        className={styles.layout}
        main={
          <Card title="Thông tin cửa hàng" className={styles.card}>
            <FormGrid>
              {field('storeName', 'Tên cửa hàng', { autoComplete: 'organization', required: true, placeholder: 'An Phát Mart' })}
              <SelectField
                label="Loại hình kinh doanh"
                name="businessType"
                className={styles.select}
                value={form.businessType}
                onChange={set('businessType')}
                error={err('businessType')}
                options={catalog?.posBusinessTypes || []}
              />
              {field('address', 'Địa chỉ cửa hàng', {
                span: true,
                icon: 'account/ui/map-pin.svg',
                autoComplete: 'street-address',
                required: true,
                placeholder: '12 Nguyễn Huệ, Q.1, TP.HCM',
              })}
              {field('phone', 'Số điện thoại cửa hàng', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', required: true, placeholder: '0912 345 678' })}
              {field('email', 'Email nhận thông báo', { type: 'email', autoComplete: 'email', required: true, placeholder: 'ten@congty.vn' })}
              <FileDrop
                label="Giấy tờ đính kèm"
                className={styles.span}
                multiple
                value={form.attachments}
                onChange={(list) => update('attachments', list)}
                error={err('attachments')}
              />
            </FormGrid>
          </Card>
        }
        aside={
          <>
            <CostCard
              title="Tóm tắt"
              className={styles.summary}
              rows={[
                { label: 'Phí dịch vụ', value: fee === 0 ? 'Miễn phí' : vnd(fee) },
                { label: 'Số tiền bị trừ', value: vnd(fee) },
              ]}
            />
            <PrimaryButton type="submit" block disabled={submitting || !catalog}>
              {submitting ? 'Đang gửi…' : 'Gửi hồ sơ'}
            </PrimaryButton>
            <OutlineButton block onClick={saveDraft} disabled={savingDraft}>
              {savingDraft ? 'Đang lưu…' : 'Lưu nháp'}
            </OutlineButton>
            <SubmitError error={error} insufficient={insufficient} />
          </>
        }
      />
    </form>
  );
}
