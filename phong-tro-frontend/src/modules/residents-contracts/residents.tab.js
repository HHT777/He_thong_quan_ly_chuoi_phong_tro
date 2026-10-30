import { listTab } from "../../shared/components/tab-factory.js";
import { loadBuildingScope } from "./building-scope.js";
import { openCoTenantsBox } from "./co-tenants.tab.js";
import { escapeHtml } from "../../shared/components/view.js";
import { residentRoster } from "./resident-roster.js";
import "./residents.css";

const ACTIVE_CONTRACTS = new Set(["DANG_HIEU_LUC", "SAP_HET_HAN"]);

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

const residentsTab = listTab({ id: "residents", route: "/residents-contracts/residents", title: "Cư dân", tabLabel: "Cư dân", group: "residents-contracts", order: 30, roles: ["CHU_TRO"] }, {
  title: "Cư dân",
  description: "",
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
  create: {
    label: "Thêm người ở cùng", endpoint: "/v1/co-tenants",
    fields: (scope) => [
      { name: "roomId", label: "Căn · Phòng", options: [{ value: "", label: "Chọn phòng" }, ...scope.rooms.filter((room) => scope.matchesRoom(room.ma_phong)).map((room) => ({ value: room.ma_phong, label: `${room.canTro?.ten_can || "Căn trọ"} · ${room.so_phong}` }))], required: true },
      { name: "name", label: "Họ tên", required: true }, { name: "phone", label: "Số điện thoại", required: true },
      { name: "identityNumber", label: "CCCD/Giấy tờ", required: true }, { name: "birthDate", label: "Ngày sinh", type: "date", required: true },
      { name: "gender", label: "Giới tính", required: true }, { name: "permanentAddress", label: "Địa chỉ thường trú", required: true },
      { name: "relationship", label: "Quan hệ", required: true }, { name: "startDate", label: "Ngày bắt đầu ở", type: "date", required: true },
    ],
    onOpen: async ({ context, form }) => {
      const scope = await loadBuildingScope(context.api, { contracts: true });
      const room = form.elements.namedItem("roomId");
      const notice = document.createElement("p");
      notice.setAttribute("role", "status");
      form.insertBefore(notice, form.querySelector(".modal-footer"));
      const update = () => {
        const active = [...scope.contractById.values()].some((contract) => String(contract.ma_phong) === room.value && ACTIVE_CONTRACTS.has(contract.trang_thai));
        notice.replaceChildren();
        if (room.value && !active) {
          notice.append("Hãy lập hợp đồng trước. ");
          const link = document.createElement("button"); link.type = "button"; link.textContent = "Tạo hợp đồng";
          link.addEventListener("click", () => { window.location.hash = "#/residents-contracts/contracts"; });
          notice.append(link);
        }
        form.querySelector('button[type="submit"]').disabled = Boolean(room.value && !active);
      };
      room.addEventListener("change", update); update();
    },
    onCreated: () => { sessionStorage.removeItem("qlpt:residents-contracts-building"); sessionStorage.removeItem("qlpt:residents-contracts-room"); },
  },
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

export default {
  ...residentsTab,
  async render(context) {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const requestId = params.get("coTenantRequestId");
    if (requestId) window.history.replaceState(window.history.state, "", "#/residents-contracts/residents");

    await residentsTab.render(context);
    if (requestId) await openCoTenantsBox(context, () => residentsTab.render(context), { requestId });
  },
};
