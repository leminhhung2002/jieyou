import { escapeHtml } from './emailTemplates.js';

const PURPOSE_TEXT = {
  register: 'xác thực đăng ký tài khoản',
  login: 'đăng nhập',
  reset: 'đặt lại mật khẩu',
};

/**
 * Email mã OTP – cố ý tối giản để không bị lọc vào thư rác:
 * không ảnh, không liên kết, có cả bản văn bản thuần, nội dung ngắn và nhất quán.
 */
export function renderOtpEmail({ code, purpose, minutes }) {
  const action = PURPOSE_TEXT[purpose] || 'xác thực';
  const subject = `${code} là mã xác thực JIEYOU của bạn`;
  const text = [
    'Xin chào,',
    '',
    `Mã xác thực để ${action} tại JIEYOU là: ${code}`,
    '',
    `Mã có hiệu lực trong ${minutes} phút và chỉ dùng được một lần.`,
    'Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên JIEYOU.',
    'Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.',
    '',
    'JIEYOU – CÔNG TY TNHH TMDV JIEYOU VIỆT NAM',
  ].join('\n');

  const font = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const p = `margin:0 0 16px;${font}font-size:15px;line-height:22px;color:#1f2937;`;
  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:32px;">
<p style="margin:0 0 24px;${font}font-size:20px;line-height:28px;font-weight:700;color:#0c626c;">JIEYOU</p>
<p style="${p}">Xin chào,</p>
<p style="${p}">Mã xác thực để ${escapeHtml(action)} tại JIEYOU là:</p>
<p style="margin:0 0 16px;${font}font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;color:#0e121b;">${escapeHtml(code)}</p>
<p style="${p}">Mã có hiệu lực trong ${minutes} phút và chỉ dùng được một lần. Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên JIEYOU.</p>
<p style="margin:0;${font}font-size:13px;line-height:20px;color:#6b7280;">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.<br>CÔNG TY TNHH TMDV JIEYOU VIỆT NAM</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

/** agency.jieyou@gmail.com -> ag**********@gmail.com */
export function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return '';
  const keep = Math.min(2, Math.max(1, user.length - 1));
  return `${user.slice(0, keep)}${'*'.repeat(Math.max(1, user.length - keep))}@${domain}`;
}
