import { createApp } from './app.js';
import { config } from './config.js';
import { adminStore } from './services/adminStore.js';
import { accountStore } from './services/accountStore.js';

// Nạp dữ liệu mẫu (khách hàng, hồ sơ, giao dịch, bảng giá, vai trò quản trị)
await adminStore.seed();
// Dữ liệu mẫu Web người dùng cho khách An Phát (đăng nhập OTP bằng 0912345678)
accountStore.seed();

const app = createApp();
app.listen(config.port, () => {
  console.log(`JIEYOU API đang chạy tại http://localhost:${config.port} (${config.env})`);
});
