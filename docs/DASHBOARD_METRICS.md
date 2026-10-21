# UI-1a — Hợp đồng số liệu Tổng quan Chủ trọ

## UI-2a: nguồn insights đã có, phần thân giao diện chờ UI-2a-2

`GET /api/v1/dashboard/insights` (commit `546808b`, hoàn thiện `214a4da`) chỉ cho Chủ trọ, lấy căn từ `ownedBuildingIds`; `buildingId` không tồn tại/khác chủ trả 404 `RESOURCE_NOT_FOUND`. Một request trả các trường dưới đây, không tải danh sách rồi cộng số ở client. UI-2a-1 chỉ đổi token và khung; chưa hiển thị các ô mới.

| Khối dự kiến | Route/trường response | Kiểu/đơn vị | Phép gom | Điều hướng |
|---|---|---|---|---|
| Thu–chi 6 tháng | `cashflow6m[].month,totalRevenue,totalExpenses,profit,unassignedExpenses` | `YYYY-MM`, VND | Không cộng lại; từng tháng gọi cùng service cashflow của báo cáo | Chưa cho bấm lọc vì trang đích chưa đọc URL |
| Xu hướng doanh thu | `revenueChangePct` | phần trăm hoặc null | Backend so tháng hiện tại với tháng trước; mẫu số 0 → null | Không |
| Lấp đầy theo căn | `occupancyByBuilding[].buildingId,buildingName,total,rented,pct,inComparison` | phòng, % | SQL gom theo căn; căn ngừng hoạt động vẫn có, không so sánh | Chưa cho bấm lọc |
| Phiếu thu kỳ này | `billBuckets.paid,outstanding,overdue,total` | phiếu `DINH_KY` | Ba nhóm loại trừ nhau; suy ngày quá hạn theo `actionDue`, không dùng cột `qua_han` | Chưa cho bấm lọc |
| Dự báo hết hạn | `contractForecast.d30,d60,d90` | hợp đồng, cộng dồn | Từ ngày Việt Nam đến đúng 30/60/90 ngày; gồm `DANG_HIEU_LUC` và `SAP_HET_HAN`, không gồm `HET_HAN`/`DA_THANH_LY` | Chưa cho bấm lọc |
| Việc cần xử lý | `tasks[].type,count`, `contractWarningDays` | mục, ngày | Thứ tự 7 loại cố định ở service; dòng hợp đồng dùng ngưỡng cấu hình, khác dự báo 30/60/90 | Chỉ gắn liên kết khi trang đích thực sự đọc tham số |

Sáu tháng gần nhất tính theo ngày nghiệp vụ Việt Nam. Giá trị tiền lấy từ service cashflow: một Chủ trọ tính chi toàn chuỗi chưa phân căn; từ hai Chủ trọ tách `unassignedExpenses`, không âm thầm phân bổ. Xu hướng chỉ dành cho doanh thu, không gắn mũi tên cho KPI khác. Yêu cầu chờ xử lý suy căn qua bản ghi chi tiết `YeuCauGiaHan`/`YeuCauTraPhong`/`DeXuatBanCungPhong`, không suy qua mọi hợp đồng lịch sử của khách. Test `zz-dashboard-insights.integration.test.js` đối chiếu mỗi tháng với API cashflow, phân quyền hai Chủ trọ, ngày biên múi giờ, scoped due rule ngày 05→06 và dự báo `SAP_HET_HAN`; phép thử bỏ lọc sở hữu làm test đỏ (4 căn thay vì 1 cho B), khôi phục xanh. Đo 57 truy vấn khi cache cấu hình đã ấm, 58 khi lạnh trên fixture hai Chủ trọ; hiện dùng 7 lần gọi service cashflow, không N+1 theo số căn/phòng.

Ảnh mockup chỉ hướng dẫn bố cục/màu; mọi số đều lấy từ API. Phạm vi UI-1a không có thu–chi sáu tháng, lấp đầy theo căn và việc cần xử lý (chờ Đợt B). Không hiển thị con số giả hoặc ô trống thay thế.

## Nguồn → ô hiển thị

