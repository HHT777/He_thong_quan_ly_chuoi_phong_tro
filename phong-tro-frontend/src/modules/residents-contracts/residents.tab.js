import { listTab } from "../../shared/components/tab-factory.js";
import { loadBuildingScope } from "./building-scope.js";
export default listTab({ id: "residents", route: "/residents-contracts/residents", title: "Cư dân", tabLabel: "Cư dân", group: "residents-contracts", order: 30, roles: ["CHU_TRO"] }, {
  title: "Cư dân",
  description: "Hồ sơ khách thuê và lịch sử hợp đồng.",
  endpoint: "/management/khach-thue",
  buildingScope: loadBuildingScope,
  buildingMatch: (row, scope) => scope.matchesResident(row),
  columns: [{ label: "Họ tên", key: "ho_ten" }, { label: "Điện thoại", key: "so_dien_thoai" }, { label: "Giấy tờ", key: "cccd_giay_to" }, { label: "Hợp đồng", format: (row) => row.hopDongs?.length || 0 }],
  create: { label: "Thêm cư dân", fields: [{ name: "ho_ten", label: "Họ tên", required: true }, { name: "so_dien_thoai", label: "Số điện thoại", required: true }, { name: "cccd_giay_to", label: "CCCD/Giấy tờ", required: true }] },
  rowActions: [
    {
      id: "edit",
      label: "Sửa hồ sơ",
      fields: [
        { name: "ho_ten", label: "Họ tên", required: true },
        { name: "so_dien_thoai", label: "Số điện thoại", required: true },
        { name: "cccd_giay_to", label: "CCCD/Giấy tờ", required: true },
      ],
      initial: (row) => row,
      run: (context, row, values) => context.api.put(`/management/khach-thue/${row.ma_khach_thue}`, values),
    },
    {
      id: "delete",
      label: "Xóa",
      visible: (row) => !row.hopDongs?.length && !row.ma_tai_khoan,
      confirm: (row) => `Xóa hồ sơ ${row.ho_ten}?`,
      run: (context, row) => context.api.del(`/management/khach-thue/${row.ma_khach_thue}`),
    },
  ],
});
