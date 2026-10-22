# Quản lý chuỗi phòng trọ ISK19

Ứng dụng gồm frontend Vite trong [`phong-tro-frontend/`](phong-tro-frontend/) và API Express/MySQL trong [`phong-tro-backend/`](phong-tro-backend/). Dịch vụ OCR chạy riêng theo [`docs/OCR_SETUP.md`](docs/OCR_SETUP.md).

## Tiếp tục phát triển

- Nghiệp vụ hiện hành: [`SRS.md`](SRS.md). Schema và dữ liệu mẫu 37 bảng: [`data2.md`](data2.md).
- Trạng thái chức năng Chủ trọ: [`chutro.md`](chutro.md). Quyền route: [`docs/AUTHZ_MATRIX.md`](docs/AUTHZ_MATRIX.md).
- Chạy frontend: xem [`phong-tro-frontend/README.md`](phong-tro-frontend/README.md). Chạy và kiểm thử backend: xem [`phong-tro-backend/README.md`](phong-tro-backend/README.md).
- Quy tắc an toàn dữ liệu và bàn giao: [`AGENTS.md`](AGENTS.md).

Frontend đang dùng `index.html` và `src/main.js` với router SPA; bộ trang tĩnh `pages/`, `assets/`, `components/` của nguyên mẫu đã được bỏ. URL cũ dạng `/pages/*.html` cần chuyển sang route `/#/...` tương ứng.

Các báo cáo triển khai và tài liệu nguyên mẫu đã cũ vẫn xem được trong lịch sử Git. Bản tổng kết 7 giai đoạn được giữ ở [`docs/archive/audit_1_7.md`](docs/archive/audit_1_7.md) để truy vết, không dùng làm trạng thái hiện tại.
