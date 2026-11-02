# Electric Meter OCR API

API nhận ảnh công tơ điện, tìm vùng hiển thị số, rồi đọc các chữ số trong vùng đó.

Mã nguồn và hai model `.pt` trong thư mục này được đưa vào repository chính từ
[`phuckhang0211/meter_ocr`](https://github.com/phuckhang0211/meter_ocr), commit
`3c125ac0d7019a6bfb06eb9207396262906a5ff7`. Ảnh trong thư mục `test/` của
repository gốc không được sao chép vào đây.

## Cài đặt và chạy

```powershell
cd phong-tro-ocr
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Trên hệ điều hành khác, kích hoạt virtualenv rồi chạy:

```bash
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Tài liệu tương tác: `http://127.0.0.1:8000/docs`.

Thử trực tiếp với ảnh do bạn cung cấp: `python run.py <duong-dan-anh>`.

## API

`POST /ocr` nhận `multipart/form-data`, với trường file tên `file`.

```json
{
  "success": true,
  "ocr_value": "012345",
  "error_code": null
}
```

Nếu không tìm được vùng số hoặc OCR không đọc được số, API trả `success: false`;
`error_code` lần lượt là `METER_DISPLAY_NOT_FOUND` hoặc `OCR_FAILED`.
Node.js nên kiểm tra `success` và độ dài `ocr_value` trước khi dùng kết quả.
