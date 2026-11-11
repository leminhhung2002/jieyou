import { Router } from 'express';
import { services } from '../data/services.js';
import { pricing } from '../data/pricing.js';
import { faqs } from '../data/faqs.js';
import { news } from '../data/news.js';
import { serviceContent } from '../data/serviceContent/index.js';
import { adminStore } from '../services/adminStore.js';
import { licenseStore } from '../services/licenseStore.js';
import { misaDevicePrice, misaServiceContent } from '../services/feeSettings.js';
import { MISA_DEVICES } from '../data/accountCatalog.js';

/** Giá thấp nhất đã xuất bản của một dịch vụ trong Bảng giá Admin (null nếu chưa có). */
function publishedFromPrice(serviceSlug) {
  const prices = adminStore
    .listPriceItems()
    .filter((p) => p.serviceSlug === serviceSlug && p.status === 'published' && p.unitPrice > 0)
    .map((p) => p.unitPrice);
  return prices.length ? Math.min(...prices) : null;
}

/** Giá "Từ ..." của máy bán hàng / gói hóa đơn 1INVOICE lấy theo Admin › Phí 1INVOICE & POS. */
function feeFromPrice(id) {
  const min = (arr) => (arr.length ? Math.min(...arr) : null);
  if (id === 'pos-machine') return min(MISA_DEVICES.map(misaDevicePrice).filter((n) => n > 0));
  if (id === 'misa') return min(misaServiceContent().invoicePlans.plans.map((p) => p.price).filter((n) => n > 0));
  return null;
}

const withLivePrice = (p) => ({ ...p, fromPrice: feeFromPrice(p.id) ?? publishedFromPrice(p.serviceSlug) ?? p.fromPrice });
import { notFound } from '../utils/httpError.js';

const router = Router();
const byOrder = (a, b) => a.order - b.order;

router.get('/services', (_req, res) => {
  res.json({ data: [...services].sort(byOrder) });
});

router.get('/services/:slug', (req, res, next) => {
  const service = services.find((s) => s.slug === req.params.slug);
  if (!service) return next(notFound('Dịch vụ không tồn tại'));
  res.json({
    data: {
      ...service,
      pricing: pricing.filter((p) => p.serviceSlug === service.slug).map(withLivePrice),
      priceItems: adminStore
        .listPriceItems()
        .filter((p) => p.serviceSlug === service.slug && p.status === 'published'),
      content: service.slug === 'may-ban-hang-misa' ? misaServiceContent() : serviceContent[service.slug] || null,
      // Trang Key bản quyền: danh sách sản phẩm đang bán (giá + còn hàng hay không)
      ...(service.slug === 'key-ban-quyen'
        ? {
            licenseProducts: licenseStore
              .listProducts()
              .filter((p) => p.status === 'active')
              .map((p) => ({ id: p.id, name: p.name, category: p.category || '', price: p.price, inStock: licenseStore.stock(p.id).available > 0 })),
          }
        : {}),
    },
  });
});

router.get('/pricing', (_req, res) => {
  res.json({ data: pricing.map(withLivePrice) });
});

router.get('/faqs', (_req, res) => {
  res.json({ data: faqs });
});

router.get('/news', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 3, 1), 50);
  const sorted = [...news].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  res.json({ data: sorted.slice(0, limit), total: news.length });
});

export default router;
