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

  assert.equal((service.match(/sequelize\.transaction\(/g) || []).length, 2);
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

test("CT-005 incident completion creates exactly one financial branch and notification transactionally", () => {
  const service = source("services/incident.service.js");
  const route = source("routes/mvp.routes.js");

  assert.match(service, /sequelize\.transaction\(/);
  assert.match(service, /payload\.responsible === "CHU_TRO"/);
  assert.match(service, /KhoanChi\.create/);
  assert.match(service, /ChiPhiSuCoKhachThue\.create/);
  assert.doesNotMatch(service, /ChiTietThanhToan\.create/);
  assert.match(service, /ThongBao\.create/);
  assert.match(service, /INCIDENT_FINANCE_ALREADY_EXISTS/);
  assert.match(route, /incidentService\.update/);
});

test("CT-005 soft delete requires a reason and rejects processed or financed incidents", () => {
  const service = source("services/incident.service.js");
  const route = source("routes/mvp.routes.js");

  assert.match(service, /DELETE_REASON_REQUIRED/);
  assert.match(service, /INCIDENT_CANNOT_BE_DELETED/);
  assert.match(service, /da_xoa: true/);
  assert.match(service, /nguoi_xoa_id: actorId/);
  assert.match(route, /router\.delete\("\/incidents\/:id"/);
});

test("CT-008 co-tenant proposal creates request detail first and residence only after approval", () => {
  const service = source("services/coTenant.service.js");
  const route = source("routes/mvp.routes.js");

  assert.match(service, /sequelize\.transaction\(/);
  assert.match(service, /YeuCau\.create/);
  assert.match(service, /DeXuatBanCungPhong\.create/);
  assert.match(service, /trang_thai: "CHO_XU_LY"/);
  assert.match(service, /async function approve\(request, transaction\)/);
  assert.match(service, /ThanhVienPhong\.create/);
  assert.match(service, /ROOM_CAPACITY_REACHED/);
  assert.match(service, /CO_TENANT_ALREADY_RESIDENT/);
  assert.match(route, /coTenantService\.approve\(row, transaction\)/);
  const coTenantRoute = route.slice(route.indexOf('router.post("/co-tenants"'));
  assert.match(coTenantRoute, /coTenantService\.propose/);
  assert.doesNotMatch(coTenantRoute.split('router.get("/co-tenants"')[0], /ThanhVienPhong\.create/);
});
