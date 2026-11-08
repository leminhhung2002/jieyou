# JIEYOU – Sàn Dịch vụ Doanh nghiệp

Website dựng theo thiết kế Figma **JIEYOU-Website** (trang *Landing Page*).

- **Frontend:** React 18 + Vite + React Router, CSS Modules (`client/`)
- **Backend:** Node.js + Express (`server/`)

## Chạy dự án

Yêu cầu Node.js ≥ 18.

```bash
npm install          # cài cho cả client và server (npm workspaces)
cp server/.env.example server/.env   # lần đầu
npm run dev          # chạy API (http://localhost:4000) + web (http://localhost:5173)
```

Mở http://localhost:5173.

### Build production

```bash
npm run build        # build React vào client/dist
NODE_ENV=production JWT_SECRET=<chuỗi-bí-mật> npm start
```

Server Express phục vụ luôn bản build tại cổng `PORT` (mặc định 4000).

### Test backend

```bash
npm test -w server
```

## Các trang

| Đường dẫn | Figma |
|---|---|
| `/` | Landing page (112:10422) |
| `/dich-vu/quang-cao-tren-san` | Dịch vụ / Quảng cáo trên sàn |
| `/dich-vu/tai-khoan-unipay` | Dịch vụ / Tài khoản UniPay |
| `/dich-vu/ho-so-bo-cong-thuong` | Dịch vụ / Hồ sơ Bộ Công Thương |
| `/dich-vu/cong-thanh-toan-pos` | Dịch vụ / Hồ sơ cổng thanh toán POS |
| `/dich-vu/tang-tuong-tac-mxh` | Dịch vụ / Tăng tương tác MXH |
| `/dich-vu/may-ban-hang-misa` | Dịch vụ / Máy bán hàng hóa đơn |
| `/dang-ky` | Đăng ký + bước xác thực OTP |
| `/dang-nhap` | Đăng nhập (tab Mật khẩu / Mã OTP, Quên mật khẩu) |
| `/tai-khoan` | Web người dùng: Tổng quan (cần đăng nhập) |
| `/tai-khoan/tra-truoc`, `/nap-tien` | Tài khoản trả trước (lịch sử giao dịch), Nạp tiền |
| `/tai-khoan/quang-cao`, `/unipay`, `/bo-cong-thuong`, `/may-ban-hang`, `/pos`, `/tuong-tac-mxh` | Đặt dịch vụ / gửi hồ sơ |
| `/tai-khoan/hoa-don`, `/thong-bao`, `/cai-dat` | Hóa đơn, Thông báo, Cài đặt tài khoản |
| `/app` … | **App mobile (web, 390px)** – Figma trang *App Mobile*: Trang chủ, `/app/dang-nhap`, `/app/dang-ky`, `/app/nap-tien` (+ `/thanh-cong`), `/app/ho-so` (+ `/:code`), `/app/thong-bao`; `/app/lich-su`, `/app/cai-dat` (tab chưa có trong Figma) |
| `/admin/dang-nhap` | Đăng nhập quản trị (không có trong Figma) |
| `/admin` … `/admin/nhat-ky` | Admin: Tổng quan, Duyệt hồ sơ, Khách hàng, Giao dịch, Nội dung · Bảng giá, Phân quyền, Nhật ký |
| mọi đường dẫn khác | 404 |

