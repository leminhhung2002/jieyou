import { adminStore } from './adminStore.js';
import { priceOf } from './accountStore.js';
import { FLAT_FEES, MISA_DEVICES, VAT_RATES } from '../data/accountCatalog.js';
import misaContent from '../data/serviceContent/may-ban-hang-misa.js';

/**
 * Cài đặt phí Máy bán hàng + 1INVOICE và Hồ sơ cổng thanh toán POS (màn Admin › Phí 1INVOICE & POS).
 * Lưu trong adminStore.db.feeSettings (SQLite). Giá trị `null` = dùng mặc định
 * (Bảng giá đã xuất bản nếu có, không thì giá trong danh mục).
 */
export const EMPTY_FEE_SETTINGS = () => ({
  misaDevices: {}, // key -> giá / máy (Web người dùng: Đặt máy bán hàng)
  vatRates: null, // [0, 5, 8, 10]
  posFee: null, // Phí dịch vụ hồ sơ POS (0 = miễn phí)
  machines: {}, // id -> giá / tháng (trang dịch vụ: Mẫu máy)
  invoicePlans: null, // [{ id, invoices, price }] (trang dịch vụ: Gói hóa đơn 1INVOICE)
});

const s = () => {
  if (!adminStore.db.feeSettings) adminStore.db.feeSettings = EMPTY_FEE_SETTINGS();
  return adminStore.db.feeSettings;
};

const defaultDevicePrice = (d) => priceOf(d.priceName, d.defaultPrice, 'may-ban-hang-misa');
const defaultPosFee = () => priceOf(FLAT_FEES.pos.priceName, FLAT_FEES.pos.defaultPrice, FLAT_FEES.pos.serviceSlug);

export const misaDevicePrice = (d) => s().misaDevices?.[d.key] ?? defaultDevicePrice(d);
export const vatRates = () => s().vatRates ?? VAT_RATES;
export const posFee = () => s().posFee ?? defaultPosFee();

/** Nội dung trang dịch vụ MISA đã áp giá admin. */
export function misaServiceContent() {
  const st = s();
  return {
    ...misaContent,
    machines: misaContent.machines.map((m) => ({ ...m, price: st.machines?.[m.id] ?? m.price })),
    invoicePlans: { ...misaContent.invoicePlans, plans: st.invoicePlans ?? misaContent.invoicePlans.plans },
  };
}

/** Dữ liệu cho màn admin: giá đang áp dụng + giá mặc định để so sánh / khôi phục. */
export function feeSettingsView() {
  const st = s();
  const content = misaServiceContent();
  return {
    misaDevices: MISA_DEVICES.map((d) => ({
      key: d.key,
      name: d.name,
      price: misaDevicePrice(d),
      defaultPrice: defaultDevicePrice(d),
      custom: st.misaDevices?.[d.key] != null,
    })),
    vatRates: vatRates(),
    defaultVatRates: VAT_RATES,
    posFee: posFee(),
    defaultPosFee: defaultPosFee(),
    machines: content.machines.map((m) => ({
      id: m.id,
      name: m.name,
      period: m.period,
      price: m.price,
      defaultPrice: misaContent.machines.find((x) => x.id === m.id)?.price ?? 0,
      custom: st.machines?.[m.id] != null,
    })),
    invoicePlans: content.invoicePlans.plans,
    defaultInvoicePlans: misaContent.invoicePlans.plans,
    updatedAt: st.updatedAt || null,
  };
}

const MAX_PRICE = 1_000_000_000;

function money(v, field, label) {
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_PRICE) {
    const err = new Error(`${label}: số nguyên từ 0 đến 1.000.000.000 đ`);
    err.field = field;
    throw err;
  }
  return n;
}

/**
 * Kiểm tra + áp dụng thay đổi (chỉ các khóa có trong body). Ném Error có `field` khi dữ liệu sai.
 * Trả về danh sách mô tả thay đổi để ghi nhật ký.
 */
