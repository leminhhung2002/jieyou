/**
 * Nhật ký sự kiện bảo mật (OWASP A09) – ghi ra stdout dạng JSON một dòng để journald/systemd lưu lại.
 * Không bao giờ ghi mật khẩu, mã OTP hay token.
 */
export function securityLog(event, req, extra = {}) {
  if (process.env.NODE_ENV === 'test') return;
  const entry = {
    at: new Date().toISOString(),
    type: 'security',
    event,
    ip: req?.ip,
    ua: req?.get?.('user-agent')?.slice(0, 200),
    ...extra,
  };
  console.warn(JSON.stringify(entry));
}
