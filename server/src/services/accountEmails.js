import { config } from '../config.js';
import { renderEmail } from './emailTemplates.js';
import { mailer } from './mailer.js';
import { userStore } from './userStore.js';
import { DEFAULT_SETTINGS } from '../data/accountCatalog.js';

/**
 * Email thông báo cho khách – theo công tắc "Thông báo qua email" ở màn Cài đặt
 * (topup: Nạp tiền, applications: Trạng thái hồ sơ, invoices: Hóa đơn).
 */
const vnd = (n) => `${Math.round(n).toLocaleString('de-DE')} đ`;
const dateTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const date = (iso) => new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const link = (path) => `${config.publicUrl}${path}`;

const SERVICE_PAGE = {
  ads: '/tai-khoan/quang-cao',
  unipay: '/tai-khoan/unipay',
  bct: '/tai-khoan/bo-cong-thuong',
  misa: '/tai-khoan/may-ban-hang',
  pos: '/tai-khoan/pos',
  social: '/tai-khoan/tuong-tac-mxh',
  webapp: '/tai-khoan/lam-app-web',
  license: '/tai-khoan/key-ban-quyen',
};

function recipient(userId, pref) {
  const user = userStore.findById(userId);
  if (!user?.email) return null;
  const prefs = { ...DEFAULT_SETTINGS.email, ...(user.settings?.email || {}) };
  return prefs[pref] ? user : null;
}

function send(user, tag, content) {
  const { subject, html, text } = renderEmail(content);
  return mailer.send({ to: user.email, subject, html, text, tag });
}

/** Hồ sơ được duyệt / bị từ chối. `serviceName`: tên dịch vụ hiển thị. */
export function emailApplicationResult(app, serviceName) {
  const user = recipient(app.customerId, 'applications');
  if (!user) return null;
  const name = `${app.code} - ${serviceName}`;
  const details = Object.entries(app.details || {}).map(([k, v]) => [k, String(v)]);
  if (app.status === 'approved' && app.type === 'license') {
    const keys = app.meta?.keys || [];
    return send(user, 'license.delivered', {
      subject: `Key bản quyền đơn ${app.code}`,
      preheader: `${keys.length} key ${app.meta?.productName || ''} đã được giao.`,
      greetingName: user.businessName,
      heading: ['Đơn ', { bold: name }, ' đã giao key thành công!'],
      table: {
        title: 'Key của bạn',
        rows: [...details, ...keys.map((k, i) => [`Key ${i + 1}`, k])],
      },
      paragraphs: ['Vui lòng lưu lại key và không chia sẻ cho người khác. Quý khách luôn xem lại được key trong mục Key bản quyền trên sàn.'],
      cta: { label: 'Xem key trên sàn', url: link(SERVICE_PAGE.license) },
    });
  }
  if (app.status === 'approved') {
    if (app.reviewNote) details.push([app.type === 'webapp' ? 'Phản hồi / báo giá' : 'Ghi chú', app.reviewNote]);
    return send(user, 'application.approved', {
      subject: `Hồ sơ ${app.code} đã được phê duyệt`,
      preheader: `${serviceName}: hồ sơ của bạn đã được phê duyệt.`,
      greetingName: user.businessName,
      heading: ['Hồ sơ ', { bold: name }, ' đã được phê duyệt!'],
      table: { title: 'Thông tin hồ sơ', rows: [...details, ['Ngày duyệt', date(app.reviewedAt || new Date().toISOString())]] },
      cta: { label: 'Xem hồ sơ trên sàn', url: link(`/app/ho-so/${encodeURIComponent(app.code)}`) },
    });
  }
  if (app.status === 'rejected') {
    const rows = [['Lý do từ chối', app.rejectReason || '—']];
    if (app.held > 0) rows.push(['Số tiền hoàn', `${vnd(app.held)} (đã vào tài khoản trả trước)`]);
    return send(user, 'application.rejected', {
      subject: `Hồ sơ ${app.code} chưa được phê duyệt`,
      preheader: app.rejectReason || 'Hồ sơ cần bổ sung thông tin.',
      greetingName: user.businessName,
      heading: ['Hồ sơ ', { bold: name }, ' chưa được phê duyệt.'],
      table: { title: 'Chi tiết', rows },
      paragraphs: ['Quý khách vui lòng bổ sung theo lý do trên và gửi lại hồ sơ.'],
      cta: { label: 'Sửa và gửi lại', url: link(SERVICE_PAGE[app.type] || '/tai-khoan') },
    });
  }
  return null;
}

export function emailTopupSuccess(userId, tx, balance) {
  const user = recipient(userId, 'topup');
  if (!user) return null;
  return send(user, 'topup.success', {
    subject: `Nạp tiền thành công ${vnd(tx.amount)}`,
    preheader: `${vnd(tx.amount)} đã vào tài khoản trả trước.`,
    greetingName: user.businessName,
    heading: ['Nạp tiền ', { bold: vnd(tx.amount) }, ' vào tài khoản trả trước thành công!'],
    table: {
      title: 'Thông tin giao dịch',
      rows: [
        ['Mã giao dịch', tx.id],
        ['Số tiền', vnd(tx.amount)],
        ['Số dư mới', vnd(balance)],
        ['Thời gian', dateTime(tx.createdAt)],
        ['Phương thức', 'Cổng thanh toán Bảo Việt'],
      ],
    },
    cta: { label: 'Xem lịch sử giao dịch', url: link('/tai-khoan/tra-truoc') },
  });
}

export function emailInvoiceIssued(userId, invoice, appTitle) {
  const user = recipient(userId, 'invoices');
  if (!user) return null;
  return send(user, 'invoice.issued', {
    subject: `Hóa đơn điện tử ${invoice.no} đã phát hành`,
    preheader: `Hóa đơn cho ${appTitle}.`,
    greetingName: user.businessName,
    heading: ['Hóa đơn điện tử ', { bold: invoice.no }, ' đã được phát hành.'],
    table: {
      title: 'Thông tin hóa đơn',
      rows: [
        ['Số hóa đơn', invoice.no],
        ['Hồ sơ', appTitle],
        ['Ngày phát hành', date(invoice.issuedAt)],
        ['Tổng tiền', vnd(invoice.total)],
        ['Người mua', `${user.businessName} · MST ${user.taxCode || '—'}`],
      ],
    },
    cta: { label: 'Xem hóa đơn', url: link('/tai-khoan/hoa-don') },
  });
}

/** Mẫu đúng nội dung Figma (61:3235) – dùng cho trang xem trước ở dev. */
export function sampleFigmaEmail() {
  const v = '[Khách hàng] ([Mã khách hàng])';
  return renderEmail({
    subject: 'Hồ sơ #A12 - Tạp hóa Minh đã được phê duyệt',
    greetingName: 'công ty ABC',
    heading: ['Hồ sơ ', { bold: '#A12 - Tạp hóa Minh' }, ' đã được phê duyệt!'],
    table: {
      title: 'Thông số cấu hình máy POS',
      rows: [['Điểm bán', v], ['Merchant ID (MID)', v], ['Terminal ID (TID)', v], ['Serial máy', v], ['Mã kết nối / kích hoạt', v]],
    },
    cta: { label: 'Xem hồ sơ trên sàn', url: link('/tai-khoan') },
  });
}
