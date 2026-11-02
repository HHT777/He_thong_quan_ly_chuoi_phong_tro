import { listTab } from "../../shared/components/tab-factory.js";
export default listTab({ id: "buildings", route: "/properties/buildings", title: "Căn trọ", tabLabel: "Căn trọ", group: "properties", order: 20, roles: ["CHU_TRO"] }, {
  title: "Căn trọ",
  description: "",
  endpoint: "/management/can-tro",
  columns: [{ label: "Tên căn", key: "ten_can" }, { label: "Địa chỉ", key: "dia_chi" }, { label: "Trạng thái", key: "trang_thai" }, { label: "Số phòng", format: (row) => row.phongs?.length || 0 }],
  create: { label: "Thêm căn trọ", fields: [{ name: "ten_can", label: "Tên căn", required: true }, { name: "dia_chi", label: "Địa chỉ", required: true }, { name: "mo_ta", label: "Mô tả" }] },
  rowActions: [
    {
      id: "edit",
      label: "Sửa",
      fields: [
        { name: "ten_can", label: "Tên căn", required: true },
        { name: "dia_chi", label: "Địa chỉ", required: true },
        { name: "mo_ta", label: "Mô tả" },
        { name: "quy_dinh_chung", label: "Quy định chung" },
      ],
      initial: (row) => row,
      run: (context, row, values) => context.api.put(`/management/can-tro/${row.ma_can}`, values),
    },
    {
      id: "toggle-status",
      label: "Đổi trạng thái",
      confirm: (row) => row.trang_thai === "HOAT_DONG" ? "Ngừng hoạt động căn trọ này?" : "Đưa căn trọ hoạt động trở lại?",
      run: (context, row) => context.api.put(`/management/can-tro/${row.ma_can}`, { trang_thai: row.trang_thai === "HOAT_DONG" ? "NGUNG_HOAT_DONG" : "HOAT_DONG" }),
    },
  ],
});
