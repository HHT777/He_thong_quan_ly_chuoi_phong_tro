# Tích hợp dịch vụ OCR chỉ số điện

Backend không chạy Python bằng tiến trình con. `meterReading.service.js` gửi ảnh qua HTTP tới dịch vụ FastAPI trong `phong-tro-ocr/`. Mã nguồn và hai model cần chạy đã được đưa vào repository chính; dịch vụ vẫn phải khởi động bằng một tiến trình riêng.

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

## Khởi động dịch vụ OCR

Sau khi clone repository chính, chạy tại thư mục `phong-tro-ocr/` (nơi chứa `requirements.txt`, `models/` và package `app`):

```powershell
cd phong-tro-ocr
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Hai file `models/digit_detection.pt` và `models/number_detection.pt` đã nằm trong repository chính. Nếu dùng host hoặc port khác, cập nhật `OCR_BASE_URL` của backend tương ứng. Có thể chạy `python run.py <duong-dan-anh>` để thử trực tiếp với ảnh tự cung cấp.

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

Ảnh công tơ tải lên và bộ ảnh `test/` từ repository OCR gốc không được commit vào repository chính. Hai model phục vụ chạy OCR được theo dõi tại `phong-tro-ocr/models/`. Thư mục `/OCR/` vẫn được ignore để giữ bản clone Git cũ tại máy phát triển; source dùng chung là `phong-tro-ocr/`.
