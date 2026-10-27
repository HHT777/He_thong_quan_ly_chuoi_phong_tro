import { listTab } from "../../shared/components/tab-factory.js";
import { date, escapeHtml, money } from "../../shared/components/view.js";
import { buildCompletionPayload, buildCreateIncidentPayload, loadIncidentFormData, mountIncidentSelectors, showTenantResponsibility, tenantSelectionForResponsibility } from "./incident-form.mjs";
import "./incidents-form.css";

async function setupSelectors({ context, form, overlay, incidentRoomId = "", responsible = () => false }) {
  const status = document.createElement("p");
  status.className = "incident-form-status";
  status.setAttribute("role", "status");
  form.prepend(status);
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  const load = async () => {
    status.textContent = "Đang tải căn, phòng và người thuê…";
    status.classList.remove("is-error");
    try {
      const data = await loadIncidentFormData(context.api);
      status.remove();
      const typeInput = form.querySelector('[name="type"]');
      const typeField = typeInput?.closest(".modal-field");
      if (typeField && data.categories.length) {
        typeField.innerHTML = `<span>Loại sự cố</span><select class="form-control" name="type" required>${data.categories.map((category) => `<option value="${escapeHtml(category.ma)}">${escapeHtml(category.ten)}</option>`).join("")}</select>`;
      }
      const selectors = mountIncidentSelectors({
        form, data, incidentRoomId, tenantFieldName: overlay.querySelector('[name="responsibleTenantId"]') ? "responsibleTenantId" : "tenantId",
        responsibleTenant: Boolean(overlay.querySelector('[name="responsibleTenantId"]')),
        isTenantRequired: responsible,
      });
      if (incidentRoomId) {
        for (const name of ["buildingId", "roomId"]) {
          const input = form.querySelector(`[data-selector="${name}"] [role="combobox"]`);
          input.disabled = true;
          input.setAttribute("aria-readonly", "true");
        }
      }
      submit.disabled = false;
      return selectors;
    } catch {
      status.classList.add("is-error");
      status.textContent = "Không tải được danh sách. Kiểm tra kết nối rồi thử lại.";
      const retry = document.createElement("button");
      retry.type = "button"; retry.className = "btn btn--secondary"; retry.textContent = "Thử lại";
      retry.addEventListener("click", async () => { retry.disabled = true; await load(); });
      status.append(" ", retry);
      return null;
    }
  };
  return load();
}

