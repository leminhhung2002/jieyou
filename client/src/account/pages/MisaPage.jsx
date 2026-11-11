import { useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { vnd } from '../../admin/format.js';
import { asset } from '../../utils/format.js';
import { useAccount } from '../AccountLayout.jsx';
import { useSubmitApplication } from '../useSubmitApplication.js';
import { Card, CostCard, CostLead, FormLayout, PageHeader, PrimaryButton, QtyStepper, SubmitError, TextField } from '../ui.jsx';
import styles from './MisaPage.module.css';

/**
 * Ảnh thiết bị 60px – vị trí/cỡ từng lớp ảnh lấy đúng theo Figma (286:8569 … 287:9830).
 * `layers`: các lớp chồng lên nhau, `style` = khung của ảnh trong ô 60px.
 */
const DEVICE_IMAGES = {
  'q190-static': [
    { src: 'q190-static-screen.png', style: { left: '14.32%', top: '2.91%', width: '71.61%', height: '94.18%' } },
    { src: 'q190-static.png', cover: true },
  ],
  'q190-dynamic': [{ src: 'q190-dynamic.png', cover: true }],
  'sunmi-v3': [{ src: 'sunmi-v3.png', style: { left: '-3.24%', top: '-0.49%', width: '106.47%', height: '106.47%' } }],
  'a90-pro': [{ src: 'a90-pro.png', style: { left: '4.31%', top: 0, width: '91.39%', height: '100%' } }],
  'c20-lite': [{ src: 'c20-lite.png', style: { left: '-4.21%', top: '-7.16%', width: '113.71%', height: '113.71%' } }],
  'sunmi-desktop': [{ src: 'sunmi-desktop.png', style: { left: '-6.06%', top: '-5.49%', width: '112.12%', height: '112.12%' } }],
  cpad: [{ src: 'cpad.png', style: { left: '-9.37%', top: '-10.49%', width: '118.74%', height: '118.74%' } }],
};

function DeviceImage({ deviceKey }) {
  const layers = DEVICE_IMAGES[deviceKey];
  if (!layers) {
    return (
      <span className={styles.deviceImg}>
        <img className={styles.fallback} src={asset('account/misa/device-basic.svg')} width="28" height="28" alt="" />
      </span>
    );
  }
  return (
    <span className={styles.deviceImg}>
      {layers.map((l) => (
        <img
          key={l.src}
          src={asset(`account/misa/devices/${l.src}`)}
          className={l.cover ? styles.cover : styles.layer}
          style={l.style}
          loading="lazy"
          decoding="async"
          alt=""
        />
      ))}
    </span>
  );
}

// Figma: Web người dùng: Máy bán hàng + MISA (74:3086)
export default function MisaPage() {
  useDocumentTitle('Đặt máy bán hàng + MISA – JIEYOU');
  const { summary, catalog } = useAccount();
  const { submit, submitting, error, fieldErrors, insufficient, clearError } = useSubmitApplication('misa');
  // Số lượng theo từng thiết bị; 0 = không chọn. Mặc định chọn sẵn 1 thiết bị đầu tiên như Figma.
  const [qty, setQty] = useState(null);
  const [address, setAddress] = useState('');

  const devices = catalog?.misaDevices ?? [];
  const maxQty = catalog?.misaMaxQty ?? 50;
  const quantities = qty ?? (devices[0] ? { [devices[0].key]: 1 } : {});
  const setDeviceQty = (key, n) => {
    setQty({ ...quantities, [key]: n });
    clearError('device');
    clearError('quantity');
  };

  const items = devices.filter((d) => quantities[d.key] > 0).map((d) => ({ device: d, quantity: quantities[d.key] }));
  // Thuế VAT theo Figma: 10% (nếu admin bỏ mức 10% thì lấy mức cao nhất đang áp dụng)
  const vatRates = catalog?.vatRates ?? [10];
  const vat = vatRates.includes(10) ? 10 : vatRates.at(-1);
  const subtotal = items.reduce((sum, it) => sum + it.device.price * it.quantity, 0);
  const vatAmount = Math.round((subtotal * vat) / 100);
  const total = subtotal + vatAmount;
  const balance = summary?.stats.balance ?? 0;
  // Hóa đơn điện tử xuất theo MST trong hồ sơ doanh nghiệp (nếu có)
  const taxCode = summary?.user.taxCode || '';

  const onSubmit = (e) => {
    e.preventDefault();
    submit({
      items: items.map((it) => ({ device: it.device.key, quantity: it.quantity })),
      address: address.trim(),
      einvoice: Boolean(taxCode),
      vat,
      invoiceTaxCode: taxCode || undefined,
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
          <Card title="Thiết bị" className={styles.deviceCard}>
            <ul className={styles.devices}>
              {devices.map((d) => {
                const n = quantities[d.key] ?? 0;
                return (
                  <li key={d.key} className={`${styles.device} ${n > 0 ? styles.deviceOn : ''}`}>
                    <div className={styles.deviceTop}>
                      <DeviceImage deviceKey={d.key} />
                      <QtyStepper value={n} min={0} max={maxQty} onChange={(v) => setDeviceQty(d.key, v)} label={d.name} />
                    </div>
                    <div className={styles.deviceText}>
                      <p className={styles.deviceName}>{d.name}</p>
                      <p className={styles.devicePrice}>{vnd(d.price)} / máy</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {(fieldErrors.device || fieldErrors.quantity) && <p className={styles.error}>{fieldErrors.device || fieldErrors.quantity}</p>}
            <TextField
              label="Địa chỉ lắp đặt"
              name="address"
              icon="account/ui/map-pin.svg"
              autoComplete="street-address"
              placeholder="12 Nguyễn Huệ, Q.1, TP.HCM"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                clearError('address');
              }}
              error={fieldErrors.address}
              required
            />
          </Card>
        }
        aside={
          <>
            <CostCard
              title={null}
              aria-label="Chi phí"
              className={styles.cost}
              lead={
                <CostLead title="Thiết bị">
                  {items.length === 0 ? (
                    <p className={styles.emptyItems}>Chưa chọn thiết bị nào.</p>
                  ) : (
                    <ul className={styles.items}>
                      {items.map((it) => (
                        <li key={it.device.key} className={styles.item}>
                          <span className={styles.itemName}>{it.device.name}</span>
                          <span className={styles.itemQty}>x{it.quantity}</span>
                          <span className={styles.itemPrice}>{vnd(it.device.price * it.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CostLead>
              }
              rows={[
                { label: `Thuế VAT ${vat}%`, value: vnd(vatAmount), sign: 'plus' },
                { label: 'Tổng thanh toán', value: vnd(total), sign: 'equals', total: true },
                { label: 'Số dư sau khi gửi', value: vnd(balance - total) },
              ]}
            />
            <PrimaryButton type="submit" block disabled={submitting || !catalog || items.length === 0}>
              {submitting ? 'Đang gửi…' : `Gửi hồ sơ, trừ ${vnd(total)}`}
            </PrimaryButton>
            <SubmitError error={error} insufficient={insufficient} />
          </>
        }
      />
    </form>
  );
}
