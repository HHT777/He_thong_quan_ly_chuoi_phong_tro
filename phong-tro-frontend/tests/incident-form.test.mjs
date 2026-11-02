import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  activeContractsForTenant, buildCompletionPayload, buildCreateIncidentPayload,
  contractsForOccupant, deriveFromTenant, filterOptions, formatEntityLabel, loadAllPages,
  isValidIncidentSelection, normalizeSearch, occupantsForRoom, showTenantResponsibility,
  tenantSelectionForResponsibility,
} from "../src/modules/operations/incident-form.mjs";

const ids = {
  building: "f1b48ee0-6321-4c86-9e0a-c4e4ef896100",
  room: "f2b48ee0-6321-4c86-9e0a-c4e4ef896100",
  room2: "f3b48ee0-6321-4c86-9e0a-c4e4ef896100",
  tenant: "f4b48ee0-6321-4c86-9e0a-c4e4ef896100",
  tenant2: "f5b48ee0-6321-4c86-9e0a-c4e4ef896100",
  contract: "f6b48ee0-6321-4c86-9e0a-c4e4ef896100",
};
const buildings = [{ id: ids.building }];
const rooms = [
  { ma_phong: ids.room, ma_can: ids.building },
  { ma_phong: ids.room2, ma_can: ids.building },
];
const tenants = [
  { ma_khach_thue: ids.tenant, ho_ten: "Nguyễn An", so_dien_thoai: "0900 000 001" },
  { ma_khach_thue: ids.tenant2, ho_ten: "Trần Bình", so_dien_thoai: "0900000002" },
];
const contracts = [
  { ma_hop_dong: ids.contract, ma_khach_thue: ids.tenant, ma_phong: ids.room, trang_thai: "DANG_HIEU_LUC", khachThue: { ho_ten: "Nguyễn An", so_dien_thoai: "0900000001" } },
  { ma_hop_dong: "f7b48ee0-6321-4c86-9e0a-c4e4ef896100", ma_khach_thue: ids.tenant, ma_phong: ids.room2, trang_thai: "SAP_HET_HAN", khachThue: { ho_ten: "Nguyễn An", so_dien_thoai: "0900000001" } },
];
const members = [
  { ma_hop_dong: ids.contract, ho_ten: "Trần Bình", so_dien_thoai: "0900-000-002", trang_thai_cu_tru: "DANG_O" },
  { ma_hop_dong: ids.contract, ho_ten: "Người đã rời", so_dien_thoai: "0900000003", trang_thai_cu_tru: "DA_ROI" },
];

test("incident selectors search without Vietnamese accents and format entity labels without UUID fallback", () => {
  assert.equal(normalizeSearch("Nguyễn Đặng"), "nguyen dang");
  assert.deepEqual(filterOptions([{ label: "Nguyễn An" }, { label: "Trần Bình" }], "nguyen"), [{ label: "Nguyễn An" }]);
  assert.equal(formatEntityLabel("building", { ten_can: "Căn Hoa Sen", id: ids.building }), "Căn Hoa Sen");
  assert.equal(formatEntityLabel("room", { so_phong: "101", ten_can: "Căn Hoa Sen" }), "Căn Hoa Sen · Phòng 101");
  assert.equal(formatEntityLabel("room", { so_phong: ids.room }), "Không xác định");
  assert.equal(formatEntityLabel("contract", { so_phong: ids.room, ma_khach_thue: ids.tenant }), "Không xác định");
  assert.equal(formatEntityLabel("incident", { mo_ta: "Rò nước", ma_su_co: ids.contract }), "Rò nước");
});

