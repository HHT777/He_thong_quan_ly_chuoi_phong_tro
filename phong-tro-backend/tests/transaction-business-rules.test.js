const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateChecklist } = require("../src/services/moveOut.service");

const source = (relativePath) => fs.readFileSync(path.resolve(__dirname, "../src", relativePath), "utf8");

test("CT-004 move-out checklist rejects incomplete settlement before transaction writes", () => {
  assert.throws(() => validateChecklist({}), (error) => error.code === "ASSETS_NOT_CHECKED");
  assert.throws(
    () => validateChecklist({ assetsChecked: true }),
    (error) => error.code === "DEBT_NOT_REVIEWED",
  );
  assert.throws(
    () => validateChecklist({ assetsChecked: true, debtReviewed: true }),
    (error) => error.code === "ROOM_CONDITION_REQUIRED",
  );
  assert.equal(validateChecklist({
    assetsChecked: true,
    debtReviewed: true,
    roomCondition: "QA_OK",
    deduction: 0,
  }), 0);
});

test("CT-004 settlement coordinates every lifecycle write in one transaction", () => {
  const service = source("services/moveOut.service.js");
  const route = source("routes/mvp.routes.js");

  assert.equal((service.match(/sequelize\.transaction\(/g) || []).length, 1);
  for (const operation of [
    "ChiSoDien.findOne",
    "TienCoc.findOne",
    "ThanhToan.findAll",
    "BienBanTraPhong.create",
    "KhoanKhauTru.create",
    "ThanhVienPhong.update",
    "contract.update",
    "room.update",
    "TaiKhoan.update",
    "ThongBao.create",
  ]) assert.match(service, new RegExp(operation.replace(".", "\\.")), operation);
  assert.match(route, /moveOutService\.settle/);
  assert.doesNotMatch(route, /BienBanTraPhong\.create/);
});
