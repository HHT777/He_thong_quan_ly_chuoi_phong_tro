# Cấu trúc thư mục hiện tại của hệ thống quản lý phòng trọ

> Cập nhật: 22/10/2026. Tài liệu này mô tả **mã đang có trong cùng một Git repository**, không phải cấu trúc dự kiến. Cây bên dưới liệt kê các thư mục và file tiêu biểu; những nhóm nhiều file được giải thích theo chức năng. Dấu `#` là chú thích, không nằm trong tên file.

## 1. Thư mục gốc

```text
QLPT_luu1/
├── AGENTS.md                         # Quy tắc làm việc, an toàn dữ liệu và mốc kiểm chứng của dự án.
├── README.md                         # Hướng dẫn tổng quan và cách chạy hai ứng dụng.
├── SRS.md                            # Đặc tả yêu cầu nghiệp vụ hiện hành.
├── data2.md                          # Nguồn mô tả schema hiện hành gồm 37 bảng.
├── chutro.md                         # Phạm vi và trạng thái triển khai chức năng Chủ trọ.
├── phantich.md                       # Tài liệu phân tích lịch sử; khi lệch nghiệp vụ thì theo SRS.md.
├── architecture.md                   # Tài liệu kiến trúc, có phần lịch sử/đề xuất cần đối chiếu với mã.
├── system_design.md                  # Tài liệu thiết kế hệ thống, không thay thế cây mã đang chạy.
├── usecase.md                        # Mô tả use case ở cấp dự án.
├── cau_truc_thu_muc.md               # Tài liệu cấu trúc hiện tại này.
├── Diagram/                          # Sơ đồ và ảnh minh họa nghiệp vụ/thiết kế.
├── docs/                             # Tài liệu triển khai, bàn giao và thiết kế.
│   ├── AUTHZ_MATRIX.md               # Ma trận route, vai trò và phạm vi sở hữu tài nguyên.
│   ├── DASHBOARD_METRICS.md          # Định nghĩa chỉ số dashboard.
│   ├── DB_SETUP.md                   # Thiết lập cơ sở dữ liệu và môi trường kiểm thử.
│   ├── OCR_SETUP.md                  # Cách kết nối dịch vụ OCR.
│   ├── HANDOFF_TENANT.md             # Bàn giao phần giao diện/chức năng Khách thuê.
│   ├── design/                       # Token giao diện và ảnh tham chiếu dashboard.
│   └── archive/                      # Tài liệu kiểm tra cũ được lưu tham khảo.
├── phong-tro-backend/                # API Express, nghiệp vụ, truy cập MySQL và tác vụ định kỳ.
├── phong-tro-frontend/               # Giao diện Vite SPA cho Chủ trọ và Khách thuê.
└── phong-tro-ocr/                    # Dịch vụ FastAPI và hai model đọc ảnh công tơ.
```

Ba thành phần nằm trong **một repository** nhưng chạy bằng các tiến trình riêng. Backend dùng Node.js, Express, Sequelize và MySQL; frontend dùng JavaScript, CSS và Vite; OCR dùng Python, FastAPI và hai model YOLO. Không có Kafka, PostgreSQL hoặc bộ frontend `pages/`, `assets/`, `components/` cũ trong mã đang theo dõi.

## 2. Backend: `phong-tro-backend/`

