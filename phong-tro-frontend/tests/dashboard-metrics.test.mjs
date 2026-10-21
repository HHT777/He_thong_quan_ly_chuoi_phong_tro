import test from "node:test";
import assert from "node:assert/strict";
import { dashboardError, readCashflow, readExpiring, readIncidents, readSummary } from "../src/modules/overview/dashboard.metrics.mjs";
import { statusLabel } from "../src/shared/components/status-labels.mjs";

// GET /api/v1/dashboard/summary?period=2026-10 on qlpt_authz_test, owner_ci (21/10/2026).
const summaryResponse = { data: { period: "2026-10", rooms: { total: 30, byStatus: { DANG_THUE: 15, TRONG: 12, DA_GIU: 0, DANG_XU_LY_TRA_PHONG: 1, NGUNG_SU_DUNG: 2, KHAC: 0 } }, bills: { total: 16, daThu: 5, conNo: 0, quaHan: 11 } } };

test("UI-1a summary reads server fields and accounts for DA_GIU and KHAC", () => {
  const value = readSummary(summaryResponse);
  assert.equal(value.rooms.total, 30);
  assert.equal(value.rooms.byStatus.DA_GIU, 0);
  assert.equal(value.rooms.byStatus.KHAC, 0);
  assert.equal(value.occupancyPercent, 50);
  assert.equal(value.bills.total, value.bills.daThu + value.bills.conNo + value.bills.quaHan);
  assert.equal(value.bills.quaHan, 11);
  const heldAndUnknown = readSummary({ data: { ...summaryResponse.data, rooms: { total: 32, byStatus: { ...summaryResponse.data.rooms.byStatus, DA_GIU: 1, KHAC: 1 } } } });
  assert.equal(heldAndUnknown.rooms.byStatus.DA_GIU + heldAndUnknown.rooms.byStatus.KHAC, 2);
});

test("UI-1a changing a response field or unit fails rather than showing zero", () => {
  assert.throws(() => readSummary({ data: { ...summaryResponse.data, rooms: { ...summaryResponse.data.rooms, total: undefined } } }), /count/);
  assert.throws(() => readSummary({ data: { ...summaryResponse.data, bills: { ...summaryResponse.data.bills, quaHan: undefined } } }), /count/);
  assert.throws(() => readSummary({ data: { ...summaryResponse.data, rooms: { ...summaryResponse.data.rooms, byStatus: { ...summaryResponse.data.rooms.byStatus, DANG_THUE: 14 } } } }), /partition/);
  assert.throws(() => readCashflow({ data: { totalRevenue: 25.09 } }), /VND/);
  // Real response from qlpt_authz_test for the same owner and month.
  assert.equal(readCashflow({ data: { totalRevenue: 29475661 } }).totalRevenue, 29475661);
});

test("UI-1a incidents group every state and retain only three most recent", () => {
  const rows = [
    { ma_su_co: "1", trang_thai: "DA_XU_LY", ngay_gui: "2026-10-01", mo_ta: "Một" },
    { ma_su_co: "2", trang_thai: "CHO_TIEP_NHAN", ngay_gui: "2026-10-04", mo_ta: "Bốn" },
    { ma_su_co: "3", trang_thai: "DANG_XU_LY", ngay_gui: "2026-10-03", mo_ta: "Ba" },
    { ma_su_co: "4", trang_thai: "UNKNOWN", ngay_gui: "2026-10-02", mo_ta: "Hai" },
  ];
  const result = readIncidents({ data: rows });
  assert.equal(result.total, 4);
  assert.deepEqual(result.recent.map((item) => item.id), ["2", "3", "4"]);
  assert.equal(result.byStatus.KHAC, 1);
  assert.equal(Object.values(result.byStatus).reduce((a, b) => a + b, 0), result.total);
});

test("UI-1a expiring contracts read owner-scoped response and do not invent 60/90-day buckets", () => {
  assert.deepEqual(readExpiring({ data: [{ ma_hop_dong: "a", ngay_ket_thuc: "2026-10-30", phongTro: { so_phong: "101" } }] }), [{ id: "a", room: "101", endDate: "2026-10-30" }]);
  assert.throws(() => readExpiring({ data: { total: 1 } }), /Invalid/);
});

test("UI-1a 401, 403, 404, schema 503, 5xx and network errors are distinct and safe", () => {
  const cases = [{ status: 401 }, { status: 403 }, { status: 404 }, { status: 503, code: "DB_SCHEMA_OUTDATED" }, { status: 500 }, new TypeError("SQL SELECT secret")];
  const messages = cases.map(dashboardError);
  assert.equal(new Set(messages).size, cases.length);
  for (const message of messages) assert.doesNotMatch(message, /SQL|SELECT|DB_SCHEMA_OUTDATED|RESOURCE_NOT_FOUND|secret/);
});

test("UI-1a shared status labels hide unknown technical codes", () => {
  assert.equal(statusLabel("DA_GIU"), "Đã giữ");
  assert.equal(statusLabel("CHO_TIEP_NHAN"), "Chờ tiếp nhận");
  assert.equal(statusLabel("UNMAPPED_INTERNAL_CODE"), "Trạng thái khác");
});
