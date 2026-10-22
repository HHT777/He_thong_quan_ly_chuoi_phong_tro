# Backend quản lý phòng trọ

API Node.js/Express cho Chủ trọ và Khách thuê. Chạy bằng Node.js 20+ và MySQL 8.0.16+.

## Nguồn chuẩn

- Nghiệp vụ: [`../SRS.md`](../SRS.md).
- Schema 37 bảng và dữ liệu mẫu: [`../data2.md`](../data2.md).
- Trạng thái triển khai Chủ trọ: [`../chutro.md`](../chutro.md).
- Quyền truy cập route: [`../docs/AUTHZ_MATRIX.md`](../docs/AUTHZ_MATRIX.md).
- Cách khởi động OCR: [`../docs/OCR_SETUP.md`](../docs/OCR_SETUP.md).
- Endpoint đang có: xem `src/routes/` và test tương ứng; không dùng tài liệu API nguyên mẫu để suy ra route hiện hành.

Migration đang dùng nằm ở `migrations/004_*.sql` đến `migrations/016_*.sql`. Schema phải được kiểm chứng trước khi chạy server. Ngoài `NODE_ENV=test`, server bỏ qua `DB_SYNC` và `DB_SYNC_ALTER`; không tự sửa database.

## Cài đặt và chạy

```bash
npm ci
npm run dev
```

Đặt cấu hình kết nối trong `.env` của backend. Cần `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRE`; `PORT` mặc định là 3001. Không đưa `.env` vào Git. `GET /health` kiểm tra tiến trình; `GET /ready` kiểm tra kết nối database.

OCR chạy thành dịch vụ riêng. Đặt `OCR_BASE_URL` theo đúng host/cổng đang chạy; nếu OCR lỗi, màn chỉ số điện cho nhập tay. Xem hướng dẫn trong `docs/OCR_SETUP.md` ở thư mục gốc.

## Kiểm thử

```bash
npm run test:unit
```

Integration và migration verifier **tạo/xóa database test**. Chỉ chạy khi đã xác nhận đích test. Trong môi trường kiểm thử được duyệt, dùng duy nhất `qlpt_authz_test` ở `127.0.0.1:3307`. Các biến `TEST_DB_NAME`, `TEST_DB_ALLOWED_NAME`, `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD` phải trỏ đúng đích; `TEST_DB_ALLOWED_NAME` phải trùng chính xác `TEST_DB_NAME`. Runner không lấy đích ghi từ `DB_*` của `.env`.

Fixture còn cần các biến `TEST_LANDLORD_USERNAME`, `TEST_LANDLORD_PASSWORD`, `TEST_TENANT_USERNAME`, `TEST_TENANT_PASSWORD`, `TEST_OTHER_TENANT_USERNAME`, `TEST_OTHER_TENANT_PASSWORD`, `TEST_NEW_ACCOUNT_PASSWORD`; xem `test.env.template`. Không ghi thông tin đăng nhập thật vào tài liệu hoặc log.

```bash
npm run test:integration
npm run verify:mysql8
```

`scripts/seed.js` chỉ dành cho database test được duyệt, yêu cầu `NODE_ENV=test` và `--confirm-db=<TEST_DB_NAME>`. Không chạy seed hoặc migration trên DB phát triển/thật khi chưa có quy trình sao lưu và xác nhận riêng.

## Mã nguồn

- `src/routes/`: endpoint và guard.
- `src/controllers/`, `src/services/`: xử lý HTTP và nghiệp vụ.
- `src/models/`, `migrations/`: schema runtime và thay đổi cấu trúc.
- `src/jobs/`: tác vụ định kỳ.
- `scripts/`, `tests/`: kiểm chứng và dữ liệu test.

Thay đổi nhiều bảng phải dùng một transaction; route mới cần cập nhật `docs/AUTHZ_MATRIX.md` và test hai Chủ trọ. Xem thêm quy tắc trong [`../AGENTS.md`](../AGENTS.md).