| Route (mỗi route gọi một lần) | Trường response | Kiểu/đơn vị | Hàm gom | Ô hiển thị |
|---|---|---|---|---|
| `GET /api/v1/dashboard/summary?period=YYYY-MM` | `data.rooms.total` | số nguyên/phòng | `readSummary` | Tổng số phòng; số giữa donut |
| Như trên | `data.rooms.byStatus.DANG_THUE` | số nguyên/phòng | `readSummary` | Đang thuê; lát donut |
| Như trên | `data.rooms.byStatus.*`, gồm `DA_GIU`, `KHAC` | số nguyên/phòng | `readSummary` kiểm tổng sáu phần bằng `rooms.total`; chỉ tính tỷ lệ từ `DANG_THUE / total` vì server chưa trả tỷ lệ | Tình trạng phòng; tỷ lệ lấp đầy |
| Như trên | `data.bills.total`, `daThu`, `conNo`, `quaHan` | số nguyên/phiếu `DINH_KY` của kỳ | `readSummary` kiểm ba nhóm loại trừ và tổng bằng `bills.total` | Phiếu thu kỳ này; công nợ quá hạn chỉ lấy `quaHan` |
| `GET /api/v1/reports/cashflow?periodType=month&periodValue=YYYY-MM` | `data.totalRevenue` | số nguyên/VND thực nhận | `readCashflow` (không tính lại) | Doanh thu thực nhận |
| `GET /api/hop-dong/expiring` | `data[]`, `warningDays`, `ngay_ket_thuc`, `phongTro.so_phong` | danh sách; ngưỡng ngày nguyên; ngày `YYYY-MM-DD` | `readExpiring`; `length` vì API trả toàn bộ danh sách | Hợp đồng thuộc diện cảnh báo; nhãn lấy từ `warningDays` |
| `GET /api/v1/incidents` | `data[]`, `trang_thai`, `ngay_gui`, `mo_ta` | danh sách/sự cố | `readIncidents` nhóm trạng thái, sắp ngày giảm dần, lấy ba dòng | Sự cố theo trạng thái; sự cố gần nhất |

`period` lấy theo tháng ở múi giờ `Asia/Ho_Chi_Minh`. Không truyền `buildingId` tự suy ra. Cashflow đã lọc theo căn sở hữu; trong hệ thống chỉ có một Chủ trọ, `totalExpenses` của báo cáo toàn chuỗi còn bao gồm khoản chi chưa phân căn theo quyết định G3. UI-1a chỉ hiển thị `totalRevenue`, không hiển thị tổng chi/lợi nhuận. Khi nhiều Chủ trọ, `unassignedExpenses` được API báo cáo tách riêng; UI-1a không che hoặc cộng nó vào doanh thu.

**Định nghĩa khối hợp đồng (FR-040/158):** `GET /api/hop-dong/expiring` dùng ngày nghiệp vụ Việt Nam và `contractWarningDays` trong cấu hình runtime (mặc định 30). `DANG_HIEU_LUC` được liệt kê nếu kết thúc từ hôm nay đến đúng ngày thứ `warningDays`; `SAP_HET_HAN` chưa qua ngày kết thúc vẫn được liệt kê ngay cả khi ngưỡng vừa giảm, vì trạng thái đó đã được cron xác lập trước đó. `HET_HAN`/`DA_THANH_LY` không thuộc danh sách. Kết quả sắp theo ngày kết thúc tăng dần, lọc theo căn của Chủ trọ. Response giữ `data[]` và thêm `warningDays`; dashboard hiển thị chính ngưỡng từ response, không gắn cứng 30 ngày.

## Bằng chứng mẫu từ `qlpt_authz_test`

Ngày 21/10/2026, kỳ `2026-10`, đăng nhập Chủ trọ seed `owner_ci` trên API test qua TCP 127.0.0.1:3307:

```json
{
  "rooms": {"total":30,"byStatus":{"TRONG":12,"DA_GIU":0,"DANG_THUE":15,"DANG_XU_LY_TRA_PHONG":1,"NGUNG_SU_DUNG":2,"KHAC":0}},
  "bills": {"total":16,"daThu":5,"conNo":0,"quaHan":11},
  "totalRevenue":29475661,
  "incidents":5,
  "expiring":1
}
```

