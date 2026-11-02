const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const sequelize = require("../src/config/database");
const models = require("../src/models");
const config = require("../src/services/systemConfig.service");
const billing = require("../src/services/tenantBilling.service");
const bills = require("../src/services/khoanPhaiThu.service");
const payments = require("../src/services/thanhToan.service");
const user = { vai_tro: "KHACH_THUE", ma_khach_thue: "tenant-a", ma_tai_khoan: "account-a" };
const now = new Date("2026-10-06T01:00:00Z");
function fixture(t) {
  config.invalidateSystemConfigCache(); t.after(() => config.invalidateSystemConfigCache());
  t.mock.method(models.CauHinhHeThong, "findAll", async () => []);
  t.mock.method(sequelize, "transaction", async (options, callback) => { assert.equal(options.readOnly, true); return callback({}); });
}
const bill = (values = {}) => ({ ma_thanh_toan: "bill-a", ma_hop_dong: "contract-a", nam: 2026, thang: 10, loai_thanh_toan: "DINH_KY", da_gui: true,
  tong_phai_tra: "1000.00", tong_da_thanh_toan: "350.00", so_tien_con_no: "650.00", trang_thai: "THANH_TOAN_MOT_PHAN",
  hopDong: { ma_khach_thue: "tenant-a", khachThue: { cccd_giay_to: "PRIVATE" }, phongTro: { ma_phong: "room-a", ma_can: "building-a", so_phong: "A1", ghi_chu: "PRIVATE" } }, chiTiets: [], giaoDichs: [], ...values });
const payment = (values = {}) => ({ ma_giao_dich: "payment-a", ma_thanh_toan: "bill-a", so_tien: "300.00", nguon_thanh_toan: "THU_TIEN", trang_thai_xac_nhan: "DA_XAC_NHAN", ...values });

test("KT-05 summary scope and draft guard are applied to the database query", async (t) => {
  fixture(t);
  t.mock.method(models.ThanhToan, "findAll", async (options) => {
    assert.deepEqual(options.include[0].where, { ma_khach_thue: user.ma_khach_thue });
    assert.deepEqual(options.where, billing.visibilityWhere()); assert.equal(options.include[0].required, true);
    return [bill({ da_gui: false, so_tien_con_no: 999 })];
  });
  const dto = await billing.getSummary(user, { now });
  assert.equal(dto.current.count, 0); assert.equal(dto.totalRemainingDue, 0);
  await assert.rejects(billing.getSummary({ vai_tro: "CHU_TRO" }), { status: 403 });
});

test("KT-05 received cash excludes pending cancelled and deposit-offset transactions", async (t) => {
  fixture(t);
  const current = bill({ giaoDichs: [payment(), payment({ ma_giao_dich: "offset", so_tien: 50, nguon_thanh_toan: "KHAU_TRU_COC" }),
    payment({ ma_giao_dich: "pending", so_tien: null, trang_thai_xac_nhan: "CHO_XAC_NHAN" }), payment({ ma_giao_dich: "pending-amount", so_tien: 125, trang_thai_xac_nhan: "CHO_XAC_NHAN" }), payment({ ma_giao_dich: "cancelled", so_tien: 999, trang_thai_xac_nhan: "DA_HUY" }),
    payment({ ma_thanh_toan: "foreign-bill", so_tien: 888 })] });
  t.mock.method(models.ThanhToan, "findAll", async () => [current, bill({ thang: 9, so_tien_con_no: 400 }), bill({ thang: 11, so_tien_con_no: 777 }),
    bill({ loai_thanh_toan: "SAU_THANH_LY", da_gui: false, so_tien_con_no: 200 }), bill({ loai_thanh_toan: "SAU_THANH_LY", thang: 11, so_tien_con_no: 900 })]);
  const dto = await billing.getSummary(user, { now });
  assert.equal(dto.current.cashReceived, 300); assert.equal(dto.current.depositOffset, 50); assert.equal(dto.current.pendingCount, 2);
  assert.equal(dto.current.totalDue, 1000); assert.equal(dto.current.settledAmount, 350); assert.equal(dto.current.remainingAmount, 650);
  assert.equal(dto.oldDebt.remainingAmount, 400); assert.equal(dto.totalRemainingDue, 1050);
  assert.equal(dto.postLiquidationDebt.remainingAmount, 200); assert.equal(dto.postLiquidationDebt.bills.length, 1); assert.equal(dto.isOverdue, true);
});

test("KT-05 period and overdue use server Vietnam date, not cron flags or closed-debt snapshots", async (t) => {
  fixture(t);
  t.mock.method(models.ThanhToan, "findAll", async () => [bill({ qua_han: true, so_tien_chot_cong_no: 999999 })]);
  const day5 = await billing.getSummary(user, { now: new Date("2026-10-05T16:59:59Z") });
  const day6 = await billing.getSummary(user, { now: new Date("2026-10-05T17:00:00Z") });
  assert.equal(day5.currentPeriod, "2026-10"); assert.equal(day5.isOverdue, false); assert.equal(day6.isOverdue, true);
  assert.equal(day6.totalRemainingDue, 650);
  const next = await billing.getSummary(user, { now: new Date("2026-10-31T17:00:00Z") });
  assert.equal(next.currentPeriod, "2026-11"); assert.equal(next.current.remainingAmount, 0); assert.equal(next.oldDebt.remainingAmount, 650);
});

