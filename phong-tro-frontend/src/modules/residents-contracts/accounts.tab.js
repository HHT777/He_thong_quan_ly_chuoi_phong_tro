import { listTab } from "../../shared/components/tab-factory.js";
export default listTab({ id: "tenant-accounts", route: "/residents-contracts/accounts", title: "Tài khoản khách thuê", tabLabel: "Tài khoản", group: "residents-contracts", order: 30.5, roles: ["CHU_TRO"] }, {
  title: "Tài khoản khách thuê",
  description: "Cấp tài khoản khi đủ hợp đồng/cọc, khóa hoặc mở khóa và đặt lại mật khẩu mặc định.",
  endpoint: "/management/khach-thue",
  columns: [
    { label: "Họ tên", key: "ho_ten" },
    { label: "Điện thoại", key: "so_dien_thoai" },
    { label: "Tên đăng nhập", format: (row) => row.taiKhoan?.ten_dang_nhap || "—" },
    { label: "Trạng thái", format: (row) => row.taiKhoan?.trang_thai || "CHUA_CAP" },
  ],
  rowActions: [
    {
      id: "create",
      label: "Tạo tài khoản",
      visible: (row) => !row.ma_tai_khoan,
      confirm: (row) => `Cấp tài khoản dùng số điện thoại ${row.so_dien_thoai}?`,
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
