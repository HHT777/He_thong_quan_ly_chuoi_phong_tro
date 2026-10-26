import { listTab } from "../../shared/components/tab-factory.js";
import { date, money } from "../../shared/components/view.js";
export default listTab({ id: "incidents", route: "/operations/incidents", title: "Sự cố", tabLabel: "Sự cố", group: "incidents", order: 51, roles: ["CHU_TRO"] }, {
  title: "Sự cố",
  description: "Tiếp nhận, hoàn tất xử lý và ghi nhận đúng nhánh tài chính của sự cố.",
  endpoint: "/v1/incidents",
  statusOptions: [
    { value: "CHO_TIEP_NHAN", label: "Chờ tiếp nhận" },
    { value: "DANG_XU_LY", label: "Đang xử lý" },
    { value: "DA_XU_LY", label: "Đã xử lý" },
  ],
  create: {
    label: "Tạo sự cố",
    fields: [
      { name: "roomId", label: "Mã phòng", required: true },
      { name: "type", label: "Loại sự cố", required: true },
      { name: "priority", label: "Mức độ ưu tiên", required: true, options: [
        { value: "TRUNG_BINH", label: "Trung bình" }, { value: "THAP", label: "Thấp" },
        { value: "CAO", label: "Cao" }, { value: "KHAN_CAP", label: "Khẩn cấp" },
      ] },
      { name: "description", label: "Mô tả", type: "textarea", required: true },
      { name: "previousIncidentId", label: "Sự cố trước (mã, nếu có)" },
    ],
    map: (raw) => ({ ...raw, previousIncidentId: raw.previousIncidentId || undefined }),
  },
  columns: [{ label: "Phòng", format: (row) => row.phongTro?.so_phong || row.ma_phong }, { label: "Nội dung", key: "mo_ta" }, { label: "Ưu tiên", key: "muc_do_uu_tien" }, { label: "Trạng thái", key: "trang_thai" }, { label: "Chi phí", format: (row) => money(row.chi_phi_sua_chua) }, { label: "Ngày gửi", format: (row) => date(row.ngay_gui) }],
  rowActions: [
    {
      id: "accept",
      label: "Tiếp nhận",
      visible: (row) => row.trang_thai === "CHO_TIEP_NHAN",
      run: (context, row) => context.api.patch(`/v1/incidents/${row.ma_su_co}`, { status: "DANG_XU_LY" }),
    },
    {
      id: "complete",
      label: "Hoàn tất",
      visible: (row) => row.trang_thai === "DANG_XU_LY",
      fields: [
        { name: "responsible", label: "Đối tượng chịu phí", required: true, options: [{ value: "CHU_TRO", label: "Chủ trọ" }, { value: "KHACH_THUE", label: "Khách thuê" }] },
        { name: "cost", label: "Chi phí sửa chữa", type: "number", required: true },
        { name: "note", label: "Kết quả xử lý", type: "textarea", required: true },
        { name: "replacement", label: "Thiết bị thay thế" },
        { name: "responsibleTenantId", label: "Mã khách chịu phí (nếu có)" },
        { name: "responsibilityBasis", label: "Căn cứ trách nhiệm (nếu có)", type: "textarea" },
      ],
      map: (raw) => ({ ...raw, status: "DA_XU_LY", cost: Number(raw.cost), responsibleTenantId: raw.responsibleTenantId || undefined, responsibilityBasis: raw.responsibilityBasis || undefined }),
      run: (context, row, values) => context.api.patch(`/v1/incidents/${row.ma_su_co}`, values),
    },
  ],
});
