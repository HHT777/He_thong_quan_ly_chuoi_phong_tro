import { escapeHtml } from "../../shared/components/view.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

export function normalizeSearch(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi").trim();
}

export function filterOptions(options, query) {
  const needle = normalizeSearch(query);
  return needle ? options.filter((option) => normalizeSearch(option.label).includes(needle)) : options;
}

export function formatEntityLabel(type, entity = {}) {
  const safe = (value) => {
    const text = String(value ?? "").trim();
    return !text || UUID_PATTERN.test(text) ? "" : text;
  };
  if (type === "building") return safe(entity.ten_can || entity.name) || "Không xác định";
  if (type === "room") {
    const room = safe(entity.so_phong || entity.roomName);
    const building = safe(entity.ten_can || entity.buildingName);
    return room ? `${building ? `${building} · ` : ""}Phòng ${room}` : "Không xác định";
  }
  if (type === "tenant") return safe(entity.ho_ten || entity.name) || "Không xác định";
  if (type === "contract") {
    const room = formatEntityLabel("room", entity);
    const tenant = formatEntityLabel("tenant", entity);
    const date = safe(entity.ngay_bat_dau || entity.startDate);
    const parts = [room, tenant].filter((value) => value !== "Không xác định");
    if (date) parts.push(`bắt đầu ${date}`);
    return parts.length ? `Hợp đồng — ${parts.join(" — ")}` : "Không xác định";
  }
  if (type === "incident") {
    const title = safe(entity.mo_ta || entity.description);
    const date = safe(entity.ngay_gui || entity.date);
    return title || date ? [title, date].filter(Boolean).join(" · ") : "Không xác định";
  }
  return "Không xác định";
}

export function activeContractsForTenant(contracts, tenantId) {
  return contracts.filter((contract) => String(contract.ma_khach_thue) === String(tenantId)
    && ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai));
}

export function contractsForOccupant({ contracts, members = [], tenants = [], tenantId }) {
  const tenant = tenants.find((item) => String(item.ma_khach_thue) === String(tenantId));
  return contracts.filter((contract) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai)
    && (String(contract.ma_khach_thue) === String(tenantId)
      || members.some((member) => String(member.ma_hop_dong) === String(contract.ma_hop_dong)
        && member.trang_thai_cu_tru === "DANG_O"
        && normalizePhone(member.so_dien_thoai) === normalizePhone(tenant?.so_dien_thoai)
        && normalizePhone(member.so_dien_thoai) !== "")));
}

export function occupantsForRoom({ contracts, members, tenants = [], roomId }) {
  const active = contracts.filter((contract) => String(contract.ma_phong) === String(roomId)
    && ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai));
  const occupants = new Map();
  for (const contract of active) {
    if (contract.ma_khach_thue && contract.khachThue?.ho_ten) {
      occupants.set(String(contract.ma_khach_thue), {
        id: String(contract.ma_khach_thue), name: contract.khachThue.ho_ten,
        phone: contract.khachThue.so_dien_thoai || "", role: "Người đứng tên",
      });
    }
    for (const member of members) {
      if (String(member.ma_hop_dong) !== String(contract.ma_hop_dong) || member.trang_thai_cu_tru !== "DANG_O") continue;
      const tenant = tenants.find((item) => normalizePhone(item.so_dien_thoai) === normalizePhone(member.so_dien_thoai) && normalizePhone(member.so_dien_thoai) !== "");
      const id = String(tenant?.ma_khach_thue || "");
      if (id) occupants.set(id, { id, name: member.ho_ten, phone: member.so_dien_thoai || "", role: "Người ở cùng" });
    }
  }
  return [...occupants.values()].filter((person) => person.name);
}

export function deriveFromTenant({ contracts, roomsById, tenantId, members = [], tenants = [] }) {
  const matches = contractsForOccupant({ contracts, members, tenants, tenantId }).filter((contract) => roomsById.has(String(contract.ma_phong)));
  return matches.length === 1 ? { buildingId: String(roomsById.get(String(matches[0].ma_phong)).ma_can), roomId: String(matches[0].ma_phong) }
    : matches.length > 1 ? { buildingId: "", roomId: "", choices: matches.map((contract) => String(contract.ma_phong)) }
      : { buildingId: "", roomId: "", choices: [] };
}

export function isValidIncidentSelection({ buildings, rooms, buildingId, roomId, tenantId, contracts, members, tenants, allowTenant = false }) {
  const room = rooms.find((item) => String(item.ma_phong) === String(roomId));
  if (!buildings.some((item) => String(item.id) === String(buildingId)) || !room || String(room.ma_can) !== String(buildingId)) return false;
  if (!allowTenant) return true;
  return occupantsForRoom({ contracts, members, tenants, roomId }).some((person) => person.id === String(tenantId));
}

