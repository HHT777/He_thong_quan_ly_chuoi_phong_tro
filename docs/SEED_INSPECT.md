# Khảo sát dữ liệu trước khi tạo seed

`phong-tro-backend/scripts/seed-inspect.js` chỉ đọc dữ liệu hiện có để lập kế hoạch seed. Script không gọi `sync`, không mở transaction và không có câu lệnh ghi dữ liệu. Hãy dùng một tài khoản MySQL riêng chỉ được cấp quyền `SELECT` trên database cần khảo sát.

## Chạy trên PowerShell

Mở PowerShell tại thư mục `phong-tro-backend`, nhập thông tin kết nối bằng tài khoản chỉ đọc. Giá trị `DB_*` trong `.env` không được dùng làm đích kết nối.

```powershell
$env:SEED_INSPECT_CONFIRM = "development"
$env:SEED_INSPECT_DB_NAME = "phong_tro"
$env:SEED_INSPECT_DB_HOST = "127.0.0.1"
$env:SEED_INSPECT_DB_PORT = "3306"
$env:SEED_INSPECT_DB_USER = "tai_khoan_chi_doc"
$env:SEED_INSPECT_DB_PASSWORD = "mat_khau_tai_khoan_chi_doc"
node scripts/seed-inspect.js
```

Không chạy nếu database là production. Script từ chối khi `NODE_ENV=production`, tên database có dấu hiệu `prod`/`production`/`live`, hoặc thiếu `SEED_INSPECT_CONFIRM=development`. Tên DB và host/cổng phải được người chạy kiểm tra trước khi xác nhận.

Mặc định, script tạo một file JSON và một file Markdown trong `phong-tro-backend/reports/seed-inspection/`. Muốn chọn thư mục khác:

```powershell
node scripts/seed-inspect.js --output-dir="D:\duong-dan\thu-muc-khao-sat"
```

## Kiểm tra trước khi gửi kết quả

- Mở cả JSON và Markdown; xác nhận tên khách đã thành `KH-xx`, hợp đồng/giao dịch/khoản chi dùng mã thứ tự, không có UUID.
- Xác nhận không có số điện thoại, CCCD, email, tên đăng nhập, địa chỉ, ghi chú tự do hay mật khẩu.
- Tên căn và số phòng được giữ theo yêu cầu. Số tiền, ngày tháng, trạng thái, loại phí và chỉ số điện được giữ nguyên để đối chiếu.
- Nếu phát hiện thông tin cá nhân hoặc dữ liệu không muốn chia sẻ, không gửi file đó; báo lại để điều chỉnh phần xuất.

Script chỉ xuất loại chi phí/loại dòng phiếu quan sát được trong dữ liệu. Schema hiện hành không có danh mục phí dịch vụ riêng hoặc cột phương thức thanh toán trên giao dịch; ghi chú này cũng được đưa vào kết quả.
