import crypto from 'node:crypto';
import { adminStore } from './adminStore.js';

/**
 * Kho key phần mềm bản quyền: sản phẩm (admin thêm / sửa / ẩn) + key nhập sẵn cho từng sản phẩm.
 * Khách mua bằng số dư → lấy ngay N key "available" chuyển sang "sold" và giao trên web + email.
 * Dữ liệu nằm trong adminStore.db (licenseProducts, licenseKeys) để được lưu SQLite cùng các bộ khác.
 */
const db = adminStore.db;

export const LICENSE_MAX_PER_ORDER = 20;
const KEY_MAX = 500;

const now = () => new Date().toISOString();

export const licenseStore = {
  listProducts: () => db.licenseProducts,
  findProduct: (id) => db.licenseProducts.find((p) => p.id === id) || null,

  createProduct(fields) {
    const p = { id: crypto.randomUUID(), createdAt: now(), updatedAt: now(), ...fields };
    db.licenseProducts.push(p);
    return p;
  },
  updateProduct(id, patch) {
    const p = this.findProduct(id);
    if (p) Object.assign(p, patch, { updatedAt: now() });
    return p;
  },
  /** Chỉ xoá được sản phẩm chưa bán key nào (để giữ lịch sử đơn); xoá luôn các key chưa bán. */
  removeProduct(id) {
    const i = db.licenseProducts.findIndex((p) => p.id === id);
    if (i < 0) return false;
    db.licenseProducts.splice(i, 1);
    db.licenseKeys = db.licenseKeys.filter((k) => k.productId !== id);
    return true;
  },

  stock(productId) {
    let available = 0;
    let sold = 0;
    for (const k of db.licenseKeys) {
      if (k.productId !== productId) continue;
      if (k.status === 'available') available += 1;
      else sold += 1;
    }
    return { available, sold };
  },

  listKeys: (productId) => db.licenseKeys.filter((k) => k.productId === productId),

  /** Nhập key, mỗi dòng một key. Bỏ dòng trống và key đã có (trong cùng sản phẩm). */
  addKeys(productId, text) {
    const existing = new Set(this.listKeys(productId).map((k) => k.key));
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let added = 0;
    let duplicates = 0;
    let tooLong = 0;
    for (const key of lines) {
      if (key.length > KEY_MAX) {
        tooLong += 1;
        continue;
      }
      if (existing.has(key)) {
        duplicates += 1;
        continue;
      }
      existing.add(key);
      db.licenseKeys.push({ id: crypto.randomUUID(), productId, key, status: 'available', addedAt: now(), soldAt: null, applicationCode: null, customerId: null });
      added += 1;
    }
    return { added, duplicates, tooLong };
  },

  /** Xoá key chưa bán. Key đã bán thuộc về đơn của khách nên không xoá được. */
  removeKey(productId, keyId) {
    const i = db.licenseKeys.findIndex((k) => k.id === keyId && k.productId === productId);
    if (i < 0) return 'missing';
    if (db.licenseKeys[i].status !== 'available') return 'sold';
    db.licenseKeys.splice(i, 1);
    return 'ok';
  },

  /**
   * Lấy `quantity` key còn hàng (cũ nhất trước) gán cho đơn. Đồng bộ, không await → hai request
   * song song không thể nhận trùng key. Trả null nếu không đủ hàng (không đổi gì).
   */
  takeKeys(productId, quantity, applicationCode, customerId) {
    const free = db.licenseKeys.filter((k) => k.productId === productId && k.status === 'available').slice(0, quantity);
    if (free.length < quantity) return null;
    const soldAt = now();
    for (const k of free) Object.assign(k, { status: 'sold', soldAt, applicationCode, customerId });
    return free.map((k) => k.key);
  },

  /** Hoàn tác takeKeys (vd. lỗi khi tạo đơn). */
  releaseKeys(applicationCode) {
    for (const k of db.licenseKeys) {
      if (k.applicationCode === applicationCode) Object.assign(k, { status: 'available', soldAt: null, applicationCode: null, customerId: null });
    }
  },
};