export default listTab({ id: "incidents", route: "/operations/incidents", title: "Sự cố", tabLabel: "Sự cố", group: "incidents", order: 51, roles: ["CHU_TRO"] }, {
  title: "Sự cố",
  description: "Tiếp nhận, hoàn tất xử lý và ghi nhận đúng nhánh tài chính của sự cố. Chỉ xóa được báo cáo chưa tiếp nhận.",
  endpoint: "/v1/incidents",
  create: {
    label: "Tạo sự cố",
    fields: [
      { name: "buildingId", label: "Căn", required: true },
      { name: "roomId", label: "Phòng", required: true },
      { name: "tenantId", label: "Khách đang ở" },
      { name: "type", label: "Loại sự cố", required: true },
      { name: "priority", label: "Mức độ ưu tiên", required: true, value: "TRUNG_BINH", options: [
        { value: "TRUNG_BINH", label: "Trung bình" }, { value: "THAP", label: "Thấp" },
        { value: "CAO", label: "Cao" }, { value: "KHAN_CAP", label: "Khẩn cấp" },
      ] },
      { name: "description", label: "Mô tả", type: "textarea", required: true },
    ],
    map: buildCreateIncidentPayload,
    onOpen: ({ context, form, overlay }) => setupSelectors({ context, form, overlay }),
  },
  beforeLoad: async (api) => {
    try {
      const rooms = [];
      for (let page = 1; ; page += 1) {
        const response = await api.get(`/phong?limit=100&page=${page}`);
        rooms.push(...(Array.isArray(response.data) ? response.data : []));
        if (!response.pagination?.hasNext) break;
      }
      return new Map(rooms.map((room) => [room.ma_phong, room]));
    } catch {
      return new Map();
    }
  },
  transform: (rows, _buildingScope, roomsById) => (Array.isArray(rows) ? rows : []).map((row) => {
    const room = roomsById?.get(row.ma_phong);
    return room ? { ...row, phongTro: { ...room, canTro: room.canTro || null } } : row;
  }),
  statusOptions: [
    { value: "CHO_TIEP_NHAN", label: "Chờ tiếp nhận" },
    { value: "DANG_XU_LY", label: "Đang xử lý" },
    { value: "DA_XU_LY", label: "Đã xử lý" },
  ],
  columns: [{ label: "Phòng", format: (row) => row.phongTro?.so_phong ? `Phòng ${row.phongTro.so_phong}` : "Không rõ phòng" }, { label: "Căn", format: (row) => row.phongTro?.canTro?.ten_can || "—" }, { label: "Nội dung", key: "mo_ta" }, { label: "Ưu tiên", key: "muc_do_uu_tien" }, { label: "Trạng thái", key: "trang_thai" }, { label: "Chi phí", format: (row) => money(row.chi_phi_sua_chua) }, { label: "Ngày gửi", format: (row) => date(row.ngay_gui) }],
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
        { name: "buildingId", label: "Căn", required: true },
        { name: "roomId", label: "Phòng", required: true },
        { name: "responsible", label: "Đối tượng chịu phí", required: true, options: [{ value: "CHU_TRO", label: "Chủ trọ" }, { value: "KHACH_THUE", label: "Khách thuê" }] },
        { name: "cost", label: "Chi phí sửa chữa", type: "number", required: true },
        { name: "note", label: "Kết quả xử lý", type: "textarea", required: true },
        { name: "replacement", label: "Thiết bị thay thế" },
        { name: "responsibleTenantId", label: "Khách chịu phí" },
        { name: "responsibilityBasis", label: "Căn cứ trách nhiệm (nếu có)", type: "textarea" },
      ],
      onOpen: async ({ context, row, form, overlay }) => {
        const selectors = await setupSelectors({ context, form, overlay, incidentRoomId: row.ma_phong, responsible: () => showTenantResponsibility(form.querySelector('[name="responsible"]')?.value) });
        const responsible = form.querySelector('[name="responsible"]');
        const tenant = form.querySelector('[data-selector="responsibleTenantId"]');
        const basis = form.querySelector('[name="responsibilityBasis"]')?.closest(".modal-field");
        const help = document.createElement("p");
        help.className = "incident-form-hint";
        help.textContent = "Khoản khách chịu sẽ được trừ vào tiền cọc khi trả phòng.";
        basis?.after(help);
        const update = () => {
          const tenantMode = showTenantResponsibility(responsible.value);
          if (tenant) tenant.hidden = !tenantMode;
          if (basis) basis.hidden = !tenantMode;
          const basisInput = basis?.querySelector('[name="responsibilityBasis"]');
          if (basisInput) basisInput.required = tenantMode;
          help.hidden = !tenantMode;
          if (selectors) {
            const selected = tenantSelectionForResponsibility(responsible.value, selectors.state.tenantId, selectors.state.roomId ? selectors.defaultRoomTenantId : "");
            if (selected) selectors.selectTenant(selected);
            else selectors.clearTenant();
          }
        };
        responsible.addEventListener("change", update);
        update();
      },
      map: buildCompletionPayload,
      run: (context, row, values) => context.api.patch(`/v1/incidents/${row.ma_su_co}`, values),
    },
    {
      id: "delete",
      label: "Xóa",
      title: "Xóa báo cáo sự cố",
      submitLabel: "Xóa sự cố",
      successMessage: "Đã xóa báo cáo sự cố.",
      className: "btn--danger",
      visible: (row) => row.trang_thai === "CHO_TIEP_NHAN",
      fields: [{ name: "reason", label: "Lý do xóa", type: "textarea", required: true }],
      map: (raw) => ({ reason: raw.reason.trim() }),
      run: (context, row, values) => context.api.request(`/v1/incidents/${row.ma_su_co}`, { method: "DELETE", body: JSON.stringify(values) }),
    },
  ],
});