`tests/dashboard-live.contract.test.mjs` đọc API thật, đưa response qua chính `readSummary/readCashflow/readIncidents/readExpiring`, rồi đối chiếu SQL trực tiếp theo Chủ trọ: phòng 30 (đang thuê 15); phiếu định kỳ 16 (đã thu 5, dư nợ 11); sự cố 5 (đã xử lý 3, đang xử lý 1, chờ tiếp nhận 1); doanh thu 29.475.661 VND bằng khoản thu hiệu lực cộng khấu trừ cọc trong kỳ; hợp đồng sắp hạn 1, đối chiếu trực tiếp theo trạng thái và cửa sổ ngày Việt Nam. Test `zz-dashboard-summary.integration.test.js` kiểm hai Chủ trọ A/B, Khách 403 và chưa xác thực 401; `cashflow-export.integration.test.js` kiểm số cashflow tách A/B; `contract-vietnam-day.integration.test.js` kiểm danh sách hợp đồng sau cron và không lộ hợp đồng của Chủ trọ khác.

## Số request và điều hướng

Dashboard cũ mở trang gọi 6 request (`/phong?limit=100`, `/khoan-phai-thu?limit=100`, `/v1/debt`, `/v1/incidents`, `/hop-dong?limit=100`, `/v1/reports/cashflow`). UI-1a gọi 4 request: summary, cashflow, expiring, incidents. Các KPI/phân bố phòng/phiếu dùng chung đúng một response summary. Thử lại một nguồn chỉ tải lại nguồn đó.

| Phần tử | Route đích | Tham số lọc | Trang đích đọc tham số? | Quyết định UI-1a |
|---|---|---|---|---|
| Từng lát donut/phần thanh phiếu/KPI quá hạn | `/properties/rooms`, `/finance/bills`, `/finance/debts` | `trang_thai`, `period`, `isOverdue` | Chưa: `core/router.js` chỉ nhận route khớp tuyệt đối; trang đích chưa đọc URL lọc | Không bấm được, không giả lọc |
| Hợp đồng/sự cố trong bảng | `/residents-contracts/contracts`, `/operations/incidents` | `contractId`, `status`, `incidentId` | Chưa đọc lọc URL | Không bấm được |
| `+ Tạo mới` | `/properties/rooms`, `/operations/meter-readings`, `/finance/bills`, `/residents-contracts/contracts` | Không có; chỉ lối tắt điều hướng cũ | Không cần | Bấm được, không tự tạo dữ liệu |

Không có mũi tên/chênh lệch so với kỳ trước vì chưa có response so sánh. KPI quá hạn là **phiếu kỳ đang chọn**, không phải toàn bộ nợ lịch sử hay nợ sau thanh lý. `summary.bills.quaHan` được backend tính theo ngày Việt Nam, `overdueDay` cấu hình và số dư, không đọc cờ cron `qua_han`. Đối soát ba nguồn quá hạn (`summary`, `/list/overdue`, `/v1/debt`) đã có ở `zz-overdue-sync.integration.test.js`; đếm trên dashboard dùng đúng trường `summary.bills.quaHan`.

## Lỗi và phần dùng chung

401, 403, 404, 503 `DB_SCHEMA_OUTDATED`, 5xx và mất mạng có thông báo an toàn riêng cho từng nguồn, cùng nút “Thử lại”; không thay lỗi bằng 0. `dashboard-render.test.mjs` kiểm hiển thị/lần tải; `dashboard-metrics.test.mjs` kiểm hợp đồng trường, đơn vị, trạng thái và dữ liệu mẫu. `status-labels.mjs` là bản đồ nhãn dùng chung; mã lạ chỉ hiện “Trạng thái khác”. `design-system.css` đặt badge `nowrap`; `dashboard.css` dùng màu navy sidebar qua `--brand-primary-deep`, không sửa màu các tab khác.

Rà ngoài dashboard: `modules/operations/move-outs.tab.js:24` và `modules/finance/bills.tab.js:20` còn câu “do server tính”; các màu cũ khác nằm trong tab/style riêng. UI-1a không thiết kế lại các tab này theo ràng buộc phạm vi. Frontend build và kiểm tra trực quan giao diện thu hẹp: **chưa chạy; người dùng tự build/xem**.
