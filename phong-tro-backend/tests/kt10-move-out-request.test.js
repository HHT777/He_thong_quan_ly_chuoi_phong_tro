const test = require("node:test"), assert = require("node:assert/strict");
const service = require("../src/services/moveOutRequest.service");
const models = require("../src/models"), db = require("../src/config/database");
const { findContractRequest, assertNoConflict } = require("../src/services/requestConflict.service");

test("KT10 calendar validation enforces Vietnam sent-day +30, real dates and current contract end", () => {
  const c = { ngay_ket_thuc: "2026-12-31" }, sent = new Date("2026-10-28T17:01:00Z"), options = { today: "2026-10-29" };
  for (const day of ["2026-11-28", "2026-11-29"]) assert.doesNotThrow(() => service.validateDate(day, c, sent, "", options));
  assert.throws(() => service.validateDate("2026-11-27", c, sent, "", options), { status: 400, code: "EARLY_MOVE_OUT_REASON_REQUIRED" });
  assert.doesNotThrow(() => service.validateDate("2026-11-27", c, sent, "Xin ngoại lệ", options));
  assert.doesNotThrow(() => service.validateDate("2026-10-29", c, sent, "Chủ trọ xem xét", options));
  for (const day of [null, "", "2026-2-01", "2026-02-30", "31/10/2026", "2026-10-30T00:00:00Z"]) assert.throws(() => service.validateDate(day, c, sent, "Lý do", options), { code: "INVALID_MOVE_OUT_DATE" });
  assert.throws(() => service.validateDate("2026-10-28", c, sent, "Lý do", options), { code: "MOVE_OUT_DATE_IN_PAST" });
  assert.throws(() => service.validateDate("2027-01-01", c, sent, "Lý do", options), { code: "MOVE_OUT_AFTER_CONTRACT_END" });
  assert.throws(() => service.validateDate("2026-11-27", c, sent, "", { ...options, approval: true }), { status: 409 });
  assert.equal(service.validDate("2028-02-29"), true); assert.equal(service.validDate("2027-02-29"), false);
});

test("KT10 input whitelist rejects scope injection empty content invalid aliases and overlong reasons", () => {
  const good = { type: "TRA_PHONG", contractId: "own", content: "Move out", date: "2026-11-30" };
  assert.doesNotThrow(() => service.validatePayload(good));
  for (const patch of [{ contractId: "" }, { tenantId: "other" }, { roomId: "other" }, { minimumNormalMoveOutDate: "2000-01-01" }, { content: " " }, { content: "x".repeat(1001) }, { earlyReturnReason: 12 }, { earlyReturnReason: "x".repeat(1001) }, { expectedMoveOutDate: "2026-12-01" }]) assert.throws(() => service.validatePayload({ ...good, ...patch }), { status: 400 });
});