## API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/health` | Kiểm tra server |
| GET | `/api/services` | Danh sách dịch vụ |
| GET | `/api/services/:slug` | Chi tiết dịch vụ + nội dung trang (`content`) + bảng giá |
| GET | `/api/pricing` | Bảng giá "Từ …" ở landing |
| GET | `/api/faqs` | Câu hỏi thường gặp |
| GET | `/api/news?limit=3` | Tin tức mới nhất |
| POST | `/api/auth/register` | B1 đăng ký: `{ businessName, taxCode, phone, email, password, agreeTerms }` → gửi OTP |
| POST | `/api/auth/register/verify` | B2 đăng ký: `{ phone, code }` → `{ token, user }` |
| POST | `/api/auth/otp/request` | Gửi OTP: `{ phone, purpose: login \| reset \| register }` |
| POST | `/api/auth/otp/verify` | Xác thực OTP đăng nhập (→ token) hoặc quên mật khẩu (→ verificationToken) |
| POST | `/api/auth/login` | `{ identifier (SĐT hoặc email), password }` |
| POST | `/api/auth/password/reset` | `{ verificationToken, password }` |
| GET | `/api/auth/me` | Thông tin tài khoản (Bearer token) |
| GET | `/api/account/summary` | Web người dùng: hồ sơ, số dư, tạm giữ, đã chi, hồ sơ gần đây, số thông báo chưa đọc |
| GET | `/api/account/catalog` | Giá & danh mục cho các form (lấy giá "Đã xuất bản" từ Bảng giá admin, chưa có thì dùng giá mặc định) |
| GET | `/api/account/transactions?kind=&month=` | Lịch sử giao dịch (Nạp / Tạm giữ / Đã trừ / Hoàn) kèm số dư sau giao dịch |
| POST | `/api/account/topups` | Nạp tiền `{ amount }` (50.000 – 50.000.000 đ) |
| GET/POST | `/api/account/applications` | Hồ sơ của khách / gửi hồ sơ `{ type: ads\|unipay\|bct\|misa\|pos\|social, details }` |
| GET | `/api/account/applications/:code` | Chi tiết hồ sơ: mốc thời gian, lý do từ chối, tiền đã trừ / hoàn |
| GET/PUT | `/api/account/drafts/:type` | Bản nháp (unipay, bct, pos) |
| GET | `/api/account/ads/bookings?slot=` | Các khoảng ngày đã có người đặt của một vị trí banner |
| GET | `/api/account/invoices[/:no/document]` | Hóa đơn / bản in hóa đơn (HTML, in → PDF) |
| GET/POST | `/api/account/notifications[/read-all\|/:id/read]` | Thông báo |
| GET/PATCH | `/api/account/settings`, PATCH `/profile`, POST `/password` | Cài đặt, thông tin doanh nghiệp, đổi/đặt mật khẩu |
| POST | `/api/admin/auth/login` | Đăng nhập quản trị `{ username, password }` |
| GET | `/api/admin/overview` | Số liệu Tổng quan + hàng đợi duyệt |
| GET/POST | `/api/admin/applications[/:code[/approve\|/reject]]` | Hồ sơ |
| GET/PATCH | `/api/admin/customers[/:id/status]` | Khách hàng, khóa/mở khóa |
| GET | `/api/admin/transactions` | Giao dịch + số liệu đối soát |
| GET/POST/PATCH/DELETE | `/api/admin/price-items[/:id]` | Bảng giá |
| GET/POST/PATCH | `/api/admin/roles[/:id]` | Phân quyền |
| GET | `/api/admin/logs` | Nhật ký hoạt động |

**Bảo mật:** mật khẩu băm `scrypt`, OTP 6 số băm SHA-256, hết hạn 5 phút, tối đa 5 lần nhập sai, chờ 60 giây mới được gửi lại; rate-limit các endpoint xác thực; JWT cho phiên đăng nhập; `helmet` + CORS theo `CLIENT_ORIGIN`.

**Gửi OTP qua email:** mã OTP (đăng ký, đăng nhập, quên mật khẩu) được gửi về email của tài khoản qua Gmail SMTP (`SMTP_USER` / `SMTP_PASS` = Mật khẩu ứng dụng, xem `server/.env.example`); số điện thoại vẫn là định danh đăng nhập. Thư OTP không có ảnh/liên kết để hạn chế bị lọc thư rác; tài khoản mẫu dùng email `@example.com` nên không gửi thật.

**Môi trường dev:** chưa đặt `SMTP_PASS` thì email chỉ ghi log và lưu ở `GET /api/dev/emails`; mã OTP còn được trả về trong response (`devCode`), giao diện hiển thị dòng `[DEV] Mã OTP: …` để test nhanh.

**Lưu trữ:** dữ liệu (khách hàng, hồ sơ, giao dịch, hóa đơn, thông báo, bảng giá, quản trị viên, nhật ký) lưu trong SQLite có sẵn của Node (`node:sqlite`, Node ≥ 22.13), file `server/storage/jieyou.db` (đổi bằng `DB_FILE`). Server làm việc trên bộ nhớ và ghi xuống SQLite trước khi trả kết quả mỗi request ghi dữ liệu (`server/src/services/persistence.js`); lần chạy đầu CSDL trống thì tạo dữ liệu mẫu. Sao lưu tự động khi khởi động và mỗi ngày vào `server/storage/backups/` (giữ 14 bản). Mã OTP và đăng ký chưa xác thực chỉ ở bộ nhớ (sống vài phút). Nội dung dịch vụ/bảng giá mặc định nằm trong `server/src/data/`.

## Web người dùng

Tài khoản mẫu: **Công ty TNHH An Phát** – đăng nhập tab *Mã OTP* với SĐT `0912 345 678` (dev hiện mã OTP trên màn hình).

