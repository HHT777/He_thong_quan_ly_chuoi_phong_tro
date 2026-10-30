# Thanh toán (UI-3)

- Nhánh `ui-3-thanh-toan` từ `sua-luong-hop-dong-cu-dan`; chỉ sửa frontend.
- Danh sách: `GET /api/khoan-phai-thu/payment/list?limit=20&page=N&ma_can=...`; `pagination.total` cho chỉ báo `1–20 / tổng`.
- Căn: `GET /api/management/can-tro`; bộ lọc gửi `ma_can` phía server, lưu `building` và `page` trong hash URL.
- Dòng bảng: `thanhToan.hopDong.khachThue.ho_ten`, `phongTro.so_phong`, `canTro.ten_can`, `so_tien`, `thoi_diem_ghi_nhan`, `trang_thai_xac_nhan`, `khoanThu.ghi_chu`.
- Chờ xác nhận được chọn khi `trang_thai_xac_nhan=CHO_XAC_NHAN` và nguồn khác `KHAU_TRU_COC`; chỉ chọn trang đang xem.
- Nút xác nhận gọi `POST /api/khoan-phai-thu/payment/:id/confirm` từng dòng; thành công bỏ chọn, thất bại giữ chọn.
- Hủy giao dịch chỉ cho `DA_XAC_NHAN` + `THU_TIEN`; gọi `POST /api/v1/payments/:id/cancel` với `reason` không rỗng. Backend hủy KhoanThu hiệu lực và tính lại công nợ.
- Ghi nhận: `GET /api/khoan-phai-thu?issuance=SENT` để chọn Căn → Phòng → Phiếu; `POST /api/khoan-phai-thu/payment/create` giữ payload cũ và Idempotency-Key.
- Khung chi tiết chỉ hiển thị dữ liệu API có; URL minh chứng không được nhúng vì chưa có route tải có xác thực.
- API danh sách chưa hỗ trợ lọc trạng thái, từ khóa, kỳ/ngày, sắp xếp và thống kê số đếm theo trạng thái/tổng tiền chờ; các bộ lọc đó chưa bật.
- API chưa trả tên người ghi nhận, điện thoại, lịch sử sự kiện và đường tải minh chứng có xác thực; các mục này chưa hiển thị.
- Endpoint xác nhận không nhận Idempotency-Key; không thể bảo đảm hợp đồng khóa thử lại cho xác nhận hàng loạt chỉ bằng frontend.