function fixture(t, { move = null, renewal = null } = {}) {
  let writes = 0, contractLocked = false;
  const tx = { LOCK: { UPDATE: "UPDATE" } }, today = service.dateOnly();
  t.mock.method(db, "query", async () => { throw Error("Unexpected DB I/O in KT10 unit test"); });
  t.mock.method(db, "transaction", async (fn) => fn(tx));
  const room = { ma_phong: "room", ma_can: "building", trang_thai: "DANG_THUE", canTro: { ten_can: "Căn" } };
  const contract = { ma_hop_dong: "own", ma_khach_thue: "tenant", ma_phong: "room", ngay_ket_thuc: service.addDays(today, 90), trang_thai: "DANG_HIEU_LUC", phongTro: room };
  t.mock.method(models.HopDong, "findByPk", async (_id, o = {}) => { if (o.lock) contractLocked = true; return contract; });
  t.mock.method(models.PhongTro, "findByPk", async () => room);
  t.mock.method(models.BienBanTraPhong, "findOne", async () => null);
  t.mock.method(models.YeuCauTraPhong, "findAll", async () => move ? [{ ma_yeu_cau: "move" }] : []);
  t.mock.method(models.YeuCauGiaHan, "findAll", async () => renewal ? [{ ma_yeu_cau: "renewal" }] : []);
  t.mock.method(models.YeuCau, "findOne", async (o) => {
    assert.equal(contractLocked, true, "write conflict reads must follow parent lock");
    const status = o.where.loai_yeu_cau === "TRA_PHONG" ? move : renewal;
    return status ? { ma_yeu_cau: "existing", trang_thai: status } : null;
  });
  t.mock.method(models.YeuCau, "create", async () => { writes++; return { ma_yeu_cau: "new" }; });
  t.mock.method(models.YeuCauTraPhong, "create", async () => { writes++; });
  t.mock.method(models.AuditLog, "create", async () => { writes++; });
  return { contract, tx, today, writes: () => writes, user: { vai_tro: "KHACH_THUE", ma_khach_thue: "tenant", ma_tai_khoan: "account" }, body: { type: "TRA_PHONG", contractId: "own", date: service.addDays(today, 30), content: "Request" } };
}
for (const state of ["CHO_XU_LY", "DA_PHE_DUYET"]) {
  test(`KT10 duplicate ${state} cannot create request audit or notice`, async (t) => {
    const f = fixture(t, { move: state });
    await assert.rejects(service.create(f.user, f.body), { code: "MOVE_OUT_ALREADY_PENDING_OR_APPROVED" }); assert.equal(f.writes(), 0);
  });
  test(`KT10 pending or approved renewal ${state} blocks move-out creation`, async (t) => {
    const f = fixture(t, { renewal: state });
    await assert.rejects(service.create(f.user, f.body), { code: "CONTRACT_REQUEST_CONFLICT" }); assert.equal(f.writes(), 0);
  });
}
test("KT10 invalid move-out cannot create even if valid contract was selected", async (t) => {
  const f = fixture(t);
  await assert.rejects(service.create(f.user, { ...f.body, date: service.addDays(f.today, 29) }), { code: "EARLY_MOVE_OUT_REASON_REQUIRED" }); assert.equal(f.writes(), 0);
});
test("KT10 expired actual end date blocks creation despite stale active enum", async (t) => {
  const f = fixture(t); f.contract.ngay_ket_thuc = service.addDays(f.today, -1);
  await assert.rejects(service.create(f.user, f.body), { code: "CONTRACT_EXPIRED" }); assert.equal(f.writes(), 0);
});
test("KT10 move-out approval rechecks date and requires owner exception without tenant fallback", async (t) => {
  const f = fixture(t);
  t.mock.method(models.YeuCauTraPhong, "findOne", async () => ({ ma_hop_dong: "own", ngay_tra_du_kien: service.addDays(f.today, 1), ly_do_tra_som: "Tenant reason", update: async () => { throw Error("Must not update"); } }));
  await assert.rejects(service.approve({ request: { ma_yeu_cau: "r", ma_khach_thue: "tenant", ngay_gui: new Date() }, transaction: f.tx }), { status: 409, code: "EARLY_MOVE_OUT_REASON_REQUIRED" });
});
test("KT10 move-out blocks renewal conflict at approval too", async (t) => {
  const f = fixture(t, { renewal: "CHO_XU_LY" });
  t.mock.method(models.YeuCauTraPhong, "findOne", async () => ({ ma_hop_dong: "own", ngay_tra_du_kien: f.body.date }));
  await assert.rejects(service.approve({ request: { ma_yeu_cau: "r", ma_khach_thue: "tenant", ngay_gui: new Date() }, transaction: f.tx }), { code: "CONTRACT_REQUEST_CONFLICT" });
});
test("KT10 shared conflict guard uses current locking reads and both directions", async (t) => {
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(db, "query", async () => { throw Error("Unexpected DB I/O"); });
  for (const model of [models.YeuCauTraPhong, models.YeuCauGiaHan]) t.mock.method(model, "findAll", async (o) => { assert.equal(o.lock, tx.LOCK.UPDATE); return [{ ma_yeu_cau: "other" }]; });
  t.mock.method(models.YeuCau, "findOne", async (o) => { assert.equal(o.lock, tx.LOCK.UPDATE); return { ma_yeu_cau: "other" }; });
  for (const type of ["GIA_HAN", "TRA_PHONG"]) await assert.rejects(assertNoConflict("own", type, { transaction: tx }), { code: "CONTRACT_REQUEST_CONFLICT" });
  assert.ok(await findContractRequest("own", "GIA_HAN", { transaction: tx }));
});
test("KT10 revoke denies foreign and missing request identically before writes", async (t) => {
  const f = fixture(t); let exists = true;
  t.mock.method(models.YeuCau, "findByPk", async () => exists ? { ma_yeu_cau: "b", loai_yeu_cau: "TRA_PHONG", trang_thai: "DA_PHE_DUYET" } : null);
  t.mock.method(models.YeuCauTraPhong, "findOne", async () => ({ hopDong: { phongTro: { ma_can: "foreign" } } }));
  t.mock.method(models.ChuTro, "findOne", async () => ({ ma_chu_tro: "a" }));
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: "a" }]);
  for (const value of [true, false]) { exists = value; await assert.rejects(service.revoke("b", "Reason", "owner-a"), { status: 404, code: "RESOURCE_NOT_FOUND" }); }
  assert.equal(f.writes(), 0);
});
