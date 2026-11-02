# Hệ thống quản lý chuỗi phòng trọ

Mã nguồn chạy hệ thống gồm API Express/MySQL (`phong-tro-backend`), giao diện Vite (`phong-tro-frontend`) và dịch vụ OCR FastAPI cùng hai model (`phong-tro-ocr`).

## Cài đặt

1. Chuẩn bị MySQL 8 và schema theo `data2.md`; áp dụng các migration cần thiết trong `phong-tro-backend/migrations` theo hướng dẫn `docs/DB_SETUP.md`.
2. Cấu hình biến môi trường backend theo `phong-tro-backend/README.md`. Không đưa mật khẩu hoặc file `.env` lên Git.
3. Trong `phong-tro-backend`, chạy `npm ci` rồi `npm start`. Lệnh start khởi động API và OCR; xem `docs/OCR_SETUP.md`.
4. Trong `phong-tro-frontend`, chạy `npm ci` rồi `npm run dev` để phát triển, hoặc `npm run build` để tạo bản triển khai.

Mã kiểm thử trong hai thư mục `tests` đi kèm để xác minh thay đổi trước khi triển khai. Backend không tự cập nhật schema của database đang dùng.
