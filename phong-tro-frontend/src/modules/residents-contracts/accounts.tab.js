import { listTab } from "../../shared/components/tab-factory.js";
import { openFormModal } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import { loadBuildingScope } from "./building-scope.js";
import "./accounts.css";
import "./residents.css";
export default listTab({ id: "tenant-accounts", route: "/residents-contracts/accounts", title: "Tài khoản khách thuê", tabLabel: "Tài khoản", group: "residents-contracts", order: 30.5, roles: ["CHU_TRO"] }, {
  title: "Tài khoản khách thuê",
  description: "",
  endpoint: "/management/khach-thue",
  buildingScope: loadBuildingScope,
  buildingScopeInToolbar: true,
  buildingMatch: (row, scope) => scope.matchesResident(row),
  actionMenu: true,
  toolbarActions: [{
    id: "create-account",
    label: "Tạo tài khoản",
    className: "btn--primary",
    run: async (context, refresh) => {
      try {
        const response = await context.api.get("/management/khach-thue");
        const eligibleTenants = (response.data || []).filter((tenant) =>
          !tenant.ma_tai_khoan
          && !tenant.taiKhoan
          && (tenant.hopDongs || []).some((contract) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai))
        );
        if (!eligibleTenants.length) {
          showToast("Chưa có khách thuê đủ điều kiện cấp tài khoản.", "info");
          return;
        }

        openFormModal({
          title: "Tạo tài khoản khách thuê",
          fields: [{
            name: "tenantId",
            label: "Khách thuê",
            type: "select",
            required: true,
            options: eligibleTenants.map((tenant) => {
              const contract = (tenant.hopDongs || []).find((item) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(item.trang_thai));
              const room = contract?.phongTro?.so_phong;
              const building = contract?.phongTro?.canTro?.ten_can;
              return {
                value: tenant.ma_khach_thue,
                label: [tenant.ho_ten, [building, room && `Phòng ${room}`].filter(Boolean).join(" · "), tenant.so_dien_thoai].filter(Boolean).join(" — "),
              };
            }),
          }],
          submitLabel: "Tạo tài khoản",
          submit: async ({ tenantId }) => {
            await context.api.post("/v1/accounts", { tenantId });
            await refresh();
          },
        });
      } catch (error) {
        showToast(error.message || "Không tải được danh sách khách thuê.", "error");
      }
    },
  }],
  columns: [
    { label: "Họ tên", key: "ho_ten", className: "tenant-account-name" },
    { label: "Điện thoại", key: "so_dien_thoai", className: "tenant-account-phone" },
    { label: "Căn", className: "tenant-account-building", format: (row) => {
      const contract = (row.hopDongs || []).find((item) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(item.trang_thai)) || (row.hopDongs || [])[0];
      return contract?.phongTro?.canTro?.ten_can || "—";
    } },
    { label: "Phòng", className: "tenant-account-room", format: (row) => {
      const contract = (row.hopDongs || []).find((item) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(item.trang_thai)) || (row.hopDongs || [])[0];
      return contract?.phongTro?.so_phong || "—";
    } },
    { label: "Hợp đồng", className: "tenant-account-contract", format: (row) => {
      const contract = (row.hopDongs || []).find((item) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(item.trang_thai));
      return contract ? contract.trang_thai === "SAP_HET_HAN" ? "Sắp hết hạn" : "Đang hiệu lực" : "Không có hợp đồng hiệu lực";
    } },
    { label: "Tên đăng nhập", className: "tenant-account-username", format: (row) => row.taiKhoan?.ten_dang_nhap || "—" },
    { label: "Trạng thái", className: "tenant-account-status", format: (row) => row.taiKhoan?.trang_thai || "CHUA_CAP" },
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
