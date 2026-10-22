import { escapeHtml } from "../../shared/components/view.js";

const STORAGE_KEY = "qlpt:residents-contracts-building";

async function loadAll(api, path) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await api.get(`${path}${separator}limit=100&page=${page}`);
    rows.push(...(response.data || []));
    if (!response.pagination?.hasNext) return rows;
  }
}

export async function loadBuildingScope(api, { contracts = false } = {}) {
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

  const matchesRoom = (roomId) => selected === "ALL" || String(roomById.get(String(roomId))?.ma_can || "") === selected;
  const matchesContract = (contract) => matchesRoom(contract?.ma_phong);
  const matchesResident = (resident) => selected === "ALL" || (resident.hopDongs || []).some(matchesContract);
  const matchesContractId = (contractId) => selected === "ALL" || matchesContract(contractById.get(String(contractId)));

  const mount = (container, onChange) => {
    const label = document.createElement("label");
    label.className = "resident-building-filter";
    label.innerHTML = `Căn <select class="mgmt-filter-select" aria-label="Lọc theo căn">
      <option value="ALL">Tất cả căn trọ</option>
      ${buildings.map((building) => `<option value="${escapeHtml(building.id)}" ${selected === building.id ? "selected" : ""}>${escapeHtml(building.name)}</option>`).join("")}
    </select>`;
    label.querySelector("select").addEventListener("change", (event) => {
      sessionStorage.setItem(STORAGE_KEY, event.target.value);
      onChange();
    });
    container.prepend(label);
  };

  return { selected, buildings, rooms, matchesRoom, matchesContract, matchesResident, matchesContractId, mount };
}
