import { listTab } from "../../shared/components/tab-factory.js";
import { loadBuildingScope } from "./building-scope.js";
import { openCoTenantsBox } from "./co-tenants.tab.js";
import { escapeHtml } from "../../shared/components/view.js";
import "./residents.css";

const ACTIVE_CONTRACTS = new Set(["DANG_HIEU_LUC", "SAP_HET_HAN"]);

function residentRoster(tenants = [], scope = {}) {
  const rows = [];
  for (const tenant of tenants) {
    const activeContracts = (tenant.hopDongs || []).filter((contract) => ACTIVE_CONTRACTS.has(contract.trang_thai));
    if (!activeContracts.length) {
      rows.push({ ...tenant, vai_tro_cu_tru: "Chưa gắn hợp đồng hiệu lực", ma_phong: null, ten_can: "—", so_phong: "—" });
      continue;
    }

    for (const contract of activeContracts) {
      const linkedContract = scope.contractById?.get(String(contract.ma_hop_dong)) || contract;
      const room = scope.roomById?.get(String(linkedContract.ma_phong || contract.ma_phong)) || contract.phongTro || {};
      const building = scope.buildingById?.get(String(room.ma_can)) || room.canTro;
      const buildingName = building?.name || building?.ten_can || contract.phongTro?.canTro?.ten_can || "—";
      const roomName = room.so_phong || contract.phongTro?.so_phong || "—";
      const base = {
        ma_khach_thue: tenant.ma_khach_thue,
        ma_tai_khoan: tenant.ma_tai_khoan,
        ma_phong: room.ma_phong || contract.ma_phong,
        ten_can: buildingName,
        so_phong: roomName,
      };
      rows.push({ ...base, ...tenant, ma_phong: base.ma_phong, ten_can: base.ten_can, so_phong: base.so_phong, hopDongs: [contract], vai_tro_cu_tru: "Người đứng tên hợp đồng", isCoTenant: false });
      for (const member of contract.thanhVienPhongs || linkedContract.thanhVienPhongs || []) {
        if (member.trang_thai_cu_tru !== "DANG_O") continue;
        rows.push({
          ...member,
          ma_khach_thue: null,
          ma_tai_khoan: null,
          ma_phong: base.ma_phong,
          ten_can: base.ten_can,
          so_phong: base.so_phong,
          hopDongs: [contract],
          vai_tro_cu_tru: "Người ở cùng",
          isCoTenant: true,
        });
      }
    }
  }
  return rows;
}

function openResidentDetails(row) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<section class="modal-dialog resident-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="resident-detail-title">
    <header class="modal-header"><h2 class="modal-title" id="resident-detail-title">Chi tiết cư dân</h2><button type="button" class="modal-close-btn" aria-label="Đóng">×</button></header>
    <div class="modal-body"><dl class="resident-detail-grid">
      <div><dt>Họ tên</dt><dd>${escapeHtml(row.ho_ten || "—")}</dd></div>
      <div><dt>Điện thoại</dt><dd>${escapeHtml(row.so_dien_thoai || "—")}</dd></div>
      <div><dt>Giấy tờ</dt><dd>${escapeHtml(row.cccd_giay_to || "—")}</dd></div>
      <div><dt>Vai trò</dt><dd>${escapeHtml(row.vai_tro_cu_tru || "—")}</dd></div>
      <div><dt>Căn</dt><dd>${escapeHtml(row.ten_can || "—")}</dd></div>
      <div><dt>Phòng</dt><dd>${escapeHtml(row.so_phong || "—")}</dd></div>
    </dl></div>
  </section>`;
  const onEscape = (event) => { if (event.key === "Escape") close(); };
  const close = () => {
    document.removeEventListener("keydown", onEscape);
    overlay.remove();
  };
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest(".modal-close-btn")) close();
  });
  document.addEventListener("keydown", onEscape);
  document.body.appendChild(overlay);
}

export default listTab({ id: "residents", route: "/residents-contracts/residents", title: "Cư dân", tabLabel: "Cư dân", group: "residents-contracts", order: 30, roles: ["CHU_TRO"] }, {
  title: "Cư dân",
  description: "Danh sách người đứng tên hợp đồng và người ở cùng trong các phòng đang thuê.",
  endpoint: "/management/khach-thue",
  transform: residentRoster,
  buildingScope: loadBuildingScope,
  buildingScopeOptions: { contracts: true, roomFilter: true },
  toolbarActions: [{ id: "co-tenants", label: "Người ở cùng", run: (context, refresh) => openCoTenantsBox(context, refresh) }],
  buildingMatch: (row, scope) => row.ma_phong ? scope.matchesRoom(row.ma_phong) : scope.matchesResident(row),
  actionMenu: true,
  openDetail: (_context, row) => openResidentDetails(row),
  columns: [
    { label: "Họ tên", key: "ho_ten" },
    { label: "Điện thoại", key: "so_dien_thoai" },
    { label: "Giấy tờ", key: "cccd_giay_to" },
    { label: "Vai trò", key: "vai_tro_cu_tru" },
    { label: "Căn", key: "ten_can" },
    { label: "Phòng", key: "so_phong" },
  ],
  create: { label: "Thêm cư dân", fields: [{ name: "ho_ten", label: "Họ tên", required: true }, { name: "so_dien_thoai", label: "Số điện thoại", required: true }, { name: "cccd_giay_to", label: "CCCD/Giấy tờ", required: true }] },
  rowActions: [
    { id: "details", label: "Xem chi tiết", openDetail: true },
    {
      id: "create-account",
      label: "Tạo tài khoản",
      visible: (row) => !row.isCoTenant && Boolean(row.ma_khach_thue) && !row.ma_tai_khoan
        && (row.hopDongs || []).some((contract) => ACTIVE_CONTRACTS.has(contract.trang_thai)),
      confirm: (row) => `Tạo tài khoản cho ${row.ho_ten}, dùng số điện thoại ${row.so_dien_thoai} làm tên đăng nhập? Chỉ tạo được khi hợp đồng còn hiệu lực và đã nhận cọc.`,
      run: (context, row) => context.api.post("/v1/accounts", { tenantId: row.ma_khach_thue }),
    },
    {
      id: "edit",
      label: "Sửa hồ sơ",
      visible: (row) => !row.isCoTenant && Boolean(row.ma_khach_thue),
      fields: [
        { name: "ho_ten", label: "Họ tên", required: true },
        { name: "so_dien_thoai", label: "Số điện thoại", required: true },
        { name: "cccd_giay_to", label: "CCCD/Giấy tờ", required: true },
        { name: "_ten_can", label: "Căn hiện tại (theo hợp đồng)", readOnly: true },
        { name: "_so_phong", label: "Phòng hiện tại (theo hợp đồng)", readOnly: true },
      ],
      initial: (row) => ({ ...row, _ten_can: row.ten_can || "Chưa gắn hợp đồng", _so_phong: row.so_phong || "Chưa gắn hợp đồng" }),
      run: (context, row, values) => context.api.put(`/management/khach-thue/${row.ma_khach_thue}`, values),
    },
    {
      id: "delete",
      label: "Xóa",
      visible: (row) => !row.isCoTenant && !row.hopDongs?.length && !row.ma_tai_khoan,
      confirm: (row) => `Xóa hồ sơ ${row.ho_ten}?`,
      run: (context, row) => context.api.del(`/management/khach-thue/${row.ma_khach_thue}`),
    },
  ],
});
