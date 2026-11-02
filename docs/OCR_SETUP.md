# Tích hợp dịch vụ OCR chỉ số điện

Backend gửi ảnh qua HTTP tới dịch vụ FastAPI trong `phong-tro-ocr/`. Với lệnh `npm start`, backend tự tạo môi trường Python lần đầu, cài thư viện OCR và khởi động dịch vụ cùng lúc với API. Khi backend tắt, tiến trình OCR do nó khởi chạy cũng dừng.

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

## Khởi động cùng backend

Cài Node.js 20+, MySQL và Python 3. Khi chạy backend bằng `npm start`, OCR tự khởi động tại `http://127.0.0.1:8000`. Lần chạy đầu sẽ tạo `phong-tro-ocr/.venv` và cài `requirements.txt`, có thể mất vài phút và cần kết nối Internet. Các lần sau dùng lại môi trường đã cài. Khi `requirements.txt` thay đổi, thư viện sẽ được cài lại tự động.

Mở terminal tại `phong-tro-backend`:

```powershell
npm start
```

Giữ terminal mở trong lúc sử dụng. Kiểm tra OCR tại `http://127.0.0.1:8000/health`. Nếu Python không nằm trong PATH, đặt `OCR_PYTHON` trong `.env` thành đường dẫn Python 3. Nếu OCR đã chạy tại URL mặc định thì backend sẽ dùng dịch vụ đó mà không mở bản thứ hai. Nếu `OCR_BASE_URL` trỏ ra máy khác, backend dùng dịch vụ ngoài và không tự khởi động OCR cục bộ.

## Khởi động OCR riêng (tùy chọn)

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
