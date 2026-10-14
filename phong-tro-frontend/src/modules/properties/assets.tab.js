import { listTab } from "../../shared/components/tab-factory.js";
export default listTab({ id: "assets", route: "/properties/assets", title: "Nội thất & tài sản", tabLabel: "Nội thất & tài sản", group: "properties", order: 22, roles: ["CHU_TRO"] }, {
  title: "Nội thất & tài sản",
  description: "Theo dõi và cập nhật tài sản gắn với từng phòng.",
  endpoint: "/v1/assets",
  columns: [{ label: "Tài sản", key: "ten_tai_san" }, { label: "Phòng", format: (row) => row.phongTro?.so_phong || row.ma_phong }, { label: "Số lượng", key: "so_luong" }, { label: "Tình trạng", key: "tinh_trang" }, { label: "Ghi chú", key: "ghi_chu" }],
  create: { label: "Thêm tài sản", fields: [{ name: "name", label: "Tên tài sản", required: true }, { name: "roomId", label: "Mã phòng", required: true }, { name: "quantity", label: "Số lượng", type: "number", required: true }, { name: "condition", label: "Tình trạng" }, { name: "note", label: "Ghi chú" }], map: (raw) => ({ ...raw, quantity: Number(raw.quantity) }) },
  rowActions: [
    {
      id: "edit",
      label: "Sửa",
      fields: [
        { name: "name", label: "Tên tài sản", required: true },
        { name: "quantity", label: "Số lượng", type: "number", required: true },
        { name: "condition", label: "Tình trạng" },
        { name: "note", label: "Ghi chú" },
      ],
      initial: (row) => ({ name: row.ten_tai_san, quantity: row.so_luong, condition: row.tinh_trang, note: row.ghi_chu }),
      map: (raw) => ({ ...raw, quantity: Number(raw.quantity) }),
      run: (context, row, values) => context.api.put(`/v1/assets/${row.ma_tai_san}`, values),
    },
    {
      id: "delete",
      label: "Xóa",
      confirm: (row) => `Xóa tài sản ${row.ten_tai_san}?`,
      run: (context, row) => context.api.del(`/v1/assets/${row.ma_tai_san}`),
    },
  ],
});