```text
phong-tro-backend/
├── README.md                         # Cách chạy API, test và kiểm chứng MySQL.
├── package.json                      # Script start, dev, seed, test:unit, test:integration, verify:mysql8.
├── package-lock.json                 # Khóa phiên bản dependency của npm.
├── test.env.template                 # Mẫu biến môi trường test, không chứa mật khẩu thực.
├── migrations/                       # SQL migration 004–016 cho schema hiện hành.
├── scripts/
│   ├── run-test-suite.js             # Runner tách unit và integration.
│   ├── seed.js                       # Seed có kiểm tra chặt tên DB test trước khi ghi.
│   ├── check-invariants.js           # Kiểm tra các bất biến dữ liệu.
│   ├── verify-migrations.js          # Kiểm chứng chuỗi migration trên MySQL.
│   ├── verify-g2-migrations.js       # Kiểm chứng migration thuộc giai đoạn G2.
│   └── verify-collation-upgrade.js   # Kiểm chứng thay đổi collation.
├── src/
│   ├── index.js                      # Điểm khởi động HTTP và cron.
│   ├── app.js                        # Cấu hình Express, middleware, health/ready và gắn route.
│   ├── config/
│   │   ├── database.js               # Cấu hình kết nối Sequelize/MySQL.
│   │   ├── environment.js            # Đọc và kiểm tra biến môi trường.
│   │   ├── roleAccess.js             # Quy tắc vai trò truy cập.
│   │   └── testDatabaseSafety.js     # Chặn thao tác ghi nhầm lên DB ngoài phạm vi test.
│   ├── routes/                       # Khai báo đường dẫn API và middleware cho từng nhóm.
│   │   ├── auth.routes.js            # Đăng nhập/xác thực.
│   │   ├── phong.routes.js           # Căn và phòng.
│   │   ├── hopDong.routes.js          # Hợp đồng.
│   │   ├── datCoc.routes.js           # Cọc.
│   │   ├── khoanPhaiThu.routes.js     # Phiếu thu và khoản phải thu.
│   │   ├── meterReading.routes.js    # Chỉ số điện và OCR.
│   │   ├── tenant.routes.js          # API cho Khách thuê.
│   │   ├── management.routes.js      # Các API quản lý tổng hợp.
│   │   └── mvp.routes.js             # Các route nghiệp vụ còn tập trung trong nhóm MVP.
│   ├── controllers/                  # Nhận request, gọi service, trả response; tên file tương ứng các nhóm route.
│   ├── services/                     # Luật nghiệp vụ và transaction, không đặt trong route.
│   │   ├── ownership.service.js      # Kiểm tra chủ sở hữu tài nguyên theo căn/phòng/hợp đồng.
│   │   ├── propertyAccess.service.js # Phạm vi truy cập căn và phòng.
│   │   ├── hopDong.service.js         # Nghiệp vụ hợp đồng cơ bản.
│   │   ├── contractLifecycle.service.js # Trạng thái, gia hạn và vòng đời hợp đồng.
│   │   ├── contractPrint.service.js  # Dữ liệu in hợp đồng.
│   │   ├── roomTransfer.service.js   # Chuyển phòng.
│   │   ├── reservation.service.js    # Giữ phòng.
│   │   ├── datCoc.service.js         # Theo dõi tiền cọc.
│   │   ├── meterReading.service.js   # Ảnh công tơ, OCR và xác nhận chỉ số điện.
│   │   ├── billGeneration.service.js # Lập/preview phiếu thu.
│   │   ├── billAdjustment.service.js # Điều chỉnh, giảm trừ phiếu.
│   │   ├── paymentLifecycle.service.js # Ghi nhận và xác nhận thanh toán.
│   │   ├── debtLifecycle.service.js  # Công nợ.
│   │   ├── moveOut.service.js        # Quyết toán trả phòng.
│   │   ├── incident.service.js       # Sự cố.
│   │   ├── cashflowReport.service.js # Báo cáo dòng tiền.
│   │   ├── cashflowExport.service.js # Xuất báo cáo Excel.
│   │   ├── dashboardSummary.service.js # Chỉ số tổng quan.
│   │   ├── dashboardInsights.service.js # Thông tin phân tích dashboard.
│   │   ├── systemConfig.service.js   # Cấu hình hệ thống trong DB.
│   │   ├── auditLog.service.js       # Ghi audit trong transaction.
│   │   ├── notification.service.js   # Tạo và gửi thông báo trong hệ thống.
│   │   └── dbNamedLock.service.js    # Khóa DB dùng chung cho cron.
│   ├── models/
│   │   ├── schema.js                 # Định nghĩa schema Sequelize đang được sử dụng.
│   │   ├── index.js                  # Đăng ký model và quan hệ.
│   │   └── *.js                      # Các model theo bảng/nhóm dữ liệu; xem lưu ý bản nháp bên dưới.
│   ├── domain/billing.constants.js   # Hằng số nghiệp vụ tính tiền.
│   ├── jobs/cron.jobs.js             # Tác vụ định kỳ chạy cùng backend.
│   ├── middleware/                   # Xác thực, phân quyền và xử lý lỗi HTTP.
│   ├── utils/                        # Ngày nghiệp vụ, kỳ thu, tính toán, phân trang, ghi XLSX.
│   └── validations/                  # Schema kiểm tra dữ liệu đầu vào cho API.
└── tests/                            # Unit, integration, fixture và helper kiểm chứng nghiệp vụ.
    ├── helpers/                      # Dựng môi trường/fixture test.
    └── fixtures/                     # Dữ liệu kiểm chứng schema lịch sử.
```

