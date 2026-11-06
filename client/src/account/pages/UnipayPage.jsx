import { useEffect, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { phoneVN, vnd } from '../../admin/format.js';
import { accountApi } from '../accountApi.js';
import { useAccount } from '../AccountLayout.jsx';
import { useSubmitApplication } from '../useSubmitApplication.js';
import { Card, CostCard, FormGrid, FormLayout, OutlineButton, PageHeader, PrimaryButton, SubmitError, TextField } from '../ui.jsx';
import styles from './UnipayPage.module.css';

const EMPTY = { repName: '', phone: '', email: '', position: '', businessName: '', taxCode: '', address: '' };

// Figma: Web người dùng: Tài khoản UniPay (74:2752)
export default function UnipayPage() {
  useDocumentTitle('Đăng ký tài khoản UniPay – JIEYOU');
  const { summary, catalog, toast } = useAccount();
  const { submit, submitting, error, fieldErrors, insufficient, clearError } = useSubmitApplication('unipay');
  const [form, setForm] = useState(EMPTY);
  const [savingDraft, setSavingDraft] = useState(false);

  // Điền sẵn từ hồ sơ doanh nghiệp, sau đó ghi đè bằng bản nháp nếu có
  useEffect(() => {
    if (!summary) return undefined;
    const u = summary.user;
    const base = { ...EMPTY, businessName: u.businessName || '', taxCode: u.taxCode || '', phone: phoneVN(u.phone), email: u.email || '' };
    const ctrl = new AbortController();
    setForm((f) => (f === EMPTY ? base : f));
    accountApi
      .draft('unipay', { signal: ctrl.signal })
      .then((d) => d && setForm({ ...base, ...d.details }))
      .catch(() => {});
    return () => ctrl.abort();
    // Chỉ chạy lần đầu có summary
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(summary)]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    clearError(key);
  };

  const balance = summary?.stats.balance ?? 0;
  const fee = catalog?.fees.unipay ?? 0;

  const onSubmit = (e) => {
    e.preventDefault();
    submit(form);
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      await accountApi.saveDraft('unipay', form);
      toast('Đã lưu nháp hồ sơ UniPay.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const field = (key, label, props = {}) => (
    <TextField label={label} value={form[key]} onChange={set(key)} error={fieldErrors[key]} name={key} {...props} />
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        sticker="account/sticker/unipay.png"
        eyebrow="Tài khoản UniPay"
        title="Đăng ký tài khoản UniPay"
        subtitle="Mở tài khoản UniPay cho doanh nghiệp của bạn."
      />
      <FormLayout
        main={
          <Card title="Thông tin đại diện">
            <FormGrid>
              {field('repName', 'Họ tên người đại diện', { autoComplete: 'name', required: true, placeholder: 'Nguyễn Văn An' })}
              {field('phone', 'Số điện thoại', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', required: true })}
              {field('email', 'Email', { type: 'email', autoComplete: 'email', required: true })}
              {field('position', 'Chức vụ', { autoComplete: 'organization-title', required: true, placeholder: 'Giám đốc' })}
              {field('businessName', 'Tên doanh nghiệp', { span: true, autoComplete: 'organization', required: true })}
              {field('taxCode', 'Mã số thuế', { inputMode: 'numeric', required: true })}
              {field('address', 'Địa chỉ kinh doanh', { icon: 'account/ui/map-pin.svg', autoComplete: 'street-address', required: true, placeholder: '12 Nguyễn Huệ, Q.1, TP.HCM' })}
            </FormGrid>
          </Card>
        }
        aside={
          <>
            <CostCard
              rows={[
                { label: 'Số dư hiện tại', value: vnd(balance) },
                { label: 'Phí dịch vụ (theo Bảng giá)', value: vnd(fee), sign: 'minus' },
                { label: 'Số dư sau khi gửi', value: vnd(balance - fee), sign: 'equals', total: true },
              ]}
              note="Phí trừ ngay khi gửi hồ sơ. Hoàn lại nếu hồ sơ bị từ chối."
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
        className={styles.layout}
      />
    </form>
  );
}
