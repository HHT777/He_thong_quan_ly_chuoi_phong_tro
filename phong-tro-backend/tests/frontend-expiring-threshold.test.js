const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "../../phong-tro-frontend/src/modules/overview");

test("FR-158 dashboard reads configured warning days from expiring response", async () => {
  const { readExpiring } = await import(pathToFileURL(path.join(root, "dashboard.metrics.mjs")).href);
  for (const warningDays of [15, 45]) {
    const value = readExpiring({ warningDays, data: [{ ma_hop_dong: "contract-1", ngay_ket_thuc: "2026-11-16", phongTro: { so_phong: "A1" } }] });
    assert.equal(value.warningDays, warningDays);
    assert.equal(value.rows[0].id, "contract-1");
    assert.equal(value.rows[0].room, "A1");
  }
  assert.throws(() => readExpiring({ data: [] }), /warning days/);
  const screen = fs.readFileSync(path.join(root, "dashboard.tab.js"), "utf8");
  assert.match(screen, /Ngưỡng \$\{warningDays\} ngày/);
  assert.doesNotMatch(screen, /Kết thúc trong 30 ngày|hợp đồng trong 30 ngày/);
});