- **Tiền:** gửi hồ sơ có phí thì tiền bị trừ khỏi số dư khả dụng ngay. Quảng cáo hiển thị là *Tạm giữ* cho tới khi được duyệt; các dịch vụ khác là *Đã trừ*. Admin từ chối → hoàn tiền vào số dư (giao dịch *Hoàn*), duyệt → phát hành hóa đơn.
- **Quảng cáo:** mỗi vị trí chỉ 1 banner mỗi ngày – server chặn đặt trùng ngày (409), tối đa 60 ngày/lần.
- **Thông báo:** tạo khi nạp tiền, gửi hồ sơ, admin duyệt/từ chối.
- **Cài đặt:** chỉ cho tắt *Đăng nhập bằng mã OTP* khi tài khoản đã có mật khẩu; khi tắt, đăng nhập OTP bị từ chối (403). Số điện thoại không đổi được trên web (là định danh đăng nhập).
- **Chưa làm (cần hệ thống thật):** cổng thanh toán Bảo Việt – ở dev số tiền được cộng ngay, ở production API trả 501 cho tới khi nối cổng + webhook; tệp tải lên (ảnh banner, giấy tờ) hiện chỉ lưu tên + dung lượng, chưa lưu file; email thông báo chưa gửi thật.
- Hồ sơ khách gửi xuất hiện ngay ở màn admin *Duyệt hồ sơ* (UniPay và Tăng tương tác MXH nằm trong chip "Tất cả" vì thiết kế admin chỉ có 4 chip loại).

## Email

Mẫu email theo Figma *Email Template* (61:3235): `server/src/services/emailTemplates.js` (HTML dạng bảng, style inline, ảnh PNG @2x trong `client/public/assets/email`, link/ảnh dùng `PUBLIC_URL`).

- Gửi khi: nạp tiền thành công, hồ sơ được duyệt / bị từ chối, hóa đơn phát hành – theo các công tắc *Thông báo qua email* ở màn Cài đặt (mặc định: nạp tiền + trạng thái hồ sơ bật, hóa đơn tắt).
- **Dev:** xem hộp thư tại http://localhost:4000/api/dev/mailbox (mẫu đúng nội dung Figma ở `/api/dev/emails/preview`). Không có ở production.

## Admin

Tài khoản mẫu (mật khẩu `ADMIN_DEFAULT_PASSWORD`, mặc định dev `admin12345`):

| Tài khoản | Vai trò | Quyền |
|---|---|---|
| `admin` | Super Admin | tất cả |
| `duyetvien01` | Duyệt viên | Duyệt hồ sơ, Khách hàng |
| `ketoan02` | Kế toán | Giao dịch và hoàn tiền |
| `bientap01` | Biên tập nội dung | Nội dung |

- Mọi API `/api/admin/*` yêu cầu token quản trị và kiểm tra quyền theo vai trò (403 nếu không đủ quyền); menu chỉ hiện mục được phép.
- **Duyệt hồ sơ:** duyệt → tiền tạm giữ chuyển thành phí (giao dịch "Trừ phí"); từ chối → bắt buộc lý do ≥ 5 ký tự, hoàn tiền tạm giữ vào số dư khách (giao dịch "Hoàn tiền").
- **Khách hàng:** khóa tài khoản → khách không đăng nhập được và phiên hiện tại bị vô hiệu.
- **Bảng giá:** chỉ mục "Đã xuất bản" hiển thị cho khách; giá "Từ …" ở trang chủ = giá thấp nhất đã xuất bản của dịch vụ.
- **Nhật ký:** mọi thao tác quản trị (đăng nhập, duyệt, từ chối, khóa, sửa giá, phân quyền) đều được ghi lại.
- Dữ liệu mẫu nạp khi khởi động server (`server/src/services/adminStore.js`).

## Cấu trúc

```
client/
  public/assets/        # ảnh, icon, SVG tải từ Figma
  src/
    api/client.js       # gọi API + lưu token
    context/AuthContext # phiên đăng nhập
    components/         # Navbar, Footer, Faq, News, SignupBanner, auth/*, service/*
    sections/           # các section của trang chủ
    pages/              # HomePage, ServicePage (+ services/*), Login, Register, 404
    mobile/             # App mobile /app (web, khung 430px): layout + tab bar, ui, pages/*
    account/            # Web người dùng /tai-khoan: layout, ui dùng chung, accountApi, pages/*
    admin/              # khu vực quản trị: layout, ui dùng chung, pages/*
server/
  src/
    routes/             # content.js, auth.js, admin.js, account.js
    services/           # otp, password, userStore, pendingRegistrations, adminStore, accountStore, persistence (SQLite), mailer
    data/               # dịch vụ, bảng giá, FAQ, tin tức, nội dung từng trang dịch vụ
  test/                 # api, admin, account
scripts/fetch-assets.mjs  # tải asset từ Figma theo manifest
```
