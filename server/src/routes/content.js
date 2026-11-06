import { Router } from 'express';
import { services } from '../data/services.js';
import { pricing } from '../data/pricing.js';
import { faqs } from '../data/faqs.js';
import { news } from '../data/news.js';
import { serviceContent } from '../data/serviceContent/index.js';
import { adminStore } from '../services/adminStore.js';

/** Giá thấp nhất đã xuất bản của một dịch vụ trong Bảng giá Admin (null nếu chưa có). */
function publishedFromPrice(serviceSlug) {
  const prices = adminStore
    .listPriceItems()
    .filter((p) => p.serviceSlug === serviceSlug && p.status === 'published' && p.unitPrice > 0)
    .map((p) => p.unitPrice);
  return prices.length ? Math.min(...prices) : null;
}

const withLivePrice = (p) => ({ ...p, fromPrice: publishedFromPrice(p.serviceSlug) ?? p.fromPrice });
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
      content: serviceContent[service.slug] || null,
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