`data2.md`, `migrations/`, `src/models/schema.js` và `src/models/index.js` cần được đối chiếu cùng nhau khi sửa schema. Một số file model đang hiện trên ổ đĩa nhưng **chưa được Git theo dõi** (`IdempotencyKey.js`, `MeterUpload.js`, `NguoiO.js`, `OutboxEvent.js`, `SuCo.js`, `YeuCau.js`); đây là bản nháp có chủ ý, không được suy ra rằng chúng là model runtime hoặc tự ý xóa/sửa.

Backend tích hợp với dịch vụ OCR qua HTTP theo `docs/OCR_SETUP.md`; source dùng chung nằm trong `phong-tro-ocr/`. Bản clone OCR cũ ở `OCR/` vẫn bị Git ignore. File `.env`, `node_modules/` và `uploads/` là dữ liệu môi trường/runtime, không phải source để commit.

## 3. Frontend: `phong-tro-frontend/`

```text
phong-tro-frontend/
├── README.md                         # Hướng dẫn chạy Vite và các điểm nối API.
├── package.json                      # Script dev, build, preview; không có script npm start.
├── package-lock.json                 # Khóa dependency.
├── vite.config.js                    # Vite và proxy /api, /health tới backend.
├── index.html                        # HTML đầu vào duy nhất của SPA.
├── member.html                       # Trang giới thiệu thành viên độc lập.
├── src/
│   ├── main.js                      # Khởi tạo ứng dụng, phiên đăng nhập và style.
│   ├── core/
│   │   ├── api.js                   # Client gọi API backend.
│   │   ├── router.js                # Điều hướng bằng hash URL.
│   │   ├── module-registry.js       # Nạp các module *.tab.js.
│   │   ├── session.js               # Trạng thái đăng nhập/phiên.
│   │   └── idempotency.js           # Khóa idempotency cho thao tác cần chống ghi trùng.
│   ├── layout/
│   │   ├── app-shell.js             # Sidebar, header và khung trang.
│   │   ├── modals.js                # Hộp thoại dùng chung.
│   │   └── shell-data.mjs           # Dữ liệu/cấu hình menu giao diện.
│   ├── modules/
│   │   ├── overview/                # Dashboard và hàm tính chỉ số hiển thị.
│   │   ├── properties/              # Căn trọ, phòng, nội thất/tài sản.
│   │   ├── residents-contracts/     # Giữ phòng, cư dân, tài khoản, hợp đồng, cọc, người ở cùng, yêu cầu.
│   │   │   └── building-scope.js    # Bộ lọc theo căn cho nhóm Cư dân & Hợp đồng.
│   │   ├── finance/                 # Phiếu thu, thanh toán, công nợ, điều chỉnh, dòng tiền, báo cáo.
│   │   ├── operations/              # Chỉ số điện, sự cố và trả phòng.
│   │   ├── notifications/           # Hộp thư thông báo và broadcast.
│   │   ├── settings/                # Cấu hình hệ thống Chủ trọ.
│   │   └── tenant/                  # Các tab Khách thuê; mức hoàn thiện xem docs/HANDOFF_TENANT.md.
│   └── shared/
│       ├── components/              # Icon, nhãn trạng thái, toast, helper dựng tab/view.
│       ├── design/                  # Kiểm tra độ tương phản màu.
│       └── styles/                  # CSS hệ thống, layout, dashboard, tab, quản lý và tiếng Việt.
└── tests/                            # Test render/contract dashboard, lọc căn và shell giao diện.
```

