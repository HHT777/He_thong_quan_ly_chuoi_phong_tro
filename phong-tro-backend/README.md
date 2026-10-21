# Phòng Trọ Backend API

API backend cho hệ thống quản lý chuỗi phòng trọ

## Yêu cầu

- Node.js >= 20.0.0
- MySQL >= 8.0.16
- npm >= 6.0.0

## Cài đặt

### 1. Clone hoặc tạo project

```bash
npm install
```

### 2. Cấu hình biến môi trường

Sao chép file `.env.example` thành `.env` và cập nhật thông tin kết nối database:

```bash
cp .env.example .env
```

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=phong_tro
DB_USER=root
DB_PASSWORD=
PORT=3001
NODE_ENV=development
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRE=7d
```

`JWT_SECRET` và `JWT_EXPIRE` là bắt buộc khi chạy server thật; tiến trình sẽ
dừng ngay lúc khởi động nếu thiếu. Không có secret mặc định cho development
hoặc production.

### 3. Database

Backend dùng schema 37 bảng trong `../data2.md` và từ điển dữ liệu
`../data1.md`. Cấu hình `DB_NAME=phong_tro` trỏ tới database đã import schema
này. Ngoài test, `DB_SYNC` và `DB_SYNC_ALTER` chỉ phát cảnh báo rồi bị bỏ qua;
server không tự sửa schema. `scripts/seed.js` cũng không dùng được trên DB thật.

## Chạy Server

### Development (với nodemon)

```bash
npm run dev
```

### Production

```bash
npm start
```

Server sẽ chạy trên http://localhost:3001

## Chạy kiểm thử

Unit test không cần database riêng:

```bash
npm run test:unit
```

Integration test tự tạo schema từ `../data2.md`, chạy server trên cổng test rồi xóa database test khi hoàn tất. Không dùng tên database thật. `TEST_DB_NAME` phải kết thúc bằng `_test` hoặc `_ci`, khác `DB_NAME`, và khớp chính xác `TEST_DB_ALLOWED_NAME`. Host phải là `127.0.0.1`, cổng test MySQL là `3307`.

Thiết lập các biến sau trong phiên terminal. Tên đăng nhập test phải khác nhau và dài tối đa 15 ký tự:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=phong_tro
TEST_DB_NAME=qlpt_integration_ci
TEST_DB_ALLOWED_NAME=qlpt_integration_ci
TEST_DB_HOST=127.0.0.1
TEST_DB_PORT=3307
TEST_DB_USER=root
TEST_DB_PASSWORD=
TEST_LANDLORD_USERNAME=owner_ci
TEST_LANDLORD_PASSWORD=replace_with_test_password
TEST_TENANT_USERNAME=tenant_ci
TEST_TENANT_PASSWORD=replace_with_test_password
TEST_OTHER_TENANT_USERNAME=tenant2_ci
TEST_OTHER_TENANT_PASSWORD=replace_with_test_password
TEST_NEW_ACCOUNT_PASSWORD=replace_with_test_password
```

Khi runner tạo server với `NODE_ENV=test` và database có hậu tố `_test` hoặc
`_ci`, runner tự sinh `JWT_SECRET` ngẫu nhiên cho đúng lần chạy và đặt
`JWT_EXPIRE=7d` nếu hai biến này chưa được cung cấp. Cơ chế này không hoạt động
với tên database khác hoặc ở development/production. Có thể truyền rõ hai biến
để kiểm tra một cấu hình JWT cụ thể.

`TEST_DB_ALLOWED_NAME`, `TEST_DB_HOST`, `TEST_DB_PORT` và `TEST_DB_USER` là bắt buộc cho script có thể tạo/xóa DB. Các script không lấy host/cổng/user từ `DB_*` trong `.env`. Tài khoản DB test cần quyền tạo và xóa đúng database test. Chỉ dùng `scripts/seed.js` khi đã xác nhận riêng DB test: `NODE_ENV=test`, các biến test trên và `node scripts/seed.js --confirm-db=<TEST_DB_NAME>`. Lệnh này **xóa và dựng lại** schema DB test; không chạy nếu chưa được duyệt đích chính xác.

Chạy integration hoặc toàn bộ test:

```bash
npm run test:integration
npm test
```

Runner mặc định xóa database test kể cả khi test lỗi. Chỉ dùng `TEST_KEEP_DATABASE=true` khi cần điều tra thủ công và tự xóa database sau đó.

## Kiểm chứng trên MySQL 8

Mọi migration mới phải được chạy trên MySQL thật phiên bản từ 8.0.16 trở lên,
ngoài lượt kiểm chứng MariaDB. Không dùng `CASE` làm biểu thức `CHECK` và không
dùng `ADD COLUMN IF NOT EXISTS`; hãy guard DDL bằng `INFORMATION_SCHEMA` và
prepared statement như các migration 004–013.

Tạo và kiểm tra container MySQL 8:

```powershell
docker run --name qlpt-mysql8 -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -p 3307:3306 -d mysql:8.0
docker logs qlpt-mysql8 --tail 3
docker exec qlpt-mysql8 mysql -uroot -e "SELECT VERSION();"
```

