import { listTab } from "../../shared/components/tab-factory.js";
import { date } from "../../shared/components/view.js";
export default listTab({ id: "move-outs", route: "/operations/move-outs", title: "Trả phòng & thanh lý", tabLabel: "Trả phòng", group: "operations", order: 52, roles: ["CHU_TRO"] }, {
  title: "Trả phòng & thanh lý",
  description: "Kiểm tra điện, tài sản, công nợ và cọc trước khi thanh lý nguyên khối.",
  endpoint: "/v1/move-outs",
  columns: [
    { label: "Hợp đồng", key: "ma_hop_dong" },
    { label: "Nội dung", key: "noi_dung" },
    { label: "Ngày gửi", format: (row) => date(row.ngay_gui) },
    { label: "Trạng thái", key: "trang_thai" },
  ],
  rowActions: [{
    id: "settle",
    label: "Quyết toán",
    visible: (row) => row.trang_thai === "DA_PHE_DUYET" && Boolean(row.ma_hop_dong),
    fields: [
      { name: "inspectionDate", label: "Ngày kiểm tra", type: "date", required: true },
      { name: "finalElectricityReading", label: "Chỉ số điện cuối", type: "number", required: true },
      { name: "roomCondition", label: "Tình trạng phòng", type: "textarea", required: true },
      { name: "assetsChecked", label: "Đã kiểm tra tài sản", required: true, options: [{ value: "true", label: "Đã kiểm tra" }, { value: "false", label: "Chưa kiểm tra" }] },
      { name: "debtReviewed", label: "Đã đối chiếu công nợ", required: true, options: [{ value: "true", label: "Đã đối chiếu" }, { value: "false", label: "Chưa đối chiếu" }] },
      { name: "deduction", label: "Tổng khấu trừ", type: "number", required: true },
      { name: "deductionType", label: "Loại khấu trừ khác", options: [{ value: "KHAC", label: "Khác" }, { value: "HU_HONG_TAI_SAN", label: "Hư hỏng tài sản" }, { value: "VI_PHAM_HOP_DONG", label: "Vi phạm hợp đồng" }] },
      { name: "reason", label: "Ghi chú/lý do", type: "textarea" },
    ],
    map: (raw, row) => ({
      ...raw,
      assetsChecked: raw.assetsChecked === "true",
      debtReviewed: raw.debtReviewed === "true",
      deduction: Number(raw.deduction),
      finalElectricityReading: Number(raw.finalElectricityReading),
      moveOutRequestId: row.ma_yeu_cau,
    }),
    run: (context, row, values) => context.api.post(`/v1/move-outs/${row.ma_hop_dong}/settle`, values),
  }],
});
