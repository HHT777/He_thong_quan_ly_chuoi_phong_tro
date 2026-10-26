# Báo cáo tài chính UI-2c

## Điểm dừng UI-2c-1

Trang `Tài chính → Báo cáo` đọc dữ liệu thật từ API hiện có. Giao diện mặc định dùng năm và tháng hiện tại theo `Asia/Ho_Chi_Minh`, tất cả căn, chế độ Biểu đồ. Bộ lọc năm/kỳ/căn cập nhật sau 250 ms, hủy request cũ và bỏ response đến muộn. Năm khả dụng hiện là năm hiện tại và bốn năm trước; backend chưa có endpoint liệt kê năm có dữ liệu. URL hash lưu `year`, `period`, `buildingId`, `view`, `metric` để tải lại hoặc quay về giữ lựa chọn. Không dùng khoảng ngày tùy chọn trong giao diện; API vẫn hỗ trợ.

| Phần tử | Endpoint / trường API | Cách dùng |
|---|---|---|
| Danh sách căn | `GET /api/management/can-tro`: `data[].ma_can,ten_can` | Lựa chọn căn và tên căn; không suy số tiền |
| KPI thực nhận | `GET /api/v1/reports/cashflow?periodType=month\|quarter\|year&periodValue=...&buildingId=...`: `totalRevenue,grossRevenue,discounts,depositDeductions` | Hiển thị nguyên số server |
| KPI chi phí / lợi nhuận | Như trên: `totalExpenses,profit` | Hiển thị nguyên số server; client không trừ lại |
| Doanh thu theo loại | Như trên: `revenueByType[].type,amount` | Sắp xếp, gom loại thứ 6 trở đi thành “Khác”, tính tỷ trọng hiển thị bằng phần dư lớn nhất để tổng là 100,0%; không đổi số tiền |
| Bảng khoản thu | Như trên: `receiptDetails[]` | Lọc `source != CHI_PHI`, dùng ngày, loại, số tiền, snapshot server |
| Lợi nhuận từ thu đến lãi | Như trên: `totalRevenue,totalExpenses,profit` | Ba số server độc lập, biểu đồ cột/bậc thang/tròn; tròn chỉ bật khi lợi nhuận không âm và thực nhận dương |
| Biểu đồ thời gian khi chọn tháng | `GET /api/v1/dashboard/insights?period=YYYY-MM&buildingId=...`: `cashflow6m[]` | Sáu tháng kết thúc ở tháng chọn; thiếu tháng hiển thị 0, không tự cộng tiền |
| Biểu đồ thời gian khi chọn quý/năm | Ba/mười hai lần `GET /api/v1/reports/cashflow?periodType=month&periodValue=YYYY-MM&buildingId=...`, tối đa ba request song song | API chưa trả chuỗi tháng cho cả kỳ; các giá trị mỗi tháng là tổng server riêng tháng đó |
| Xuất Excel | `GET /api/v1/reports/cashflow.xlsx` với đúng query tổng kỳ đang áp dụng | Dùng tên file response nếu hợp lệ |

KPI là nút chọn một chỉ tiêu. Khi chưa chọn, trang chỉ hiện một biểu đồ tổng quan. Doanh thu có hai góc nhìn: thời gian (cột/đường/vùng) và loại thu (thanh ngang/tròn/cột). Lợi nhuận có thời gian (cột/đường/vùng) và từ thu đến lãi (cột/bậc thang/tròn). Lựa chọn góc nhìn/dạng biểu đồ được nhớ theo chỉ tiêu trong localStorage. Chế độ Bảng chi tiết chỉ hiện chỉ tiêu đang chọn; riêng lợi nhuận là bảng từng tháng. Nút “Xem tổng quan” hoặc bấm lại KPI trở về tổng quan.

Chế độ So sánh căn có bảng và biểu đồ thanh ngang dùng cùng tỷ lệ cho thực nhận, chi phí và lợi nhuận của từng căn. Khi lợi nhuận âm, thanh lợi nhuận dùng màu đỏ; số chính xác ở bảng và khi rê chuột/Tab vào dòng. Dữ liệu `byBuilding` có `inComparison=false` không đi vào phần so sánh; chi phí chưa phân căn được giữ theo số server. Khi chọn một căn, API cashflow và xu hướng đều nhận `buildingId` đó; chi phí chưa phân căn không được tự phân bổ.

Sau phản hồi giao diện, bộ lọc tách riêng Năm, Xem theo (Tháng/Quý/Cả năm) và giá trị Tháng/Quý. Biểu đồ giới hạn độ rộng SVG để nhãn không phóng quá cỡ, chấm lợi nhuận nhỏ hơn và chú giải có ký hiệu ứng với từng chuỗi. Thẻ biểu đồ không ép chiều cao khi nội dung ngắn, giảm khoảng trắng ở cuối trang.

Token `--chart-profit-line` và `--chart-profit-fill` được đặt ở `ui2-shell.css`, nhưng mới dùng tại Báo cáo. Tổng quan chưa đổi màu và cần người dùng quyết định có áp dụng cùng token hay không. Biểu đồ có bảng ẩn cho trình đọc màn hình, tooltip qua hover/focus, trục 0 rõ và số đầy đủ ở bảng/tooltip. Các giá trị động đi qua `escapeHtml` trước khi ghép HTML; chú giải và nhãn số giữ ý nghĩa không phụ thuộc màu.

## Việc để UI-2c-2

- Thẻ Chi phí: hai góc nhìn đủ dạng, bảng chi phí cùng form ghi nhận/hủy theo API `management/thu-chi` hiện có.
- So sánh căn: chip lọc, xếp hạng, dòng chưa phân căn. Góc “Theo tháng” cần nhiều request theo căn nên chưa bật; nếu không có endpoint tổng hợp thì bỏ góc này theo yêu cầu.
- Gộp tab Thu chi vào Báo cáo và chuyển hướng route cũ; giữ nguyên ở mốc này.
- API hiện không cung cấp endpoint “năm có dữ liệu”, cũng không có endpoint tạo khoản thu khác. Không tự tạo những chức năng đó.

## Kiểm chứng tại mốc UI-2c-1

`tests/report-page.test.mjs`, `tests/report-geometry.test.mjs`, `tests/report-screen-2c.test.mjs`, `tests/ui2-shell.test.mjs` kiểm kỳ, nhãn, tỷ trọng, hình học âm/0, URL/query, trạng thái rỗng/lỗi/tải, nội dung theo KPI và tương phản. Sau điều chỉnh giao diện: frontend test 47 đạt, 1 live DB bỏ qua; bộ quét `innerHTML` 2 đạt, 0 vi phạm; `npm run build` đạt. Chưa kiểm tra trực tiếp bằng trình duyệt ở kích thước màn hình trong ảnh.
