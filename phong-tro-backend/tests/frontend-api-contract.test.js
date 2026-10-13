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
  for (const field of ["item.id", "item.period", "item.room", "item.readingValue", "item.status", "item.submittedAt"]) {
    assert.match(source, new RegExp(field.replace(".", "\\.")), `SPA must consume ${field}`);
  }
  for (const rawField of ["ma_chi_so", "thang", "nam", "chi_so_moi", "trang_thai_xac_nhan", "ngay_ghi_nhan"]) {
    assert.doesNotMatch(source, new RegExp(rawField), `SPA must not consume raw field ${rawField}`);
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
