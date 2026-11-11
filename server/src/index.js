import path from 'node:path';
import { createApp } from './app.js';
import { config } from './config.js';
import { adminStore } from './services/adminStore.js';
import { accountStore } from './services/accountStore.js';
import { openDatabase, save, saveSafely, backup, closeDatabase } from './services/persistence.js';
import { startSmmSync } from './services/smmSync.js';
import { startTopupSync } from './services/topupPayments.js';

// Dữ liệu lưu ở SQLite (DB_FILE). Lần chạy đầu CSDL trống: nạp dữ liệu mẫu rồi lưu lại.
const loaded = openDatabase(config.dbFile);
if (loaded) {
  console.log(`[DB] Đã nạp dữ liệu từ ${config.dbFile}`);
  // Khôi phục tên "Máy bán hàng + MISA" cho dữ liệu đã bị đổi thành "1INVOICE" (bản deploy 11/11/2026)
  for (const p of adminStore.listPriceItems()) {
    if (p.serviceName === 'Máy bán hàng + 1INVOICE') p.serviceName = 'Máy bán hàng + MISA';
  }
  for (const a of adminStore.listApplications()) {
    if (a.details && 'Hóa đơn 1INVOICE' in a.details) {
      a.details = Object.fromEntries(Object.entries(a.details).map(([k, v]) => [k === 'Hóa đơn 1INVOICE' ? 'Hóa đơn MISA' : k, v]));
    }
  }
  for (const l of adminStore.listLogs()) {
    if (l.action === 'Cập nhật phí 1INVOICE & POS') l.action = 'Cập nhật phí MISA & POS';
  }
} else {
  // Dữ liệu mẫu (khách hàng, hồ sơ, giao dịch, bảng giá, vai trò quản trị)
  await adminStore.seed();
  // Dữ liệu mẫu Web người dùng cho khách An Phát (đăng nhập OTP bằng 0912345678)
  accountStore.seed();
  save();
  console.log(`[DB] CSDL mới – đã tạo dữ liệu mẫu tại ${config.dbFile}`);
}

// Lưới an toàn: lưu định kỳ những thay đổi không đi qua request ghi
setInterval(saveSafely, 30_000).unref();

// Sao lưu mỗi ngày (giữ 14 bản) vào thư mục backups cạnh file CSDL
const backupDir = path.join(path.dirname(path.resolve(config.dbFile)), 'backups');
const runBackup = () => {
  try {
    console.log(`[DB] Đã sao lưu: ${backup(backupDir)}`);
  } catch (err) {
    console.error('[DB] Sao lưu thất bại:', err);
  }
};
runBackup();
setInterval(runBackup, 24 * 60 * 60 * 1000).unref();

// Đơn MXH gửi sang hotrodvfb: đồng bộ trạng thái định kỳ, tự hoàn thành / hoàn tiền
if (startSmmSync(config.smm.syncSeconds)) console.log(`[SMM] Đã kết nối hotrodvfb, đồng bộ đơn mỗi ${config.smm.syncSeconds} giây`);

// Nạp tiền UniPay: đối soát định kỳ các giao dịch QR đang chờ (dự phòng khi IPN không tới)
if (startTopupSync(config.unipay.syncSeconds)) console.log(`[UniPay] Đã cấu hình (${config.unipay.baseUrl}), đối soát mỗi ${config.unipay.syncSeconds} giây`);

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.log(`JIEYOU API đang chạy tại http://localhost:${config.port} (${config.env})`);
});

// systemctl restart/stop gửi SIGTERM: lưu lần cuối rồi mới thoát
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close();
    closeDatabase();
    process.exit(0);
  });
}