Thiết lập kết nối test trong phiên PowerShell. Chỉ dùng database có hậu tố
`_test` hoặc `_ci`; tuyệt đối không đặt bằng `DB_NAME` của hệ thống thật:

```powershell
$env:TEST_DB_HOST='127.0.0.1'
$env:TEST_DB_PORT='3307'
$env:TEST_DB_USER='root'
$env:TEST_DB_PASSWORD=''
$env:MIGRATION_TEST_DB_NAME='qlpt_migration_ci'
$env:TEST_DB_ALLOWED_NAME='qlpt_migration_ci'
$env:TEST_DB_NAME='qlpt_test'
```

Chạy migration trên DB tạm đã duyệt. Để chạy integration sau đó, đổi
`TEST_DB_ALLOWED_NAME` thành `qlpt_test` để khớp `TEST_DB_NAME`:

```powershell
npm run verify:mysql8
npm run test:unit
npm run test:integration
```

Integration còn cần các tài khoản fixture trong `test.env.template`. Script
migration và runner test đều tự xóa database tạm khi hoàn tất. Khi không còn
cần container, dừng và xóa thủ công:

```powershell
docker stop qlpt-mysql8
docker rm qlpt-mysql8
```

### MVP versioned API and OCR

Keep `DB_SYNC=false`. Configure `OCR_BASE_URL` in `.env` for the internal
FastAPI OCR service. The UC-09/UC-10 endpoints are under `/api/v1`; liveness is
`GET /health` and database readiness is `GET /ready`.

## API Endpoints

### Authentication

- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/register-khach-thue` - Đăng ký khách thuê
- `GET /api/auth/profile` - Lấy thông tin tài khoản (yêu cầu token)

### Phòng (Room)

- `GET /api/phong` - Danh sách phòng
- `GET /api/phong/:id` - Chi tiết phòng
- `POST /api/phong` - Tạo phòng (chủ trọ)
- `PUT /api/phong/:id` - Cập nhật phòng (chủ trọ)
- `DELETE /api/phong/:id` - Xóa phòng (chủ trọ)

### Hợp Đồng (Contract)

- `GET /api/hop-dong` - Danh sách hợp đồng
- `GET /api/hop-dong/:id` - Chi tiết hợp đồng
- `POST /api/hop-dong` - Tạo hợp đồng (chủ trọ)
- `PUT /api/hop-dong/:id` - Cập nhật hợp đồng (chủ trọ)
- `POST /api/hop-dong/:id/renew` - Gia hạn hợp đồng (chủ trọ)
- `GET /api/hop-dong/expiring` - Hợp đồng sắp hết hạn (chủ trọ)

## Cấu trúc Project

```
src/
├── config/          # Cấu hình (database, environment)
├── controllers/     # Controllers xử lý logic API
├── services/        # Services xử lý business logic
├── models/          # Sequelize models
├── routes/          # Route definitions
├── middleware/      # Middleware (auth, error handling)
├── validations/     # Joi validation schemas
├── utils/           # Utility functions
├── jobs/            # Cron jobs
└── app.js           # Express app setup
```

## Authentication

Tất cả API endpoints (trừ login/register) yêu cầu JWT token trong header:

```
Authorization: Bearer <token>
```

Token được cấp khi đăng nhập thành công.

## Roles & Permissions

- **CHU_TRO** (Landlord): Quản lý phòng, hợp đồng, tài chính, báo cáo
- **KHACH_THUE** (Tenant): Xem thông tin phòng thuê, hợp đồng, khoản thanh toán của mình

## Response Format

Tất cả API responses có format:

```json
{
  "success": true/false,
  "data": {...},
  "message": "..."
}
```

## Error Handling

Các lỗi validation và database sẽ trả về với status code phù hợp:

- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Database Schema

Backend ánh xạ đúng 37 bảng PascalCase/camelCase trong `data2.md`. Một số bảng
nghiệp vụ chính:

- `TaiKhoan`, `ChuTro`, `KhachThue`
- `CanTro`, `PhongTro`, `TaiSan`
- `HopDong`, `TienCoc`, `ThanhVienPhong`, `ViPhamHopDong`
- `ChiSoDien`
- `ThanhToan` (nghĩa vụ theo kỳ), `ChiTietThanhToan`,
  `GiaoDichThanhToan` (từng lần thu)
- `YeuCau` cùng ba bảng subtype
- `SuCo`, `SuCoTaiSan`
- `KhoanThu`, `KhoanChi`
- `BienBanTraPhong`, `KhoanKhauTru`, `ThongBao`

## Business Rules Implemented

- **BR-02**: Cảnh báo hợp đồng hết hạn (tối thiểu 1 tháng trước)
- **BR-03**: Công thức tính khoản phải thu
- **BR-05**: Xử lý quá hạn giữ phòng
- **BR-10**: Luồng trạng thái phòng
- **BR-12-14**: Quyền truy cập theo vai trò
- **BR-15**: Không xóa phòng có lịch sử hợp đồng

## Cron Jobs

- Cảnh báo hợp đồng hết hạn
- Tạo khoản phải thu hàng tháng (ngày 01)
- Kiểm tra phòng quá hạn giữ

## License

ISC
