# Luồng hoạt động của Electric Meter OCR API

## 1. Tổng quan

API được xây dựng bằng FastAPI và sử dụng hai model YOLO theo tuần tự:

1. Model vùng số tìm vị trí vùng hiển thị số trên ảnh công tơ.
2. Model chữ số đọc từng ký tự trong vùng đã crop.

Node.js chỉ cần gửi ảnh và nhận lại chuỗi OCR. Việc kiểm tra chuỗi có đúng số
lượng chữ số của công tơ hay không được thực hiện ở Node.js.

```text
Node.js
   │
   │ POST /ocr (multipart/form-data, field: file)
   ▼
FastAPI
   │
   ├── Giải mã ảnh thành OpenCV/Numpy
   ├── Model 1: tìm vùng hiển thị số
   ├── Chọn box có confidence cao nhất
   ├── Crop vùng số và thêm padding
   ├── Model 2: nhận diện từng chữ số
   ├── Sắp xếp chữ số theo vị trí trái → phải
   └── Trả JSON
   ▼
Node.js kiểm tra success và độ dài ocr_value
```

## 2. Khởi động API

Chạy từ thư mục gốc dự án:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Khi FastAPI khởi động, `app/main.py` tạo một `DigitPipeline`. Pipeline nạp hai
model một lần vào bộ nhớ:

```text
models/digit_detection.pt   → Model 1: phát hiện vùng hiển thị số
models/number_detection.pt  → Model 2: nhận diện từng chữ số
```

Model không được nạp lại ở mỗi request. Vì vậy các request sau đó chỉ thực hiện
inference trên các model đã có sẵn.

## 3. Request từ Node.js

Node.js gửi request HTTP:

```text
POST http://localhost:8000/ocr
Content-Type: multipart/form-data
Field: file
```

File upload phải là ảnh đọc được bởi OpenCV, ví dụ JPEG hoặc PNG.

Ví dụ gọi từ Node.js:

```js
const form = new FormData();
form.append("file", imageStream, "meter.jpg");

const response = await fetch("http://localhost:8000/ocr", {
  method: "POST",
  body: form
});

const result = await response.json();
```

## 4. Xử lý ảnh trong API

### Bước 1: Đọc ảnh

API đọc dữ liệu nhị phân từ `UploadFile`, sau đó chuyển thành ảnh OpenCV BGR.

Nếu file rỗng hoặc không phải ảnh hợp lệ, API trả lỗi HTTP và không chạy model.

### Bước 2: Phát hiện vùng số

Model 1 được gọi với ngưỡng:

```text
REGION_CONFIDENCE_THRESHOLD = 0.5
```

Các bounding box có confidence nhỏ hơn `0.5` sẽ bị loại bởi YOLO. Nếu còn
nhiều box, pipeline chọn box có confidence cao nhất vì mỗi ảnh công tơ chỉ cần
một vùng hiển thị số.

### Bước 3: Crop vùng số

Pipeline lấy tọa độ bounding box đã chọn và crop từ ảnh gốc. Một padding mặc
định là `5` pixel được thêm xung quanh box để hạn chế việc cắt sát ký tự.

Bounding box luôn được giới hạn trong kích thước ảnh để không xảy ra lỗi khi
vùng số nằm gần cạnh ảnh.

### Bước 4: Nhận diện chữ số

Ảnh crop được đưa vào Model 2 với ngưỡng:

```text
DIGIT_CONFIDENCE_THRESHOLD = 0.5
```

Mỗi bounding box Model 2 trả về tương ứng với một chữ số. Pipeline lấy nhãn
class của từng box, tính vị trí tâm theo trục `x`, rồi sắp xếp từ trái sang phải.

Ví dụ:

```text
Các box nhận được:  ["6", "1", "9", "5", "9", "6"]
Sau khi sắp xếp:   "169596"
```

Kết quả luôn được giữ dạng chuỗi để không làm mất số `0` ở đầu, ví dụ
`"012345"`.

## 5. Response thành công

```json
{
  "success": true,
  "ocr_value": "169596",
  "error_code": null
}
```

Node.js nên kiểm tra:

```js
const EXPECTED_LENGTH = 6;

const valid =
  result.success === true &&
  typeof result.ocr_value === "string" &&
  result.ocr_value.length === EXPECTED_LENGTH;
```

Chỉ sử dụng kết quả khi `valid` là `true`.

## 6. Các nhánh lỗi nghiệp vụ

### Không tìm thấy vùng hiển thị số

Xảy ra khi Model 1 không trả về box nào có confidence từ `0.5` trở lên.

```json
{
  "success": false,
  "ocr_value": null,
  "error_code": "METER_DISPLAY_NOT_FOUND"
}
```

### Không đọc được chữ số

Xảy ra khi Model 2 không trả về ký tự nào hợp lệ.

```json
{
  "success": false,
  "ocr_value": null,
  "error_code": "OCR_FAILED"
}
```

Trong cả hai trường hợp, Node.js có thể yêu cầu người dùng chụp lại ảnh.

## 7. Kiểm tra API

Health check:

```text
GET http://127.0.0.1:8000/health
```

Kết quả:

```json
{
  "success": true
}
```

Swagger UI để thử trực tiếp:

```text
http://127.0.0.1:8000/docs
```

## 8. Sơ đồ trách nhiệm các file

```text
app/main.py
  └── khởi tạo FastAPI và nạp DigitPipeline

app/api/ocr.py
  └── nhận upload, kiểm tra ảnh và trả JSON

app/services/digit_pipeline.py
  └── chạy Model 1, crop ảnh, chạy Model 2 và ghép OCR

app/core/config.py
  └── đường dẫn model, confidence threshold, padding

models/
  ├── digit_detection.pt
  └── number_detection.pt
```

## 9. Thay đổi ngưỡng xử lý

Nếu cần điều chỉnh độ nghiêm ngặt, sửa trong `app/core/config.py`:

```python
REGION_CONFIDENCE_THRESHOLD = 0.5
DIGIT_CONFIDENCE_THRESHOLD = 0.5
```

Sau khi sửa, cần khởi động lại Uvicorn để model sử dụng cấu hình mới.
