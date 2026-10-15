const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const routeSource = fs.readFileSync(
  path.resolve(__dirname, "../src/routes/mvp.routes.js"),
  "utf8",
);
const moveOutSource = fs.readFileSync(
  path.resolve(__dirname, "../src/services/moveOut.service.js"),
  "utf8",
);
const moveOutRequestSource = fs.readFileSync(
  path.resolve(__dirname, "../src/services/moveOutRequest.service.js"),
  "utf8",
);
const ddlSource = fs.readFileSync(
  path.resolve(__dirname, "../../data2.md"),
  "utf8",
);
const frontendRoot = path.resolve(__dirname, "../../phong-tro-frontend");
const ownerRequestSource = fs.readFileSync(
  path.join(frontendRoot, "src/modules/residents-contracts/requests.tab.js"),
  "utf8",
);
const legacyOwnerSource = fs.readFileSync(
  path.join(frontendRoot, "assets/js/pages/connectedPages.page.js"),
  "utf8",
);

function frontendSources(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "dist"].includes(entry.name)) return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return frontendSources(target);
    return /\.(?:html|js)$/.test(entry.name) ? [fs.readFileSync(target, "utf8")] : [];
  });
}

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

test("CT-001 move-out approval keeps contract and room unchanged until the due job", () => {
  const approval = routeBlock(
    'router.patch("/requests/:id"',
    'router.post("/requests/:id/revoke"',
  );

  assert.deepEqual(statusDomain("ck_HopDong_4"), [
    "DANG_HIEU_LUC",
    "SAP_HET_HAN",
    "HET_HAN",
    "DA_THANH_LY",
  ]);
  assert.doesNotMatch(approval, /contract\.update\(\{\s*trang_thai:/);
  assert.doesNotMatch(approval, /DANG_XU_LY_TRA_PHONG/);
  assert.match(moveOutRequestSource, /room\.update\(\{ trang_thai: "DANG_XU_LY_TRA_PHONG"/);
  assert.doesNotMatch(routeSource, /requests\/:id\/withdraw/);
});

test("CT-002 settlement leaves the approved move-out request in its valid state", () => {
  const route = routeBlock(
    'router.post("/move-outs/:contractId/settle"',
    'router.post("/incidents"',
  );
  const settlement = `${route}\n${moveOutSource}`;

  assert.deepEqual(statusDomain("ck_YeuCau_2"), [
    "CHO_XU_LY",
    "DA_PHE_DUYET",
    "TU_CHOI",
    "DA_RUT",
  ]);
  assert.doesNotMatch(settlement, /DA_HOAN_TAT/);
  assert.match(
    settlement,
    /contract\.update\(\{\s*trang_thai:\s*"DA_THANH_LY"/,
  );
});

test("FR-186 frontend exposes owner revoke with a reason and no tenant withdraw route", () => {
  const frontendSource = frontendSources(frontendRoot).join("\n");

  assert.doesNotMatch(frontendSource, /\/withdraw\b/);
  assert.match(ownerRequestSource, /data-revoke/);
  assert.match(ownerRequestSource, /\/v1\/requests\/\$\{button\.dataset\.revoke\}\/revoke/);
  assert.match(ownerRequestSource, /prompt\([^)]*lý do rút duyệt/i);
  assert.match(legacyOwnerSource, /\/v1\/requests\/\$\{item\.ma_yeu_cau\}\/revoke/);
});