Các file `*.tab.js` trong `src/modules/` là đơn vị trang/tab của SPA, được nạp qua `module-registry.js`. Có file trên ổ đĩa không đồng nghĩa tính năng đã hoàn thiện hoặc đang hiển thị trên menu; riêng phần Khách thuê cần đọc `docs/HANDOFF_TENANT.md` trước khi tiếp tục. `src/modules/residents-contracts/deposits.tab.js` vẫn tồn tại trong source nhưng tiền cọc được đưa vào luồng chi tiết hợp đồng theo giao diện hiện tại.

`node_modules/` và `dist/` là thư mục sinh ra khi cài/build, không phải source. Frontend phát triển bằng `npm run dev`; kiểm tra bản phát hành bằng `npm run build`. Backend dùng `npm run dev` hoặc `npm start` theo `phong-tro-backend/README.md`.

## 4. OCR: `phong-tro-ocr/`

```text
phong-tro-ocr/
├── README.md                         # Cài đặt và chạy dịch vụ OCR.
├── requirements.txt                  # Dependency Python của FastAPI và YOLO.
├── run.py                            # Thử nhận dạng trực tiếp với một đường dẫn ảnh được cung cấp.
├── flow.md                           # Mô tả pipeline OCR và API.
├── app/
│   ├── main.py                       # Tạo FastAPI, nạp hai model một lần và cung cấp /health.
│   ├── api/ocr.py                    # Endpoint POST /ocr nhận ảnh multipart.
│   ├── core/config.py               # Đường dẫn model và ngưỡng nhận dạng.
│   └── services/digit_pipeline.py   # Tìm vùng số và ghép chữ số từ kết quả YOLO.
└── models/
    ├── digit_detection.pt           # Model tìm vùng hiển thị số.
    └── number_detection.pt          # Model nhận dạng các chữ số.
```

Source và hai model được sao chép từ repository OCR riêng để có thể clone một repository và chạy đủ ba thành phần. Bộ ảnh mẫu `test/` của repository OCR gốc không được đưa lên; khi thử `run.py`, truyền đường dẫn ảnh do người dùng chọn. Bản clone cũ cùng thư mục `.git` trong `OCR/` không được thay đổi.

## 5. Luồng cần biết khi sửa tính năng

```text
Trình duyệt
  → phong-tro-frontend/index.html → src/main.js → core/router.js → modules/*.tab.js
  → core/api.js → phong-tro-backend/src/app.js → routes → controllers → services
                                                          ├→ models/schema.js + models/index.js → MySQL
                                                          └→ HTTP tới phong-tro-ocr/app/main.py → POST /ocr
```

- **Thêm/sửa API:** cập nhật route, controller/service, validation và test liên quan; đối chiếu `docs/AUTHZ_MATRIX.md` khi thay route hoặc quyền sở hữu.
- **Thêm/sửa DB:** bắt đầu từ `data2.md` và quy trình migration/test trong `AGENTS.md`; không chạy migration, seed hoặc sync lên DB phát triển/thật nếu chưa có quy trình sao lưu và xác nhận riêng.
- **Thêm/sửa giao diện:** sửa module tương ứng trong `src/modules/`, dùng `src/core/api.js` để gọi API và CSS trong `src/shared/styles/`; kiểm tra quyền Chủ trọ/Khách thuê.
- **OCR:** xem `docs/OCR_SETUP.md`, `meterReading.service.js` và `phong-tro-ocr/`; dịch vụ Python chạy riêng, không phải module JavaScript trong frontend.

Các lệnh chạy, biến môi trường và phạm vi test được cập nhật chi tiết trong `README.md` gốc và README của từng ứng dụng. Tài liệu này chỉ mô tả cấu trúc, không xác nhận build hoặc test mới trong lần cập nhật tài liệu.
