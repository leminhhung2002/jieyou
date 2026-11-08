import path from 'node:path';
import { createApp } from './app.js';
import { config } from './config.js';
import { adminStore } from './services/adminStore.js';
import { accountStore } from './services/accountStore.js';
import { openDatabase, save, saveSafely, backup, closeDatabase } from './services/persistence.js';

// Dữ liệu lưu ở SQLite (DB_FILE). Lần chạy đầu CSDL trống: nạp dữ liệu mẫu rồi lưu lại.
const loaded = openDatabase(config.dbFile);
if (loaded) {
  console.log(`[DB] Đã nạp dữ liệu từ ${config.dbFile}`);
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
