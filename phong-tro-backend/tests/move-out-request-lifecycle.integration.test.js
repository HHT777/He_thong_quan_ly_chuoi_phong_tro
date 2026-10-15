const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HopDong, PhongTro, YeuCau, YeuCauTraPhong, ThongBao, AuditLog,
} = require("../src/models");
const moveOutRequestService = require("../src/services/moveOutRequest.service");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

async function createMoveOut(fresh, date, earlyReturnReason) {
  return request("/api/v1/requests", {
    method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({
      type: "TRA_PHONG", content: "Yêu cầu trả phòng C.1", date, earlyReturnReason,
    }),
  });
}

async function approveMoveOut(landlord, requestId, payload = {}) {
  return request(`/api/v1/requests/${requestId}`, {
    method: "PATCH", headers: headers(landlord),
    body: JSON.stringify({ status: "DA_DUYET", ...payload }),
  });
}

test("FR-109 approval schedules move-out and due cron is locked/idempotent", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "scheduled-move-out");
  const created = await createMoveOut(fresh, "2026-12-20");
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const approved = await approveMoveOut(landlord, created.body.data.ma_yeu_cau);
  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  const [detail, beforeDue] = await Promise.all([
    YeuCauTraPhong.findByPk(created.body.data.ma_yeu_cau),
    PhongTro.findByPk(fresh.room.ma_phong),
  ]);
  assert.equal(detail.ngay_tra_da_duyet, "2026-12-20");
  assert.equal(beforeDue.trang_thai, "DANG_THUE");

  const earlyRun = await moveOutRequestService.processDueMoveOuts({ now: new Date("2026-12-19T12:00:00+07:00") });
  assert.equal(earlyRun.processed, 0);
  assert.equal((await PhongTro.findByPk(fresh.room.ma_phong)).trang_thai, "DANG_THUE");

  const firstRun = await moveOutRequestService.processDueMoveOuts({ now: new Date("2026-12-20T12:00:00+07:00") });
  const secondRun = await moveOutRequestService.processDueMoveOuts({ now: new Date("2026-12-21T12:00:00+07:00") });
  assert.equal(firstRun.processed, 1);
  assert.equal(secondRun.processed, 0);
  assert.equal((await PhongTro.findByPk(fresh.room.ma_phong)).trang_thai, "DANG_XU_LY_TRA_PHONG");
  const [notifications, audits] = await Promise.all([
    ThongBao.count({ where: { ma_tai_khoan: fresh.account.ma_tai_khoan, loai_thong_bao: "BAT_DAU_TRA_PHONG" } }),
    AuditLog.count({ where: { action: "MOVE_OUT_DUE_STARTED", entity_id: created.body.data.ma_yeu_cau } }),
  ]);
  assert.equal(notifications, 1);
  assert.equal(audits, 1);

  const missed = await createFreshRental(landlord, "missed-move-out");
  const missedRequest = await createMoveOut(missed, "2026-12-20");
  assert.equal((await approveMoveOut(landlord, missedRequest.body.data.ma_yeu_cau)).response.status, 200);
  const catchUpRun = await moveOutRequestService.processDueMoveOuts({ now: new Date("2026-12-23T12:00:00+07:00") });
  assert.ok(catchUpRun.processed >= 1);
  assert.equal((await PhongTro.findByPk(missed.room.ma_phong)).trang_thai, "DANG_XU_LY_TRA_PHONG");
});

test("FR-186 landlord revokes approval, tenant is forbidden, and rollback is atomic", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "revoke-move-out");
  const created = await createMoveOut(fresh, "2027-01-20");
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  assert.equal((await approveMoveOut(landlord, created.body.data.ma_yeu_cau)).response.status, 200);

  const forbidden = await request(`/api/v1/requests/${created.body.data.ma_yeu_cau}/revoke`, {
    method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({ reason: "Khách không có quyền" }),
  });
  assert.equal(forbidden.response.status, 403);
  const missingReason = await request(`/api/v1/requests/${created.body.data.ma_yeu_cau}/revoke`, {
    method: "POST", headers: headers(landlord), body: "{}",
  });
  assert.equal(missingReason.response.status, 422);
  assert.equal(missingReason.body.error?.code, "REQUEST_REVOKE_REASON_REQUIRED");

  const revoked = await request(`/api/v1/requests/${created.body.data.ma_yeu_cau}/revoke`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify({ reason: "Hai bên tiếp tục hợp đồng" }),
  });
  assert.equal(revoked.response.status, 200, JSON.stringify(revoked.body));
  const [requestAfter, roomAfter, notice, audit] = await Promise.all([
    YeuCau.findByPk(created.body.data.ma_yeu_cau),
    PhongTro.findByPk(fresh.room.ma_phong),
    ThongBao.findOne({ where: { ma_tai_khoan: fresh.account.ma_tai_khoan, loai_thong_bao: "RUT_DUYET_TRA_PHONG" } }),
    AuditLog.findOne({ where: { action: "MOVE_OUT_APPROVAL_REVOKED", entity_id: created.body.data.ma_yeu_cau } }),
  ]);
  assert.equal(requestAfter.trang_thai, "DA_RUT");
  assert.equal(roomAfter.trang_thai, "DANG_THUE");
  assert.ok(notice);
  assert.ok(audit);

  const rollbackRental = await createFreshRental(landlord, "revoke-rollback");
  const rollbackRequest = await createMoveOut(rollbackRental, "2027-02-20");
  assert.equal((await approveMoveOut(landlord, rollbackRequest.body.data.ma_yeu_cau)).response.status, 200);
  await assert.rejects(
    moveOutRequestService.revoke(rollbackRequest.body.data.ma_yeu_cau, "Kiểm tra rollback", null),
    (error) => error.code === "INVALID_AUDIT_LOG",
  );
  assert.equal((await YeuCau.findByPk(rollbackRequest.body.data.ma_yeu_cau)).trang_thai, "DA_PHE_DUYET");
  assert.equal(await ThongBao.count({ where: { ma_tai_khoan: rollbackRental.account.ma_tai_khoan, loai_thong_bao: "RUT_DUYET_TRA_PHONG" } }), 0);
});

test("BR-45 requires a reason for early approval and blocks revoke after liquidation", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "early-move-out");
  const created = await createMoveOut(fresh, "2026-10-20");
  const rejected = await approveMoveOut(landlord, created.body.data.ma_yeu_cau);
  assert.equal(rejected.response.status, 422, JSON.stringify(rejected.body));
  assert.equal(rejected.body.error?.code, "EARLY_MOVE_OUT_REASON_REQUIRED");
  const approved = await approveMoveOut(landlord, created.body.data.ma_yeu_cau, { earlyReturnReason: "Chủ trọ chấp thuận trả sớm" });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  await HopDong.update({ trang_thai: "DA_THANH_LY", ngay_thanh_ly: "2026-10-15" }, { where: { ma_hop_dong: fresh.contract.ma_hop_dong } });
  const blocked = await request(`/api/v1/requests/${created.body.data.ma_yeu_cau}/revoke`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify({ reason: "Không hợp lệ sau thanh lý" }),
  });
  assert.equal(blocked.response.status, 409, JSON.stringify(blocked.body));
  assert.equal(blocked.body.error?.code, "MOVE_OUT_ALREADY_SETTLED");
});
