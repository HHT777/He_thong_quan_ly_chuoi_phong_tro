# Tích hợp dịch vụ OCR chỉ số điện

Backend không chạy Python bằng tiến trình con. `meterReading.service.js` gửi ảnh qua HTTP tới một dịch vụ FastAPI độc lập, vì vậy mã nguồn và model OCR được quản lý ở repository riêng.

## Cấu hình backend

Các biến môi trường liên quan:

```env
OCR_BASE_URL=http://127.0.0.1:8000
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

- `OCR_BASE_URL`: URL gốc của dịch vụ OCR. Backend mặc định dùng `http://127.0.0.1:8000`.
- `UPLOAD_DIR`: nơi backend lưu tạm ảnh được tải lên.
- `MAX_FILE_SIZE`: kích thước ảnh tối đa theo byte; mặc định là 10 MiB.

Backend gọi `POST {OCR_BASE_URL}/ocr` bằng `multipart/form-data`, trường ảnh có tên `file`. Dịch vụ OCR phải trả JSON thành công theo dạng:

```json
{
  "success": true,
  "ocr_value": "12345"
}
```

`ocr_value` phải chỉ gồm chữ số. Endpoint kiểm tra sức khỏe của dịch vụ Python là `GET /health`.

## Khởi động repository OCR

Tại thư mục gốc của repository OCR, nơi chứa `requirements.txt` và package `app`:

```bash
python -m venv .venv
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Hai file model YOLO mà cấu hình OCR tham chiếu phải tồn tại trước khi khởi động. Nếu dùng host hoặc port khác, cập nhật `OCR_BASE_URL` của backend tương ứng.

Kiểm tra nhanh:

```bash
curl http://127.0.0.1:8000/health
curl -X POST -F "file=@meter.jpg" http://127.0.0.1:8000/ocr
```

## Hành vi khi OCR không khả dụng

Backend giới hạn lời gọi OCR trong 30 giây. Khi dịch vụ không chạy, timeout, trả lỗi hoặc trả giá trị không hợp lệ, API preview không làm sập request. Nó trả:

- `ocrStatus: "MANUAL_REQUIRED"`;
- `suggestedReading: null`;
- cảnh báo `OCR_UNAVAILABLE` hoặc `OCR_TIMEOUT`.

Người dùng có thể nhập chỉ số thủ công rồi gửi kèm upload token. Token preview hiện được giữ trong bộ nhớ tiến trình backend trong 15 phút; khởi động lại backend sẽ làm token chưa sử dụng hết hiệu lực. File `MeterUpload.js` cũ không tham gia luồng này.

Ảnh và model OCR không được commit vào repository chính. Thư mục `/OCR/` được ignore và dịch vụ OCR được phát hành từ repository riêng.
