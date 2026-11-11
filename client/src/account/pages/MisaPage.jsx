import { useEffect, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { vnd } from '../../admin/format.js';
import { asset } from '../../utils/format.js';
import { useAccount } from '../AccountLayout.jsx';
import { useSubmitApplication } from '../useSubmitApplication.js';
import {
  Card,
  ChoiceCard,
  ChoiceGroup,
  CostCard,
  FormLayout,
  PageHeader,
  PrimaryButton,
  SelectField,
  SubmitError,
  TextField,
  Toggle,
} from '../ui.jsx';
import styles from './MisaPage.module.css';

const DEVICE_ICON = { basic: 'account/misa/device-basic.svg', printer: 'account/misa/device-printer.svg' };
const MAX_QTY = 50;

// Figma: Web người dùng: Máy bán hàng + MISA (74:3086)
export default function MisaPage() {
  useDocumentTitle('Đặt máy bán hàng + MISA – JIEYOU');
  const { summary, catalog } = useAccount();
  const { submit, submitting, error, fieldErrors, insufficient, clearError } = useSubmitApplication('misa');
  const [form, setForm] = useState({ device: 'basic', quantity: '1', address: '', einvoice: true, vat: 10, invoiceTaxCode: '' });

  // Điền sẵn MST xuất hóa đơn từ hồ sơ doanh nghiệp (chỉ khi người dùng chưa nhập)
  const profileTaxCode = summary?.user.taxCode || '';
  useEffect(() => {
    if (profileTaxCode) setForm((f) => (f.invoiceTaxCode ? f : { ...f, invoiceTaxCode: profileTaxCode }));
  }, [profileTaxCode]);

  // Thuế suất mặc định 10% nếu có trong danh mục, ngược lại lấy mức cao nhất
  const vatRates = catalog?.vatRates ?? [0, 5, 8, 10];
  useEffect(() => {
    if (catalog && !catalog.vatRates.includes(form.vat)) setForm((f) => ({ ...f, vat: catalog.vatRates.at(-1) }));
  }, [catalog, form.vat]);

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearError(key);
  };

  const devices = catalog?.misaDevices ?? [];
  const device = devices.find((d) => d.key === form.device) ?? devices[0];
  const qty = Number(form.quantity) || 0;
  const subtotal = (device?.price ?? 0) * qty;
  const vatAmount = Math.round((subtotal * form.vat) / 100);
  const total = subtotal + vatAmount;
  const balance = summary?.stats.balance ?? 0;

  const onSubmit = (e) => {
    e.preventDefault();
    submit({
      device: form.device,
      quantity: qty,
      address: form.address.trim(),
      einvoice: form.einvoice,
      vat: form.vat,
      invoiceTaxCode: form.einvoice ? form.invoiceTaxCode.trim() : undefined,
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        sticker="account/sticker/misa.png"
        eyebrow="Máy bán hàng + Hóa đơn MISA"
        title="Đặt máy bán hàng"
        subtitle="Chọn thiết bị và cấu hình hóa đơn điện tử MISA."
      />
      <FormLayout
        main={
          <>
            <Card title="Thiết bị" className={styles.deviceCard}>
              <ChoiceGroup label="Thiết bị" className={styles.devices}>
                {devices.map((d) => (
                  <ChoiceCard
                    key={d.key}
                    selected={form.device === d.key}
                    onSelect={() => update('device', d.key)}
                    className={`${styles.device} ${form.device === d.key ? styles.deviceOn : ''}`}
                    icon={
                      <span className={styles.deviceIcon}>
                        <img src={asset(DEVICE_ICON[d.key] ?? DEVICE_ICON.basic)} width="22" height="22" alt="" />
                      </span>
                    }
                    title={d.name}
                    subtitle={`${vnd(d.price)} / máy`}
                  />
                ))}
              </ChoiceGroup>
              {fieldErrors.device && <p className={styles.error}>{fieldErrors.device}</p>}
              <div className={styles.row}>
                <TextField
                  label="Số lượng"
                  name="quantity"
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={(e) => update('quantity', e.target.value.replace(/\D/g, '').slice(0, String(MAX_QTY).length))}
                  error={fieldErrors.quantity}
                  required
                />
                <TextField
                  label="Địa chỉ lắp đặt"
                  name="address"
                  icon="account/ui/map-pin.svg"
                  autoComplete="street-address"
                  placeholder="12 Nguyễn Huệ, Q.1, TP.HCM"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  error={fieldErrors.address}
                  required
                />
              </div>
            </Card>

            <Card className={styles.invoiceCard} aria-label="Hóa đơn điện tử MISA">
              <div className={styles.invoiceHead}>
                <span className={styles.invoiceIcon}>
                  <img src={asset('account/misa/einvoice.svg')} width="20" height="20" alt="" />
                </span>
                <div className={styles.invoiceText}>
                  <p className={styles.invoiceTitle}>
                    Xuất hóa đơn điện tử MISA meInvoice
                  </p>
                  <p className={styles.invoiceSub}>
                    {form.einvoice ? 'Hóa đơn phát hành theo hồ sơ' : 'Không xuất hóa đơn điện tử'}
                  </p>
                </div>
                <Toggle
                  checked={form.einvoice}
                  onChange={(v) => {
                    update('einvoice', v);
                    clearError('invoiceTaxCode');
                  }}
                  label="Xuất hóa đơn điện tử MISA meInvoice"
                />
              </div>
              <div className={styles.row}>
                <SelectField
                  label="Thuế VAT"
                  name="vat"
                  options={vatRates.map((r) => ({ value: r, label: `${r}%` }))}
                  value={form.vat}
                  onChange={(e) => update('vat', Number(e.target.value))}
                  error={fieldErrors.vat}
                  disabled={!form.einvoice}
                  className={form.einvoice ? '' : styles.off}
                />
                <TextField
                  label="Mã số thuế xuất hóa đơn"
                  name="invoiceTaxCode"
                  inputMode="numeric"
                  value={form.invoiceTaxCode}
                  onChange={(e) => update('invoiceTaxCode', e.target.value.replace(/[^\d-]/g, '').slice(0, 14))}
                  error={form.einvoice ? fieldErrors.invoiceTaxCode : undefined}
                  disabled={!form.einvoice}
                  required={form.einvoice}
                />
              </div>
            </Card>
          </>
        }
        aside={
          <>
            <CostCard
              className={styles.cost}
              rows={[
                { label: 'Thành tiền', value: vnd(subtotal) },
                { label: `Thuế VAT ${form.vat}%`, value: vnd(vatAmount), sign: 'plus' },
                { label: 'Tổng thanh toán', value: vnd(total), sign: 'equals', total: true },
                { label: 'Số dư sau khi gửi', value: vnd(balance - total) },
              ]}
              note="Trừ ngay khi gửi hồ sơ. Hoàn lại nếu hồ sơ bị từ chối."
            />
            <PrimaryButton type="submit" block disabled={submitting || !catalog}>
              {submitting ? 'Đang gửi…' : `Gửi hồ sơ, trừ ${vnd(total)}`}
            </PrimaryButton>
            <SubmitError error={error} insufficient={insufficient} />
          </>
        }
      />
    </form>
  );
}
