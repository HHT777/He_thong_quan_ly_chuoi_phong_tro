const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sequelize = require("../src/config/database");
const models = require("../src/models");
const ownership = require("../src/services/ownership.service");
const { getTenantDeposit } = require("../src/services/tenantDeposit.service");

const id = crypto.randomUUID();
const user = { vai_tro: "KHACH_THUE", ma_khach_thue: "tenant-a" };
function fixture(t) {
  const state = {
    calls: [],
    contract: { ma_hop_dong: id, ma_khach_thue: "tenant-a", ma_phong: "room-a", khachThue: { ma_khach_thue: "tenant-a" }, phongTro: { ma_phong: "room-a", ma_can: "building-a", canTro: { ma_can: "building-a" } } },
    deposit: { ma_tien_coc: "deposit-a", ma_hop_dong: id, so_tien_coc: "2000000.00", ngay_nhan_coc: "2026-10-01", trang_thai: "DA_NHAN", so_tien_da_hoan: "0.00", so_tien_da_khau_tru: "0.00", internal: "private" },
    settlement: null, deductions: [], refunds: [],
  };
  t.mock.method(sequelize, "transaction", async (options, callback) => { assert.equal(options.readOnly, true); return callback({}); });
  t.mock.method(ownership, "assertOwned", async (actor, type, target) => {
    state.calls.push("guard"); assert.equal(actor, user); assert.equal(type, "contract");
    if (target !== id) throw ownership.notFoundError();
  });
  t.mock.method(models.HopDong, "findByPk", async () => { state.calls.push("contract"); return state.contract; });
  t.mock.method(models.TienCoc, "findOne", async (options) => { assert.deepEqual(options.where, { ma_hop_dong: id }); return state.deposit; });
  t.mock.method(models.BienBanTraPhong, "findOne", async (options) => { assert.deepEqual(options.where, { ma_hop_dong: id }); return state.settlement; });
  t.mock.method(models.KhoanKhauTru, "findAll", async (options) => { assert.deepEqual(options.where, { ma_bien_ban_tra_phong: "report-a" }); return state.deductions; });
  t.mock.method(models.GiaoDichHoanCoc, "findAll", async (options) => { assert.deepEqual(options.where, { ma_bien_ban_tra_phong: "report-a", ma_tien_coc: "deposit-a" }); return state.refunds; });
  return state;
}
const report = () => ({ ma_bien_ban: "report-a", ma_hop_dong: id, ngay_quyet_toan: "2026-10-15", la_du_lieu_legacy: false, tien_coc_ban_dau: "2000000.00", tien_phong_tra_truoc_duoc_hoan: "500000.00", tong_khoan_khau_tru: "100000.00", so_tien_coc_duoc_hoan: "2400000.00", gia_tri_quyet_toan_rong: "2400000.00", so_tien_no_sau_thanh_ly: "0.00", snapshot_json: { secret: "private" }, nguoi_lap_id: "owner-a" });

test("KT-04 scope guard runs before deposit reads and rejects another contract", async (t) => {
  const state = fixture(t);
  await getTenantDeposit(user, id);
  assert.deepEqual(state.calls, ["guard", "contract"]);
  state.calls.length = 0;
  await assert.rejects(getTenantDeposit(user, crypto.randomUUID()), { status: 404, code: "RESOURCE_NOT_FOUND" });
  assert.deepEqual(state.calls, ["guard"]);
});

test("KT-04 tenant deposit role and malformed ID fail before starting a read", async (t) => {
  const state = fixture(t);
  await assert.rejects(getTenantDeposit({ vai_tro: "CHU_TRO" }, id), { status: 403 });
  await assert.rejects(getTenantDeposit(user, "not-a-contract"), { status: 404, code: "RESOURCE_NOT_FOUND" });
  assert.deepEqual(state.calls, []);
});

test("KT-04 missing tenant-room-building chain or foreign deposit/report fails closed", async (t) => {
  const state = fixture(t);
  const original = structuredClone(state);
  for (const modify of [
    () => { state.contract = null; },
    () => { state.contract.khachThue.ma_khach_thue = "tenant-b"; },
    () => { state.contract.phongTro.ma_phong = "room-b"; },
    () => { state.contract.phongTro.canTro.ma_can = "building-b"; },
    () => { state.deposit.ma_hop_dong = "contract-b"; },
    () => { state.settlement = { ...report(), ma_hop_dong: "contract-b" }; },
  ]) {
    Object.assign(state, structuredClone(original)); modify();
    await assert.rejects(getTenantDeposit(user, id), { status: 404, code: "RESOURCE_NOT_FOUND" });
  }
});

