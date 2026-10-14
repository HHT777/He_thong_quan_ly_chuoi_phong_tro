import { listTab } from "../../shared/components/tab-factory.js";
import { money } from "../../shared/components/view.js";

const numberFields = (raw) => ({ ...raw, dien_tich: Number(raw.dien_tich), gia_thue: Number(raw.gia_thue), so_nguoi_toi_da: Number(raw.so_nguoi_toi_da) });

export default listTab({ id: "rooms", route: "/properties/rooms", title: "Phòng", tabLabel: "Phòng", group: "properties", order: 21, roles: ["CHU_TRO"] }, {
  title: "Phòng",
  description: "Danh sách phòng, giá thuê, sức chứa và trạng thái sử dụng.",
  endpoint: "/phong?limit=100",
  columns: [{ label: "Số phòng", key: "so_phong" }, { label: "Căn trọ", format: (row) => row.canTro?.ten_can || "—" }, { label: "Giá thuê", format: (row) => money(row.gia_thue) }, { label: "Tối đa", key: "so_nguoi_toi_da" }, { label: "Trạng thái", key: "trang_thai" }],
  create: { label: "Thêm phòng", fields: [{ name: "so_phong", label: "Số phòng", required: true }, { name: "ma_can", label: "Mã căn trọ", required: true }, { name: "dien_tich", label: "Diện tích", type: "number", required: true }, { name: "gia_thue", label: "Giá thuê", type: "number", required: true }, { name: "so_nguoi_toi_da", label: "Số người tối đa", type: "number", required: true }], map: numberFields },
  rowActions: [
    {
      id: "edit",
      label: "Sửa",
      fields: [
        { name: "so_phong", label: "Số phòng", required: true },
        { name: "dien_tich", label: "Diện tích", type: "number", required: true },
        { name: "gia_thue", label: "Giá thuê", type: "number", required: true },
        { name: "so_nguoi_toi_da", label: "Số người tối đa", type: "number", required: true },
        { name: "noi_that_mo_ta", label: "Mô tả nội thất", type: "textarea" },
      ],
      initial: (row) => row,
      map: numberFields,
      run: (context, row, values) => context.api.put(`/phong/${row.ma_phong}`, values),
    },
    {
      id: "toggle-availability",
      label: "Đổi trạng thái",
      visible: (row) => ["TRONG", "NGUNG_SU_DUNG"].includes(row.trang_thai),
      confirm: (row) => row.trang_thai === "TRONG" ? "Ngừng sử dụng phòng này?" : "Đưa phòng về trạng thái trống?",
      run: (context, row) => context.api.put(`/phong/${row.ma_phong}`, { trang_thai: row.trang_thai === "TRONG" ? "NGUNG_SU_DUNG" : "TRONG" }),
    },
  ],
});
