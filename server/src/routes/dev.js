import { Router } from 'express';
import { mailer } from '../services/mailer.js';
import { escapeHtml } from '../services/emailTemplates.js';
import { sampleFigmaEmail } from '../services/accountEmails.js';
import { notFound } from '../utils/httpError.js';

/** Công cụ chỉ dùng ở môi trường dev: hộp thư xem các email hệ thống đã "gửi". Không mount ở production. */
const router = Router();

router.get('/mailbox', (_req, res) => {
  const rows = mailer
    .list()
    .map(
      (m) => `<tr><td>${escapeHtml(new Date(m.createdAt).toLocaleString('vi-VN'))}</td><td>${escapeHtml(m.to)}</td>
<td><a href="emails/${m.id}" target="mail">${escapeHtml(m.subject)}</a></td><td>${escapeHtml(m.tag || '')}</td></tr>`,
    )
    .join('');
  res.type('html').send(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Hộp thư dev – JIEYOU</title>
<style>body{font-family:system-ui,sans-serif;margin:0;display:flex;height:100vh}aside{width:46%;overflow:auto;padding:16px;border-right:1px solid #e3e5e9}
iframe{flex:1;border:0}table{border-collapse:collapse;width:100%;font-size:13px}td{padding:8px;border-top:1px solid #eee;vertical-align:top}a{color:#0f7a86}</style></head>
<body><aside><h2 style="margin:0 0 4px">Hộp thư dev</h2><p style="color:#6a6e77;margin:0 0 12px">Email chưa gửi thật – chỉ lưu trong bộ nhớ server.
<a href="emails/preview" target="mail">Xem mẫu Figma</a></p>
<table>${rows || '<tr><td>Chưa có email nào. Thử nạp tiền hoặc duyệt một hồ sơ.</td></tr>'}</table></aside>
<iframe name="mail" src="emails/preview" title="Nội dung email"></iframe></body></html>`);
});

router.get('/emails', (_req, res) => {
  res.json({ data: mailer.list().map(({ html, text, ...m }) => m) });
});

router.get('/emails/preview', (_req, res) => res.type('html').send(sampleFigmaEmail().html));

router.get('/emails/:id', (req, res) => {
  const m = mailer.find(req.params.id);
  if (!m) throw notFound('Không tìm thấy email');
  res.type('html').send(m.html);
});

export default router;
