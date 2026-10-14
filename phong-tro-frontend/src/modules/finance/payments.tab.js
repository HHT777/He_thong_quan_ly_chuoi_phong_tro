import { listTab } from "../../shared/components/tab-factory.js";
import { money, date } from "../../shared/components/view.js";
export default listTab({ id: "payments", route: "/finance/payments", title: "Thanh toán", tabLabel: "Thanh toán", group: "finance", order: 41, roles: ["CHU_TRO"] }, {
  title: "Thanh toán",
  description: "Ghi nhận khoản thu trực tiếp và xác nhận minh chứng đang chờ.",
  endpoint: "/khoan-phai-thu/payment/list?limit=100",
  columns: [{ label: "Mã giao dịch", key: "ma_giao_dich" }, { label: "Số tiền", format: (row) => money(row.so_tien) }, { label: "Thời điểm", format: (row) => date(row.thoi_diem_ghi_nhan) }, { label: "Trạng thái", key: "trang_thai_xac_nhan" }],
  create: {
    label: "Ghi nhận thanh toán",
    endpoint: "/khoan-phai-thu/payment/create",
    fields: [
      { name: "ma_khoan_phai_thu", label: "Mã kỳ phải trả", required: true },
      { name: "ngay_thanh_toan", label: "Ngày thanh toán", type: "date", required: true },
      { name: "so_tien", label: "Số tiền", type: "number", required: true },
      { name: "phuong_thuc", label: "Phương thức", required: true },
      { name: "minh_chung_url", label: "URL minh chứng" },
      { name: "ghi_chu", label: "Ghi chú" },
    ],
    map: (raw) => ({ ...raw, so_tien: Number(raw.so_tien), ghi_chu: raw.ghi_chu || undefined }),
    headers: () => ({ "Idempotency-Key": crypto.randomUUID() }),
  },
  rowActions: [{
    id: "confirm",
    label: "Xác nhận",
    visible: (row) => row.trang_thai_xac_nhan === "CHO_XAC_NHAN",
    confirm: () => "Xác nhận minh chứng và ghi nhận khoản thu?",
    run: (context, row) => context.api.post(`/khoan-phai-thu/payment/${row.ma_giao_dich}/confirm`, {}),
  }],
});
