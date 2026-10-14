const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const frontend = (relativePath) => fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src", relativePath), "utf8");

test("CT-015 account tab exposes guarded create, lock, unlock and reset actions", () => {
  const tab = frontend("modules/residents-contracts/accounts.tab.js");
  const view = frontend("shared/components/view.js");
  assert.match(view, /config\.rowActions/);
  assert.match(tab, /\/v1\/accounts/);
  assert.match(tab, /status: "DA_KHOA"/);
  assert.match(tab, /status: "HOAT_DONG"/);
  assert.match(tab, /\/v1\/accounts\/reset-password/);
  assert.doesNotMatch(tab, /password\s*:/);
});

test("CT-015 building tab supports edit and canonical status transitions", () => {
  const tab = frontend("modules/properties/buildings.tab.js");
  assert.match(tab, /\/management\/can-tro\/\$\{row\.ma_can\}/);
  assert.match(tab, /NGUNG_HOAT_DONG/);
  assert.match(tab, /HOAT_DONG/);
});

test("CT-015 room tab edits rooms and only toggles safe availability states", () => {
  const tab = frontend("modules/properties/rooms.tab.js");
  assert.match(tab, /\/phong\/\$\{row\.ma_phong\}/);
  assert.match(tab, /\["TRONG", "NGUNG_SU_DUNG"\]\.includes/);
  assert.match(tab, /trang_thai: row\.trang_thai === "TRONG" \? "NGUNG_SU_DUNG" : "TRONG"/);
});

test("CT-015 asset tab supports condition updates and confirmed deletion", () => {
  const tab = frontend("modules/properties/assets.tab.js");
  assert.match(tab, /api\.put\(`\/v1\/assets\/\$\{row\.ma_tai_san\}`/);
  assert.match(tab, /api\.del\(`\/v1\/assets\/\$\{row\.ma_tai_san\}`/);
  assert.match(tab, /condition: row\.tinh_trang/);
});
