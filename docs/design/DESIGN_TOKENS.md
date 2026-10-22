# UI-2a-1 — token và khung ISK19

Ảnh [dashboard-reference.png](dashboard-reference.png) chỉ là tham chiếu bố cục/màu; mọi số trong ảnh là giả định và không được đưa vào mã. `src/shared/styles/ui2-shell.css` là lớp token/khung cuối cùng trong thứ tự import. Trang khác giữ nguyên bố cục nội dung; chỉ thừa hưởng chữ, màu, nền, thẻ và thanh điều hướng.

| Token | Giá trị | Vai trò |
|---|---|---|
| `--ui2-navy` | `#0F2B6A` | thanh bên, nút chính |
| `--ui2-navy-active` | `#1F4A9E` | mục điều hướng đang chọn |
| `--ui2-ink` | `#14275E` | chữ chính, tiêu đề |
| `--ui2-subtext` | `#465574` | chữ phụ |
| `--ui2-blue-light` | `#6D87C6` | đồ họa xanh nhạt (đã tăng tương phản so với ảnh) |
| `--ui2-amber` | `#BD7600` | cảnh báo/focus, không dùng chữ trắng trên nền vàng |
| `--ui2-red` | `#C9272B` | quá hạn/nguy hiểm |
| `--ui2-canvas` | `#F6F8FC` | nền ứng dụng |
| `--ui2-border`, `--ui2-radius`, `--ui2-shadow` | `#D9E1EE`, `14px`, bóng nhẹ | thẻ/bảng |
| `--ui2-gap` | `16px` | khoảng cách thẻ |
| `--font-sans` | system-ui → Segoe UI → Arial | chữ hệ thống có glyph tiếng Việt, không tải font mới |

Khung desktop thanh bên 254px; màn hình dưới 900px dùng drawer hiện có; dưới 768px thu nút “Tạo mới” còn biểu tượng. Test `ui2-shell.test.mjs` dùng hàm thuần WCAG để kiểm chữ ≥4,5:1 và đồ họa ≥3:1; kiểm hành vi chuông bằng `hasUnreadNotifications`. `:focus-visible` có vòng 3px; số dùng `tabular-nums`. Trạng thái thực tế trên trình duyệt/chữ có dấu cần người dùng build và kiểm tra trực tiếp.

Thẻ “Không gian quản lý” cũ không có click handler hay dữ liệu nghiệp vụ riêng nên được bỏ. Các lối tạo thật tìm được: Thêm căn trọ (`buildings`), Thêm phòng (`rooms`), Tạo hợp đồng (`contracts`), Tạo sự cố (`incidents`); menu điều hướng đến tab có nút tạo, không ghi dữ liệu ngay. Chấm chuông dùng `GET /api/v1/notifications` và `da_doc`, mặc định ẩn cho đến khi tải xong. Ô tìm kiếm giữ phím Ctrl/Cmd+K để focus, chưa thêm tìm kiếm toàn hệ thống giả.

Người dùng đã xác nhận “Build UI-2a-1 OK”. Phần thân dashboard UI-2a-2 đã dùng các token trên; xem `docs/DASHBOARD_METRICS.md`. Build và xem trực tiếp UI-2a-2 vẫn do người dùng thực hiện.