export function buildCreateIncidentPayload(raw) {
  return {
    roomId: raw.roomId,
    type: String(raw.type || "").trim(),
    priority: raw.priority,
    ...(raw.responsible ? { responsible: raw.responsible } : {}),
    description: String(raw.description || "").trim(),
  };
}

export function buildCompletionPayload(raw) {
  return {
    status: "DA_XU_LY", responsible: raw.responsible, cost: Number(raw.cost), note: String(raw.note || "").trim(),
    replacement: String(raw.replacement || "").trim() || undefined,
    ...(raw.responsible === "KHACH_THUE" ? { responsibleTenantId: raw.responsibleTenantId, responsibilityBasis: String(raw.responsibilityBasis || "").trim() } : {}),
  };
}

export function showTenantResponsibility(responsible) {
  return responsible === "KHACH_THUE";
}

export function tenantSelectionForResponsibility(responsible, currentTenantId, defaultTenantId) {
  return showTenantResponsibility(responsible) ? (currentTenantId || defaultTenantId || "") : "";
}

const maskPhone = (phone) => phone ? `${"•".repeat(Math.max(0, String(phone).length - 4))}${String(phone).slice(-4)}` : "";
const roomIdOf = (room) => String(room.ma_phong);
const buildingIdOf = (room) => String(room.ma_can);

export async function loadAllPages(api, path) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const response = await api.get(`${path}${path.includes("?") ? "&" : "?"}limit=100&page=${page}`);
    rows.push(...(Array.isArray(response.data) ? response.data : []));
    if (!response.pagination?.hasNext) return rows;
  }
}

export async function loadIncidentFormData(api) {
  const paths = ["/phong", "/hop-dong", "/v1/co-tenants", "/v1/incident-categories", "/management/khach-thue"];
  const results = await Promise.allSettled([
    loadAllPages(api, paths[0]),
    loadAllPages(api, paths[1]),
    api.get(paths[2]),
    api.get(paths[3]),
    loadAllPages(api, paths[4]),
  ]);
  const roomsResult = results[0];
  if (roomsResult.status === "rejected") {
    const reason = roomsResult.reason?.message || "Lỗi kết nối";
    throw new Error(`Không tải được danh sách phòng (${reason}).`);
  }
  if (roomsResult.value.length === 0) {
    throw new Error("Chưa có phòng để tạo sự cố.");
  }
  const valueAt = (index, fallback) => results[index].status === "fulfilled" ? results[index].value : fallback;
  const warnings = results.flatMap((result, index) => result.status === "rejected"
    ? [`${paths[index]}: ${result.reason?.message || "không tải được"}`]
    : []);
  return {
    rooms: roomsResult.value,
    contracts: valueAt(1, []),
    members: valueAt(2, { data: [] }).data || [],
    categories: valueAt(3, { data: [] }).data || [],
    tenants: valueAt(4, []),
    warnings,
  };
}

function comboboxMarkup(field, label, hint = "Gõ để tìm") {
  return `<label class="modal-field incident-combobox-field" data-selector="${field}"><span>${label}</span><div class="incident-combobox">
    <input class="form-control" name="${field}Search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${field}-list" aria-describedby="${field}-hint ${field}-error" autocomplete="off" placeholder="${hint}">
    <input type="hidden" name="${field}" value="">
    <ul class="incident-combobox__list" id="${field}-list" role="listbox" hidden></ul>
  </div><small id="${field}-hint" class="incident-field-hint"></small><small id="${field}-error" class="incident-field-error" aria-live="polite"></small></label>`;
}

function replaceField(form, name, label, hint) {
  const input = form.querySelector(`[name="${name}"]`);
  const wrapper = input?.closest(".modal-field");
  if (!wrapper) return;
  wrapper.outerHTML = comboboxMarkup(name, label, hint);
}

