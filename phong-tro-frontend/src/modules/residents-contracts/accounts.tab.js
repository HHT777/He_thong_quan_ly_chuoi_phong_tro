import { listTab } from "../../shared/components/tab-factory.js";
import { loadBuildingScope } from "./building-scope.js";
export default listTab({ id: "tenant-accounts", route: "/residents-contracts/accounts", title: "Tài khoản khách thuê", tabLabel: "Tài khoản", group: "residents-contracts", order: 30.5, roles: ["CHU_TRO"] }, {
  title: "Tài khoản khách thuê",
  description: "Cấp tài khoản khi đủ hợp đồng/cọc, khóa hoặc mở khóa và đặt lại mật khẩu mặc định.",
  endpoint: "/management/khach-thue",
  buildingScope: loadBuildingScope,
  buildingMatch: (row, scope) => scope.matchesResident(row),
  columns: [
    { label: "Họ tên", key: "ho_ten" },
    { label: "Điện thoại", key: "so_dien_thoai" },
    { label: "Căn", format: (row) => {
      const contract = (row.hopDongs || []).find((item) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(item.trang_thai)) || (row.hopDongs || [])[0];
      return contract?.phongTro?.canTro?.ten_can || "—";
    } },
    { label: "Phòng", format: (row) => {
      const contract = (row.hopDongs || []).find((item) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(item.trang_thai)) || (row.hopDongs || [])[0];
      return contract?.phongTro?.so_phong || "—";
    } },
    { label: "Hợp đồng", format: (row) => {
      const contract = (row.hopDongs || []).find((item) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(item.trang_thai));
      return contract ? contract.trang_thai === "SAP_HET_HAN" ? "Sắp hết hạn" : "Đang hiệu lực" : "Không có hợp đồng hiệu lực";
    } },
    { label: "Tên đăng nhập", format: (row) => row.taiKhoan?.ten_dang_nhap || "—" },
    { label: "Trạng thái", format: (row) => row.taiKhoan?.trang_thai || "CHUA_CAP" },
  ],
  rowActions: [
    {
      id: "create",
      label: "Tạo tài khoản",
      visible: (row) => !row.ma_tai_khoan && (row.hopDongs || []).some((contract) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai)),
      confirm: (row) => `Tạo tài khoản cho ${row.ho_ten}, dùng số điện thoại ${row.so_dien_thoai} làm tên đăng nhập? Chỉ tạo được khi hợp đồng còn hiệu lực và đã nhận cọc.`,
      run: (context, row) => context.api.post("/v1/accounts", { tenantId: row.ma_khach_thue }),
    },
    {
      id: "lock",
      label: "Khóa",
      visible: (row) => row.taiKhoan?.trang_thai === "HOAT_DONG",
      confirm: (row) => `Khóa tài khoản ${row.taiKhoan.ten_dang_nhap}?`,
      run: (context, row) => context.api.patch(`/v1/accounts/${row.ma_tai_khoan}/status`, { status: "DA_KHOA" }),
    },
    {
      id: "unlock",
      label: "Mở khóa",
      visible: (row) => row.taiKhoan?.trang_thai === "DA_KHOA",
      run: (context, row) => context.api.patch(`/v1/accounts/${row.ma_tai_khoan}/status`, { status: "HOAT_DONG" }),
    },
    {
      id: "reset",
      label: "Reset mật khẩu",
      visible: (row) => Boolean(row.ma_tai_khoan),
      confirm: () => "Đặt lại mật khẩu về giá trị mặc định?",
      run: (context, row) => context.api.post("/v1/accounts/reset-password", { tenantId: row.ma_khach_thue }),
    },
  ],
});