test("room and tenant selection derives active holder/co-tenant relationships and rejects mismatches", () => {
  assert.deepEqual(activeContractsForTenant(contracts, ids.tenant), contracts);
  assert.deepEqual(contractsForOccupant({ contracts, members, tenants, tenantId: ids.tenant2 }), [contracts[0]]);
  assert.deepEqual(deriveFromTenant({ contracts, members, tenants, roomsById: new Map(rooms.map((room) => [room.ma_phong, room])), tenantId: ids.tenant2 }), {
    buildingId: ids.building, roomId: ids.room,
  });
  assert.deepEqual(deriveFromTenant({ contracts, members, tenants, roomsById: new Map(rooms.map((room) => [room.ma_phong, room])), tenantId: ids.tenant }), {
    buildingId: "", roomId: "", choices: [ids.room, ids.room2],
  });
  assert.deepEqual(occupantsForRoom({ contracts: [contracts[0]], members, tenants, roomId: ids.room }).map(({ id, role }) => ({ id, role })), [
    { id: ids.tenant, role: "Người đứng tên" }, { id: ids.tenant2, role: "Người ở cùng" },
  ]);
  assert.equal(isValidIncidentSelection({ buildings, rooms, buildingId: ids.building, roomId: ids.room, tenantId: ids.tenant2, contracts: [contracts[0]], members, tenants, allowTenant: true }), true);
  assert.equal(isValidIncidentSelection({ buildings, rooms, buildingId: ids.building, roomId: ids.room2, tenantId: ids.tenant2, contracts: [contracts[0]], members, tenants, allowTenant: true }), false);
  assert.equal(isValidIncidentSelection({ buildings, rooms, buildingId: ids.tenant, roomId: ids.room, contracts, members, tenants }), false);
});

test("incident payloads preserve API fields and omit tenant responsibility for landlord-paid work", () => {
  assert.deepEqual(buildCreateIncidentPayload({ roomId: ids.room, type: "  Rò nước ", priority: "CAO", description: "  Vòi hỏng  ", tenantId: ids.tenant }), {
    roomId: ids.room, type: "Rò nước", priority: "CAO", description: "Vòi hỏng",
  });
  const ownerPayload = buildCompletionPayload({ responsible: "CHU_TRO", cost: "125000", note: " Xong ", responsibleTenantId: ids.tenant, responsibilityBasis: "cũ" });
  assert.deepEqual(ownerPayload, { status: "DA_XU_LY", responsible: "CHU_TRO", cost: 125000, note: "Xong", replacement: undefined });
  assert.equal(JSON.stringify(ownerPayload).includes(ids.tenant), false);
  assert.deepEqual(buildCompletionPayload({ responsible: "KHACH_THUE", cost: "0", note: "Đã xử lý", responsibleTenantId: ids.tenant, responsibilityBasis: "Biên bản" }), {
    status: "DA_XU_LY", responsible: "KHACH_THUE", cost: 0, note: "Đã xử lý", replacement: undefined,
    responsibleTenantId: ids.tenant, responsibilityBasis: "Biên bản",
  });
  assert.equal(showTenantResponsibility("KHACH_THUE"), true);
  assert.equal(showTenantResponsibility("CHU_TRO"), false);
});

test("responsibility switch clears tenant for landlord and restores room default for tenant", () => {
  assert.equal(tenantSelectionForResponsibility("CHU_TRO", ids.tenant2, ids.tenant), "");
  assert.equal(tenantSelectionForResponsibility("KHACH_THUE", "", ids.tenant), ids.tenant);
  assert.equal(tenantSelectionForResponsibility("KHACH_THUE", ids.tenant2, ids.tenant), ids.tenant2);
});

test("loadAllPages includes every page and stops at the API pagination boundary", async () => {
  const calls = [];
  const api = { get: async (path) => {
    calls.push(path);
    const page = Number(new URL(`http://localhost${path}`).searchParams.get("page"));
    return { data: [`row-${page}`], pagination: { hasNext: page < 3 } };
  } };
  assert.deepEqual(await loadAllPages(api, "/hop-dong"), ["row-1", "row-2", "row-3"]);
  assert.deepEqual(calls, ["/hop-dong?limit=100&page=1", "/hop-dong?limit=100&page=2", "/hop-dong?limit=100&page=3"]);
});

test("UUID audit screens render human room and tenant labels rather than raw identifiers", () => {
  const files = [
    "../src/shared/components/view.js", "../src/shared/components/tab-factory.js",
    "../src/modules/properties/rooms.tab.js", "../src/modules/properties/assets.tab.js",
    "../src/modules/residents-contracts/reservations.tab.js", "../src/modules/residents-contracts/contracts.tab.js",
    "../src/modules/operations/move-outs.tab.js", "../src/modules/operations/incidents.tab.js",
    "../src/modules/overview/dashboard.view.mjs",
  ];
  const rendered = files.map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(rendered, /(?:escapeHtml\()?\s*(?:row|room|summary|contract)\.(?:ma_phong|ma_hop_dong|ma_bien_ban)\s*\)?\s*\}\}/);
  assert.doesNotMatch(rendered, /search=\$\{encodeURIComponent\(row\.id\)\}/);
  assert.match(rendered, /room-detail-grid__wide/);
});