test("KT-05 response whitelist omits owner notes and sensitive fields while preserving signed historical lines", async (t) => {
  fixture(t);
  const row = bill({ ghi_chu: "PRIVATE", nguoi_gui_id: "PRIVATE", chiTiets: [
    { ma_thanh_toan: "bill-a", loai_khoan: "GIAM_TRU", so_tien: -123, dien_giai: "Giảm trừ", nguoi_thuc_hien_id: "PRIVATE" },
    { ma_thanh_toan: "other", loai_khoan: "TIEN_PHONG", so_tien: 999, dien_giai: "FOREIGN" },
  ], giaoDichs: [payment({ minh_chung_url: "PRIVATE", ly_do_huy: "PRIVATE", khoanThu: { ghi_chu: "PRIVATE" } })] });
  const dto = billing.billView(row, await billing.readContext(now));
  assert.equal(dto.chiTiets.length, 1); assert.equal(dto.chiTiets[0].so_tien, -123);
  assert.doesNotMatch(JSON.stringify(dto), /PRIVATE|FOREIGN|cccd|nguoi_|minh_chung_url|khoanThu|ly_do_huy/);
  assert.equal(dto.tong_phai_tra, "1000.00"); assert.equal(dto.giaoDichs[0].so_tien, "300.00");
});

test("KT-05 legacy bill list enforces JWT identity even when caller spoofs the tenant filter", async (t) => {
  fixture(t);
  t.mock.method(models.ThanhToan, "findAndCountAll", async (options) => {
    assert.equal(options.include[0].where.ma_khach_thue, "tenant-a");
    assert.deepEqual(options.where[Op.or], [{ loai_thanh_toan: "DINH_KY", da_gui: true }, { loai_thanh_toan: "SAU_THANH_LY" }]);
    return { count: 1, rows: [bill()] };
  });
  const result = await bills.getKhoanPhaiThuList({ ma_khach_thue: "tenant-b", issuance: "DRAFT" }, { limit: 20, offset: 0 }, user);
  assert.equal(result.count, 1); assert.equal(result.data[0].hopDong.khachThue, undefined);
});

test("KT-05 payment list filters draft parents and JWT identity before pagination", async (t) => {
  fixture(t);
  t.mock.method(models.GiaoDichThanhToan, "findAndCountAll", async (options) => {
    assert.deepEqual(options.include[0].where, billing.visibilityWhere());
    assert.deepEqual(options.include[0].include[0].where, { ma_khach_thue: "tenant-a" });
    return { count: 1, rows: [payment({ minh_chung_url: "PRIVATE" })] };
  });
  const dto = await payments.getThanhToanList({ ma_khach_thue: "tenant-b" }, { limit: 20, offset: 0 }, user);
  assert.doesNotMatch(JSON.stringify(dto), /PRIVATE|minh_chung_url/);
});

test("KT-05 draft bill and draft payment detail are opaque 404 while post-liquidation detail stays readable", async (t) => {
  fixture(t); const row = bill({ da_gui: false });
  t.mock.method(models.ThanhToan, "findByPk", async () => row);
  t.mock.method(models.GiaoDichThanhToan, "findByPk", async () => ({ ...payment(), thanhToan: row }));
  await assert.rejects(bills.getKhoanPhaiThuById("bill-a", user), { status: 404, code: "RESOURCE_NOT_FOUND" });
  await assert.rejects(payments.getThanhToanById("payment-a", user), { status: 404, code: "RESOURCE_NOT_FOUND" });
  row.loai_thanh_toan = "SAU_THANH_LY";
  assert.equal((await bills.getKhoanPhaiThuById("bill-a", user)).loai_thanh_toan, "SAU_THANH_LY");
});

test("KT-05 debt projection excludes future and foreign bills without replacing stored remaining values", async (t) => {
  fixture(t);
  const rows = [bill(), bill({ thang: 11 }), bill({ hopDong: { ma_khach_thue: "tenant-b" } }), bill({ da_gui: false })];
  const dto = await billing.debtViews(rows, user, now);
  assert.equal(dto.length, 1); assert.equal(dto[0].so_tien_con_no, "650.00");
  t.mock.method(models.ThanhToan, "findAll", async () => []);
  const empty = await billing.getSummary(user, { now });
  assert.equal(empty.totalRemainingDue, 0); assert.deepEqual(empty.postLiquidationDebt.bills, []);
});

test("KT-05 landlord paginated bill SQL retains the root period order and bill-level limit", async (t) => {
  t.mock.method(models.ChuTro, "findOne", async () => ({ ma_chu_tro: "owner-a" }));
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: "building-a" }, { ma_can: "building-a2" }]);
  const queries = [];
  // Keep Sequelize's real include, field mapping, count and pagination SQL generation.
  // Only the final transport is replaced: this test cannot open a DB connection.
  t.mock.method(sequelize, "query", async (sql, options) => {
    queries.push(sql);
    return options.plain ? { count: 0 } : [];
  });
  await bills.getKhoanPhaiThuList({ ky: "2026-10" }, { limit: 20, offset: 0 }, { vai_tro: "CHU_TRO", ma_tai_khoan: "owner-account-a" });
  const sql = queries.find((query) => query.includes(" LIMIT "));
  assert.ok(sql, "exercise the actual paginated SELECT, not just count or detail");
  const [inner, outer] = sql.split(") AS `ThanhToan`");
  assert.ok(outer, "has-many lines/payments must keep bill-level subquery pagination");
  assert.match(inner, /`nam` DESC/);
  assert.match(inner, /`thang` DESC/);
  assert.match(inner, /LIMIT 0, 20/);
});
