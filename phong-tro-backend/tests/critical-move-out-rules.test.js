const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const routeSource = fs.readFileSync(
  path.resolve(__dirname, "../src/routes/mvp.routes.js"),
  "utf8",
);
const ddlSource = fs.readFileSync(
  path.resolve(__dirname, "../../data2.md"),
  "utf8",
);

function routeBlock(startMarker, endMarker) {
  const start = routeSource.indexOf(startMarker);
  const end = routeSource.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing route marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing route marker: ${endMarker}`);
  return routeSource.slice(start, end);
}

function statusDomain(constraintName) {
  const constraint = ddlSource
    .split(/\r?\n/)
    .find((line) => line.includes(`constraint \`${constraintName}\``));
  assert.ok(constraint, `Missing DDL constraint: ${constraintName}`);
  return [...constraint.matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

test("CT-001 move-out approval keeps the contract valid and only transitions the room", () => {
  const approval = routeBlock(
    'router.patch("/requests/:id"',
    'router.post(["/requests/:id/withdraw"',
  );

  assert.deepEqual(statusDomain("ck_HopDong_4"), [
    "DANG_HIEU_LUC",
    "SAP_HET_HAN",
    "HET_HAN",
    "DA_THANH_LY",
  ]);
  assert.doesNotMatch(approval, /contract\.update\(\{\s*trang_thai:/);
  assert.match(
    approval,
    /PhongTro\.update\(\{\s*trang_thai:\s*"DANG_XU_LY_TRA_PHONG"/,
  );
});

test("CT-002 settlement leaves the approved move-out request in its valid state", () => {
  const settlement = routeBlock(
    'router.post("/move-outs/:contractId/settle"',
    'router.post("/incidents"',
  );

  assert.deepEqual(statusDomain("ck_YeuCau_2"), [
    "CHO_XU_LY",
    "DA_PHE_DUYET",
    "TU_CHOI",
  ]);
  assert.doesNotMatch(settlement, /YeuCau\.findByPk/);
  assert.doesNotMatch(settlement, /DA_HOAN_TAT/);
  assert.match(
    settlement,
    /contract\.update\(\{\s*trang_thai:\s*"DA_THANH_LY"/,
  );
});