test("KT-04 child relationships exclude mismatched refund and deduction rows", async (t) => {
  const state = fixture(t); state.settlement = report();
  state.deductions = [{ ma_bien_ban_tra_phong: "report-b", ly_do: "foreign deduction", so_tien: "1" }];
  state.refunds = [
    { ma_bien_ban_tra_phong: "report-a", ma_tien_coc: "deposit-b", so_tien: "2", ngay_hoan: "2026-10-15" },
    { ma_bien_ban_tra_phong: "report-b", ma_tien_coc: "deposit-a", so_tien: "3", ngay_hoan: "2026-10-15" },
  ];
  const dto = await getTenantDeposit(user, id);
  assert.deepEqual(dto.deductions, []); assert.deepEqual(dto.refunds, []);
  assert.ok(dto.dataWarnings.includes("RELATED_RECORDS_UNAVAILABLE"));
  assert.doesNotMatch(JSON.stringify(dto), /foreign deduction|deposit-b|report-b/);
});

test("KT-04 response whitelist preserves stored amounts including abnormal refunds without internal fields", async (t) => {
  const state = fixture(t); state.settlement = report();
  state.deposit.so_tien_da_hoan = "2400000.00"; state.deposit.so_tien_da_khau_tru = "100000.00";
  state.deductions = [{ ma_bien_ban_tra_phong: "report-a", loai_khau_tru: "KHAC", ly_do: "Lý do", so_tien: "100000.00", ghi_chu: null, ma_tai_san: "private-asset" }];
  state.refunds = [{ ma_bien_ban_tra_phong: "report-a", ma_tien_coc: "deposit-a", ngay_hoan: "2026-10-15", so_tien: "2400000.00", khoa_chong_trung: "private-key", nguoi_ghi_nhan_id: "private-owner" }];
  const dto = await getTenantDeposit(user, id);
  assert.deepEqual(Object.keys(dto).sort(), ["ma_hop_dong", "deposit", "settlement", "deductions", "refunds", "dataWarnings"].sort());
  assert.deepEqual(dto.deposit, { so_tien_coc: "2000000.00", ngay_nhan_coc: "2026-10-01", trang_thai: "DA_NHAN", so_tien_da_hoan: "2400000.00", so_tien_da_khau_tru: "100000.00" });
  assert.equal(dto.settlement.so_tien_coc_duoc_hoan, "2400000.00");
  assert.equal(dto.settlement.tien_phong_tra_truoc_duoc_hoan, "500000.00");
  assert.deepEqual(dto.refunds, [{ ngay_hoan: "2026-10-15", so_tien: "2400000.00" }]);
  assert.deepEqual(dto.deductions, [{ loai_khau_tru: "KHAC", ly_do: "Lý do", so_tien: "100000.00", ghi_chu: null }]);
  assert.doesNotMatch(JSON.stringify(dto), /internal|private|snapshot_json|nguoi_lap_id|ma_tien_coc|ma_bien_ban/);
});

test("KT-04 absent deposit, zero amount and unreceived records remain distinct", async (t) => {
  const state = fixture(t); const original = state.deposit;
  state.deposit = null;
  assert.equal((await getTenantDeposit(user, id)).deposit, null);
  state.deposit = { ...original, so_tien_coc: "0.00", trang_thai: "CHUA_NHAN", ngay_nhan_coc: null };
  const dto = await getTenantDeposit(user, id);
  assert.equal(dto.deposit.so_tien_coc, "0.00"); assert.equal(dto.deposit.trang_thai, "CHUA_NHAN");
  assert.equal(dto.deposit.ngay_nhan_coc, null); assert.deepEqual(dto.dataWarnings, []);
});

test("KT-04 legacy totals do not fabricate refund events or missing settlement fields", async (t) => {
  const state = fixture(t);
  state.deposit.so_tien_da_hoan = "100000.00"; state.deposit.ngay_nhan_coc = null;
  state.settlement = { ...report(), la_du_lieu_legacy: true, tien_phong_tra_truoc_duoc_hoan: null };
  const dto = await getTenantDeposit(user, id);
  assert.equal(dto.deposit.so_tien_da_hoan, "100000.00"); assert.deepEqual(dto.refunds, []);
  assert.equal(dto.settlement.tien_phong_tra_truoc_duoc_hoan, null);
  assert.deepEqual(dto.dataWarnings, ["RECEIPT_DATA_INCOMPLETE", "REFUND_DETAILS_UNAVAILABLE", "LEGACY_SETTLEMENT", "SETTLEMENT_DATA_INCOMPLETE"]);
});
