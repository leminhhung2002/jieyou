import { config } from '../config.js';

/**
 * Mẫu email JIEYOU – Figma "Email Template" › "Mail Template" (61:3235).
 * HTML dạng bảng + style inline để hiển thị đúng trên Gmail/Outlook (không dùng flex/SVG/CSS ngoài).
 * Ảnh PNG @2x nằm ở client/public/assets/email, tham chiếu bằng URL tuyệt đối PUBLIC_URL.
 */

const FONT = "'Inter Display','Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const C = {
  page: '#f5f5f5',
  tint: '#cdf7f8',
  text: '#060606',
  strong: '#0e121b',
  brand: '#0c626c',
  tableHead: '#fbfcfd',
  line: 'rgba(66,66,66,0.08)',
};

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const img = (name) => `${config.publicUrl}/assets/email/${name}`;

const SOCIAL = [
  { name: 'Facebook', file: 'facebook@2x.png', url: process.env.SOCIAL_FACEBOOK_URL || 'https://facebook.com' },
  { name: 'X', file: 'x@2x.png', url: process.env.SOCIAL_X_URL || 'https://x.com' },
  { name: 'LinkedIn', file: 'linkedin@2x.png', url: process.env.SOCIAL_LINKEDIN_URL || 'https://linkedin.com' },
  { name: 'YouTube', file: 'youtube@2x.png', url: process.env.SOCIAL_YOUTUBE_URL || 'https://youtube.com' },
];

/** Bảng thông tin – Figma "Table Container" (61:3246): tiêu đề 40px nền #fbfcfd, cột trái 234px đậm, cột phải 300px. */
function tableHtml({ title, rows }) {
  const border = `border-bottom:0.5px solid ${C.line};`;
  const cell = `padding:10px 20px;font-family:${FONT};font-size:14px;line-height:20px;letter-spacing:-0.12px;color:${C.text};`;
  const body = rows
    .map(([label, value], i) => {
      const last = i === rows.length - 1;
      return `<tr>
<th align="left" valign="middle" width="234" style="${cell}width:234px;box-sizing:border-box;font-weight:600;${border}background:#ffffff;">${escapeHtml(label)}</th>
<td align="left" valign="middle" width="300" style="${cell}font-weight:500;${last ? '' : border}background:#ffffff;word-break:break-word;">${escapeHtml(value)}</td>
</tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${C.tableHead};">
<tr><th colspan="2" align="left" style="${cell}font-weight:600;${border}background:${C.tableHead};">${escapeHtml(title)}</th></tr>
${body}
</table>`;
}

/** Nút gradient teal bo tròn cao 44px (111:30672) – có màu nền dự phòng cho Outlook. */
function buttonHtml({ label, url }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
<tr><td align="center" bgcolor="#0f8894" style="border-radius:999px;background:#0f8894;background-image:linear-gradient(180deg,#12909c 3.571%,#04707d 139.29%);">
<a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 20px;font-family:'Google Sans Flex','Google Sans',${FONT};font-size:16px;line-height:16px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
</td></tr>
</table>`;
}

/**
 * Dựng email hoàn chỉnh.
 * @param {object} o
 * @param {string} o.preheader   dòng tóm tắt hiện trong hộp thư (ẩn trong nội dung)
 * @param {string} o.greetingName  "Kính gửi quý khách {greetingName},"
 * @param {Array<string|{bold:string}>} o.heading  câu chính, phần {bold} in đậm
 * @param {{title:string, rows:Array<[string,string]>}} [o.table]
 * @param {Array<string>} [o.paragraphs]  đoạn văn bổ sung (văn bản thường)
 * @param {{label:string, url:string}} [o.cta]
 */
export function renderEmail({ subject, preheader = '', greetingName, heading, table, paragraphs = [], cta }) {
  const text = `font-family:${FONT};font-size:16px;line-height:24px;letter-spacing:-0.24px;color:${C.text};`;
  const headingHtml = heading
    .map((part) => (typeof part === 'string' ? escapeHtml(part) : `<strong style="font-weight:600;">${escapeHtml(part.bold)}</strong>`))
    .join('');
  const block = (inner, gap = 40) => `<tr><td style="padding-top:${gap}px;">${inner}</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(subject)}</title>
<style>@media (max-width:640px){.jy-outer{padding:24px 12px!important}.jy-card{padding:24px!important}td[width="300"]{width:auto!important}}</style>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" class="jy-outer" style="padding:32px 16px;">
<table role="presentation" width="614" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:614px;">
  <tr><td align="center" style="padding:0 40px 32px;">
    <a href="${escapeHtml(config.publicUrl)}" target="_blank" style="text-decoration:none;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="middle"><img src="${img('logo@2x.png')}" width="45" height="40" alt="" style="display:block;border:0;"></td>
      <td valign="middle" style="padding-left:13px;font-family:${FONT};font-size:22.667px;line-height:22.667px;font-weight:600;letter-spacing:3.6267px;text-transform:uppercase;color:#0b0c0e;">JIEYOU</td>
    </tr></table></a>
  </td></tr>
  <tr><td style="background:${C.tint};border-radius:20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="jy-card" style="background:#ffffff;border-radius:20px;padding:40px;box-shadow:0 4px 12px -2px rgba(16,24,40,0.02),0 2px 4px -2px rgba(16,24,40,0.03);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="${text}">Kính gửi quý khách ${escapeHtml(greetingName)},</td></tr>
          ${block(`<p style="margin:0;${text}">${headingHtml}</p>${table ? `<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>${tableHtml(table)}` : ''}${paragraphs
            .map((p) => `<p style="margin:16px 0 0;${text}">${escapeHtml(p)}</p>`)
            .join('')}`)}
          ${cta ? block(buttonHtml(cta)) : ''}
          ${block(`<p style="margin:0;${text}color:${C.strong};">Trân trọng,</p><p style="margin:8px 0 0;font-family:${FONT};font-size:18px;line-height:26px;font-weight:600;color:${C.strong};">Công ty cổ phần JIEYOU</p>`)}
        </table>
      </td></tr>
      <tr><td style="padding:16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="font-family:${FONT};font-size:14px;line-height:20px;font-weight:500;letter-spacing:-0.07px;color:${C.brand};">Copyright © JIEYOU</td>
          <td valign="middle" align="right">${SOCIAL.map(
            (s, i) =>
              `<a href="${escapeHtml(s.url)}" target="_blank" style="display:inline-block;margin-left:${i ? 16 : 0}px;"><img src="${img(s.file)}" width="32" height="32" alt="${s.name}" style="display:block;border:0;"></a>`,
          ).join('')}</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const plain = [
    `Kính gửi quý khách ${greetingName},`,
    '',
    heading.map((p) => (typeof p === 'string' ? p : p.bold)).join(''),
    ...(table ? ['', table.title, ...table.rows.map(([k, v]) => `- ${k}: ${v}`)] : []),
    ...paragraphs.flatMap((p) => ['', p]),
    ...(cta ? ['', `${cta.label}: ${cta.url}`] : []),
    '',
    'Trân trọng,',
    'Công ty cổ phần JIEYOU',
  ].join('\n');

  return { subject, html, text: plain };
}