export function mountIncidentSelectors({ form, data, incidentRoomId = "", responsibleTenant = false, tenantFieldName = "tenantId", isTenantRequired = () => responsibleTenant, onChange = () => {} }) {
  const rooms = data.rooms;
  const roomsById = new Map(rooms.map((room) => [roomIdOf(room), room]));
  const buildings = [...new Map(rooms.map((room) => [buildingIdOf(room), {
    id: buildingIdOf(room), name: room.canTro?.ten_can || "Không xác định",
  }])).values()];
  const state = { buildingId: "", roomId: "", tenantId: "" };
  const selectors = ["buildingId", "roomId", tenantFieldName];
  const fieldToState = (field) => field === tenantFieldName ? "tenantId" : field;
  for (const name of selectors) replaceField(form, name, name === "buildingId" ? "Căn" : name === "roomId" ? "Phòng" : responsibleTenant ? "Khách chịu phí" : "Khách đang ở", name === "roomId" ? "Chọn phòng" : name === tenantFieldName ? "Chọn phòng trước" : "Chọn căn");
  if (incidentRoomId) {
    const room = roomsById.get(String(incidentRoomId));
    if (room) { state.roomId = String(incidentRoomId); state.buildingId = buildingIdOf(room); }
  }
  const groups = new Map();
  for (const field of selectors) {
    const root = form.querySelector(`[data-selector="${field}"]`);
    const input = root.querySelector('[role="combobox"]');
    const hidden = root.querySelector(`input[type="hidden"][name="${field}"]`);
    const list = root.querySelector('[role="listbox"]');
    groups.set(field, { root, input, hidden, list, options: [], activeIndex: -1 });
  }
  const getRoomOptions = () => {
    let options = rooms.filter((room) => !state.buildingId || buildingIdOf(room) === state.buildingId);
    if (state.tenantChoices?.length) options = options.filter((room) => state.tenantChoices.includes(roomIdOf(room)));
    return options.map((room) => ({ id: roomIdOf(room), label: room.so_phong ? `Phòng ${room.so_phong}` : "Phòng chưa đặt tên", detail: "" }));
  };
  const getTenantOptions = () => {
    const occupants = state.roomId
      ? occupantsForRoom({ contracts: data.contracts, members: data.members, tenants: data.tenants, roomId: state.roomId })
      : [...new Map(data.contracts.filter((contract) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai))
        .flatMap((contract) => occupantsForRoom({ contracts: [contract], members: data.members, tenants: data.tenants, roomId: contract.ma_phong }))
        .map((person) => [person.id, person])).values()];
    return occupants.map((person) => ({ id: person.id, label: person.name, detail: `${person.role}${person.phone ? ` · ${maskPhone(person.phone)}` : ""}` }));
  };
  const optionsFor = (field) => field === "buildingId"
    ? buildings.filter((building) => !state.tenantChoices?.length || state.tenantChoices.some((roomId) => buildingIdOf(roomsById.get(roomId) || {}) === building.id))
      .map((building) => ({ id: building.id, label: building.name, detail: "" }))
    : field === "roomId" ? getRoomOptions() : getTenantOptions();

  const render = (field) => {
    const control = groups.get(field);
    const options = filterOptions(optionsFor(field), control.input.value);
    control.options = options;
    control.activeIndex = options.length ? 0 : -1;
    control.list.innerHTML = options.length ? options.map((option, index) => `<li role="option" id="${field}-option-${index}" aria-selected="${index === control.activeIndex}" data-option-index="${index}"><span>${escapeHtml(option.label)}</span>${option.detail ? `<small>${escapeHtml(option.detail)}</small>` : ""}</li>`).join("") : `<li class="incident-combobox__empty" role="status">${field === "tenantId" && state.roomId ? "Phòng đang trống" : "Không có kết quả"}</li>`;
    control.list.hidden = false;
    control.input.setAttribute("aria-expanded", "true");
    control.input.setAttribute("aria-activedescendant", control.activeIndex >= 0 ? `${field}-option-${control.activeIndex}` : "");
  };
  const refresh = () => {
    for (const [field, control] of groups) {
      const stateName = fieldToState(field);
      const selected = optionsFor(field).find((option) => option.id === state[stateName]);
      control.hidden.value = state[stateName];
      control.input.value = selected?.label || "";
      control.input.placeholder = field === "buildingId" ? "Chọn căn" : field === "roomId" ? (state.buildingId ? "Chọn phòng" : "Chọn căn trước") : "Chọn phòng trước";
      control.input.disabled = field === "roomId" ? !state.buildingId : stateName === "tenantId" ? !state.roomId : false;
      if (field === "buildingId" || field === "roomId") {
        control.input.readOnly = true;
        control.input.setAttribute("aria-haspopup", "listbox");
      }
      control.root.querySelector(`#${field}-hint`).textContent = stateName === "tenantId" && state.roomId && !optionsFor(field).length ? "Phòng đang trống" : "";
      control.root.querySelector(`#${field}-error`).textContent = "";
    }
    onChange({ ...state });
  };
  const close = (field) => { const control = groups.get(field); control.list.hidden = true; control.input.setAttribute("aria-expanded", "false"); control.input.removeAttribute("aria-activedescendant"); };
  const choose = (field, option) => {
    if (!option) return;
    if (field === "buildingId") {
      state.buildingId = option.id;
      state.roomId = "";
      if (!state.tenantChoices?.length) state.tenantId = "";
    } else if (field === "roomId") {
      const room = roomsById.get(option.id);
      state.roomId = option.id;
      state.buildingId = buildingIdOf(room);
      const validOccupants = occupantsForRoom({ contracts: data.contracts, members: data.members, tenants: data.tenants, roomId: option.id });
      if (!validOccupants.some((person) => person.id === state.tenantId)) state.tenantId = validOccupants[0]?.id || "";
      state.tenantChoices = null;
    } else {
      state.tenantId = option.id;
      const contracts = contractsForOccupant({ contracts: data.contracts, members: data.members, tenants: data.tenants, tenantId: option.id });
      if (contracts.length === 1) {
        const room = roomsById.get(String(contracts[0].ma_phong));
        state.roomId = room ? roomIdOf(room) : "";
        state.buildingId = room ? buildingIdOf(room) : "";
        state.tenantChoices = null;
      } else if (contracts.length > 1) {
        state.tenantChoices = contracts.map((contract) => String(contract.ma_phong));
        const candidateBuildings = [...new Set(contracts.map((contract) => buildingIdOf(roomsById.get(String(contract.ma_phong)) || {})).filter(Boolean))];
        state.buildingId = candidateBuildings.length === 1 ? candidateBuildings[0] : "";
        state.roomId = "";
      }
    }
    for (const key of selectors) close(key);
    refresh();
  };
  for (const [field, control] of groups) {
    control.input.addEventListener("focus", () => render(field));
    control.input.addEventListener("input", () => render(field));
    control.input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { close(field); return; }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        control.activeIndex = Math.max(0, Math.min(control.options.length - 1, control.activeIndex + (event.key === "ArrowDown" ? 1 : -1)));
        control.list.querySelectorAll('[role="option"]').forEach((item, index) => item.setAttribute("aria-selected", String(index === control.activeIndex)));
        control.input.setAttribute("aria-activedescendant", `${field}-option-${control.activeIndex}`);
      } else if (event.key === "Enter" && !control.list.hidden) {
        event.preventDefault(); choose(field, control.options[control.activeIndex]);
      }
    });
    control.list.addEventListener("mousedown", (event) => {
      const option = event.target.closest("[data-option-index]");
      if (option) { event.preventDefault(); choose(field, control.options[Number(option.dataset.optionIndex)]); }
    });
    control.input.addEventListener("blur", () => setTimeout(() => { if (!control.root.contains(document.activeElement)) close(field); }, 0));
  }
  const originalSubmit = form.dataset.incidentValidation;
  if (!originalSubmit) {
    form.dataset.incidentValidation = "1";
    form.addEventListener("submit", (event) => {
        const valid = isValidIncidentSelection({ buildings, rooms, ...state, contracts: data.contracts, members: data.members, tenants: data.tenants, tenantId: state.tenantId, allowTenant: isTenantRequired() });
      if (!valid) {
        event.preventDefault(); event.stopImmediatePropagation();
        const target = state.roomId ? "tenantId" : state.buildingId ? "roomId" : "buildingId";
        const errorField = target === "tenantId" ? tenantFieldName : target;
        groups.get(errorField).root.querySelector(`#${errorField}-error`).textContent = target === "tenantId" ? "Chọn khách đang ở trong phòng này." : target === "roomId" ? "Chọn phòng thuộc căn đã chọn." : "Chọn căn trước khi tiếp tục.";
        groups.get(errorField).input.focus();
      }
    }, true);
  }
  refresh();
  if (state.roomId) { state.tenantId = getTenantOptions()[0]?.id || ""; refresh(); }
  const defaultRoomTenantId = state.tenantId;
  return {
    state,
    defaultRoomTenantId,
    clearTenant() { state.tenantId = ""; refresh(); },
    restoreRoomTenant() { state.tenantId = getTenantOptions()[0]?.id || ""; refresh(); },
    selectTenant(id) { if (getTenantOptions().some((option) => option.id === String(id))) { state.tenantId = String(id); refresh(); } },
    validate: () => isValidIncidentSelection({ buildings, rooms, ...state, contracts: data.contracts, members: data.members, tenants: data.tenants, tenantId: state.tenantId, allowTenant: isTenantRequired() }),
  };
}

export { maskPhone };
