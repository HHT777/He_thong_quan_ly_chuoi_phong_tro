import { escapeHtml } from "../../shared/components/view.js";

const STORAGE_KEY = "qlpt:residents-contracts-building";
const ROOM_STORAGE_KEY = "qlpt:residents-contracts-room";

async function loadAll(api, path) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await api.get(`${path}${separator}limit=100&page=${page}`);
    rows.push(...(response.data || []));
    if (!response.pagination?.hasNext) return rows;
  }
}

export async function loadBuildingScope(api, { contracts = false, roomFilter = false } = {}) {
  const [rooms, contractRows] = await Promise.all([
    loadAll(api, "/phong"),
    contracts ? loadAll(api, "/hop-dong") : Promise.resolve([]),
  ]);
  const roomById = new Map(rooms.map((room) => [String(room.ma_phong), room]));
  const contractById = new Map(contractRows.map((contract) => [String(contract.ma_hop_dong), contract]));
  const buildings = [...new Map(rooms.map((room) => [String(room.ma_can), {
    id: String(room.ma_can), name: room.canTro?.ten_can || String(room.ma_can),
  }])).values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const stored = sessionStorage.getItem(STORAGE_KEY);
  const selected = buildings.some((building) => building.id === stored) ? stored : "ALL";
  const storedRoom = roomFilter ? sessionStorage.getItem(ROOM_STORAGE_KEY) : null;
  const selectedRoom = roomFilter && rooms.some((room) => String(room.ma_phong) === storedRoom
    && (selected === "ALL" || String(room.ma_can) === selected)) ? storedRoom : "ALL";

  const matchesRoom = (roomId) => {
    const room = roomById.get(String(roomId));
    return Boolean(room)
      && (selected === "ALL" || String(room.ma_can) === selected)
      && (selectedRoom === "ALL" || String(room.ma_phong) === selectedRoom);
  };
  const matchesContract = (contract) => {
    const directBuildingId = contract?.phongTro?.ma_can;
    if (directBuildingId != null) {
      const roomId = contract?.phongTro?.ma_phong || contract?.ma_phong;
      return (selected === "ALL" || String(directBuildingId) === selected)
        && (selectedRoom === "ALL" || String(roomId) === selectedRoom);
    }
    return matchesRoom(contract?.ma_phong);
  };
  const matchesResident = (resident) => {
    if (resident.ma_phong) return matchesRoom(resident.ma_phong);
    return selected === "ALL" && selectedRoom === "ALL"
      || (resident.hopDongs || []).some(matchesContract);
  };
  const matchesContractId = (contractId) => matchesContract(contractById.get(String(contractId)));

  const mount = (container, onChange) => {
    const label = document.createElement("label");
    label.className = "resident-building-filter";
    label.innerHTML = `Căn <select class="mgmt-filter-select" aria-label="Lọc theo căn">
      <option value="ALL">Tất cả căn trọ</option>
      ${buildings.map((building) => `<option value="${escapeHtml(building.id)}" ${selected === building.id ? "selected" : ""}>${escapeHtml(building.name)}</option>`).join("")}
    </select>${roomFilter ? `Phòng <select class="mgmt-filter-select" aria-label="Lọc theo phòng">
      <option value="ALL">Tất cả phòng</option>
      ${rooms.filter((room) => selected === "ALL" || String(room.ma_can) === selected).map((room) => `<option value="${escapeHtml(room.ma_phong)}" ${selectedRoom === String(room.ma_phong) ? "selected" : ""}>${escapeHtml(room.canTro?.ten_can || "Căn trọ")} · ${escapeHtml(room.so_phong || room.ma_phong)}</option>`).join("")}
    </select>` : ""}`;
    label.querySelector("select").addEventListener("change", (event) => {
      sessionStorage.setItem(STORAGE_KEY, event.target.value);
      if (roomFilter) sessionStorage.removeItem(ROOM_STORAGE_KEY);
      onChange();
    });
    if (roomFilter) label.querySelectorAll("select")[1].addEventListener("change", (event) => {
      if (event.target.value === "ALL") sessionStorage.removeItem(ROOM_STORAGE_KEY);
      else sessionStorage.setItem(ROOM_STORAGE_KEY, event.target.value);
      onChange();
    });
    container.prepend(label);
  };

  const buildingById = new Map(buildings.map((building) => [building.id, building]));
  return { selected, selectedRoom, buildings, buildingById, rooms, roomById, contractById, matchesRoom, matchesContract, matchesResident, matchesContractId, mount };
}
