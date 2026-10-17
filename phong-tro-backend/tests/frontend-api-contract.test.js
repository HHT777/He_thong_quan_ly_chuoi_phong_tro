const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const meterReadingService = require("../src/services/meterReading.service");

function frontendSource(relativePath) {
  return fs.readFileSync(
    path.resolve(__dirname, "../../phong-tro-frontend/src", relativePath),
    "utf8",
  );
}

test("CT-003 meter-reading SPA consumes the API DTO contract", () => {
  const dto = meterReadingService.toDto({
    ma_chi_so: "QA_READING_001",
    nam: 2026,
    thang: 10,
    ma_phong: "QA_ROOM_001",
    chi_so_moi: 321,
    trang_thai_xac_nhan: "CHO_XAC_NHAN",
    don_gia_ap_dung: 3500,
    ngay_ghi_nhan: "2026-10-13T00:00:00.000Z",
    phongTro: { ma_phong: "QA_ROOM_001", so_phong: "QA-101" },
  });
  const source = frontendSource("modules/operations/meter-readings.tab.js");

  assert.deepEqual(
    {
      id: dto.id,
      period: dto.period,
      roomCode: dto.room.code,
      readingValue: dto.readingValue,
      status: dto.status,
      submittedAt: dto.submittedAt,
    },
    {
      id: "QA_READING_001",
      period: "2026-10",
      roomCode: "QA-101",
      readingValue: 321,
      status: "CHO_XAC_NHAN",
      submittedAt: "2026-10-13T00:00:00.000Z",
    },
  );
  for (const field of ["id", "period", "room", "readingValue", "readingType", "status", "submittedAt"]) {
    assert.match(source, new RegExp(`row\\.${field}\\b`), `SPA must consume row.${field}`);
  }
  for (const rawField of ["ma_chi_so", "thang", "nam", "chi_so_moi", "trang_thai_xac_nhan", "ngay_ghi_nhan"]) {
    assert.doesNotMatch(source, new RegExp(`row\\.${rawField}\\b`), `SPA must not consume raw field ${rawField}`);
  }
});

test("CT-013 room status filters use the database status domain", () => {
  const view = frontendSource("shared/components/view.js");
  const dashboard = frontendSource("modules/overview/dashboard.tab.js");
  const sources = `${view}\n${dashboard}`;

  assert.match(view, /DANG_XU_LY_TRA_PHONG/);
  assert.match(dashboard, /trang_thai === "DANG_XU_LY_TRA_PHONG"/);
  assert.doesNotMatch(sources, /\bDANG_XU_LY_TRA\b|\bDANG_TRA\b/);
});

test("CT-014 incident priority defaults and validation match the documented domain", () => {
  const incidentForm = frontendSource("modules/tenant/tenant-incidents.tab.js");
  const incidentRoute = fs.readFileSync(
    path.resolve(__dirname, "../src/routes/mvp.routes.js"),
    "utf8",
  );

  assert.match(incidentRoute, /\["THAP", "TRUNG_BINH", "CAO", "KHAN_CAP"\]/);
  assert.match(incidentRoute, /value \|\| "TRUNG_BINH"/);
  assert.match(incidentRoute, /INCIDENT_PRIORITIES\.includes\(priority\)/);
  assert.match(incidentRoute, /INVALID_INCIDENT_PRIORITY/);
  assert.match(incidentForm, /value: "TRUNG_BINH"/);
  assert.match(incidentForm, /INCIDENT_PRIORITIES\.includes\(values\.priority\)/);
  assert.match(incidentRoute, /incidentPriority\(req\.body\.priority\)/);
  assert.doesNotMatch(`${incidentForm}\n${incidentRoute}`, /BINH_THUONG/);
});