export function applyFeeSettings(body) {
  const st = s();
  const next = structuredClone(st);
  const changes = [];

  if (body.misaDevices !== undefined) {
    if (typeof body.misaDevices !== 'object' || body.misaDevices === null) throw Object.assign(new Error('Giá máy không hợp lệ'), { field: 'misaDevices' });
    for (const [key, v] of Object.entries(body.misaDevices)) {
      const d = MISA_DEVICES.find((x) => x.key === key);
      if (!d) throw Object.assign(new Error('Thiết bị không tồn tại'), { field: `misaDevices.${key}` });
      const n = money(v, `misaDevices.${key}`, d.name);
      if (n === null) delete next.misaDevices[key];
      else next.misaDevices[key] = n;
      changes.push(`${d.name}: ${n === null ? 'mặc định' : `${n.toLocaleString('de-DE')} đ`}`);
    }
  }

  if (body.vatRates !== undefined) {
    if (body.vatRates === null) next.vatRates = null;
    else {
      const rates = Array.isArray(body.vatRates) ? body.vatRates.map(Number) : [];
      if (!rates.length || rates.length > 10 || !rates.every((r) => Number.isFinite(r) && r >= 0 && r <= 100)) {
        throw Object.assign(new Error('Thuế VAT: chọn ít nhất 1 mức, mỗi mức từ 0 đến 100%'), { field: 'vatRates' });
      }
      next.vatRates = [...new Set(rates.map((r) => Math.round(r * 100) / 100))].sort((a, b) => a - b);
    }
    changes.push(`VAT: ${(next.vatRates ?? VAT_RATES).map((r) => `${r}%`).join(', ')}`);
  }

  if (body.posFee !== undefined) {
    next.posFee = money(body.posFee, 'posFee', 'Phí hồ sơ POS');
    changes.push(`Phí hồ sơ POS: ${next.posFee === null ? 'mặc định' : next.posFee === 0 ? 'miễn phí' : `${next.posFee.toLocaleString('de-DE')} đ`}`);
  }

  if (body.machines !== undefined) {
    if (typeof body.machines !== 'object' || body.machines === null) throw Object.assign(new Error('Giá mẫu máy không hợp lệ'), { field: 'machines' });
    for (const [id, v] of Object.entries(body.machines)) {
      const m = misaContent.machines.find((x) => x.id === id);
      if (!m) throw Object.assign(new Error('Mẫu máy không tồn tại'), { field: `machines.${id}` });
      const n = money(v, `machines.${id}`, m.name);
      if (n === null) delete next.machines[id];
      else next.machines[id] = n;
      changes.push(`${m.name}: ${n === null ? 'mặc định' : `${n.toLocaleString('de-DE')} đ${m.period}`}`);
    }
  }

  if (body.invoicePlans !== undefined) {
    if (body.invoicePlans === null) next.invoicePlans = null;
    else {
      const plans = Array.isArray(body.invoicePlans) ? body.invoicePlans : [];
      if (!plans.length || plans.length > 10) throw Object.assign(new Error('Gói hóa đơn: từ 1 đến 10 gói'), { field: 'invoicePlans' });
      next.invoicePlans = plans.map((p, i) => {
        const id = typeof p?.id === 'string' ? p.id.trim().slice(0, 20) : '';
        if (!id) throw Object.assign(new Error(`Gói hóa đơn #${i + 1}: nhập tên gói`), { field: `invoicePlans.${i}.id` });
        const invoices = Number(p.invoices);
        if (!Number.isInteger(invoices) || invoices < 1 || invoices > 10_000_000) {
          throw Object.assign(new Error(`Gói ${id}: số hóa đơn là số nguyên dương`), { field: `invoicePlans.${i}.invoices` });
        }
        return { id, invoices, price: money(p.price, `invoicePlans.${i}.price`, `Gói ${id}`) ?? 0 };
      });
      if (new Set(next.invoicePlans.map((p) => p.id)).size !== next.invoicePlans.length) {
        throw Object.assign(new Error('Tên gói hóa đơn bị trùng'), { field: 'invoicePlans' });
      }
    }
    changes.push(`Gói hóa đơn: ${(next.invoicePlans ?? misaContent.invoicePlans.plans).map((p) => `${p.id} ${p.price.toLocaleString('de-DE')} đ`).join(', ')}`);
  }

  if (!changes.length) throw Object.assign(new Error('Không có thay đổi'), { field: null });
  next.updatedAt = new Date().toISOString();
  adminStore.db.feeSettings = next;
  return changes;
}
