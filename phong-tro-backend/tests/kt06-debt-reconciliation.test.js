const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const models = require("../src/models");
const sequelize = require("../src/config/database");
const config = require("../src/services/systemConfig.service");
const debt = require("../src/services/debtLifecycle.service");
const billing = require("../src/services/tenantBilling.service");
const router = require("../src/routes/mvp.routes");
const user = { vai_tro: "KHACH_THUE", ma_tai_khoan: "account-a", ma_khach_thue: "tenant-a" };
const handler = (path) => router.stack.find((layer) => layer.route?.path === path && layer.route.methods.get).route.stack.at(-1).handle;
async function invoke(path, extra = {}) {
  let body; let error;
  const res = { status() { return this; }, json(value) { body = value; return this; } };
  await handler(path)({ user, query: {}, body: {}, headers: {}, ...extra }, res, (value) => { error = value; });
  return { body, error };
}

test("KT-06 debt route always forwards JWT tenant scope instead of body or header identities", async (t) => {
  t.mock.method(debt, "listDebt", async (options) => {
    assert.equal(options.tenantId, "tenant-a", "database read must be scoped before fetching rows");
    assert.equal(options.requester, user); return [];
  });
  t.mock.method(billing, "debtViews", async (rows, principal) => { assert.equal(principal, user); return rows; });
  for (const hint of ["tenantId", "khachThueId", "ma_khach_thue"]) {
    const result = await invoke("/debt", { body: { [hint]: "tenant-b" }, headers: { [hint.toLowerCase()]: "tenant-b", "x-tenant-id": "tenant-b" } });
    assert.equal(result.error, undefined); assert.deepEqual(result.body.data, []);
  }
});

test("KT-06 scope query hints are rejected before any debt or me-summary read", async (t) => {
  t.mock.method(debt, "listDebt", async () => assert.fail("query must not reach debt service"));
  t.mock.method(billing, "getSummary", async () => assert.fail("query/body must not reach summary service"));
  for (const hint of ["tenantId", "khachThueId", "ma_khach_thue"]) {
    for (const path of ["/debt", "/me/billing-summary"]) {
      const result = await invoke(path, { query: { [hint]: "tenant-b" } });
      assert.equal(result.error?.status, 400, `${path} must reject ${hint}`); assert.equal(result.body, undefined);
    }
    assert.equal((await invoke("/me/billing-summary", { body: { [hint]: "tenant-b" } })).error?.status, 400);
  }
});

function fixture(t) {
  config.invalidateSystemConfigCache(); t.after(() => config.invalidateSystemConfigCache());
  t.mock.method(models.CauHinhHeThong, "findAll", async () => []);
  t.mock.method(sequelize, "transaction", async (options, callback) => { assert.equal(options.readOnly, true); return callback({}); });
}
const row = (id, month, total, paid = 0, extra = {}) => ({ ma_thanh_toan: id, ma_hop_dong: "contract-a", nam: 2026, thang: month, loai_thanh_toan: "DINH_KY", da_gui: true,
  tong_phai_tra: total, tong_da_thanh_toan: paid, so_tien_con_no: total - paid, so_tien_chot_cong_no: total,
  trang_thai: total === paid ? "DA_THANH_TOAN" : paid ? "THANH_TOAN_MOT_PHAN" : "CHUA_THANH_TOAN",
  hopDong: { ma_khach_thue: "tenant-a", phongTro: { ma_phong: "room-a", ma_can: "building-a" } }, giaoDichs: [], ...extra });
const payment = (amount, state = "DA_XAC_NHAN", source = "THU_TIEN") => ({ ma_thanh_toan: "oct", so_tien: amount, trang_thai_xac_nhan: state, nguon_thanh_toan: source });

test("KT-06 remaining amounts reconcile across period rollover while paid bills and post debt intentionally differ", async (t) => {
  fixture(t);
  const rows = [row("oct", 10, 900, 200, { giaoDichs: [payment(100), payment(100, "DA_XAC_NHAN", "KHAU_TRU_COC"), payment(null, "CHO_XAC_NHAN"), payment(125, "CHO_XAC_NHAN"), payment(99, "DA_HUY")] }),
    row("old", 9, 400), row("paid", 10, 500, 500, { giaoDichs: [{ ...payment(500), ma_thanh_toan: "paid" }] }),
    row("future", 11, 777), row("post", 9, 200, 0, { loai_thanh_toan: "SAU_THANH_LY", da_gui: false }), row("draft", 9, 999, 0, { da_gui: false }),
    row("foreign", 10, 555, 0, { hopDong: { ma_khach_thue: "tenant-b" } })];
  t.mock.method(models.ThanhToan, "findAll", async (options) => {
    assert.equal(options.include[0].where.ma_khach_thue, "tenant-a");
    return rows.filter((r) => r.hopDong.ma_khach_thue === "tenant-a" && billing.isVisible(r)
      && (!options.where.so_tien_con_no || r.so_tien_con_no > options.where.so_tien_con_no[Op.gt]))
      .map((r) => ({ ...r, toJSON: () => structuredClone(r) }));
  });
  for (const [instant, current, old, total] of [["2026-10-31T16:59:59Z", 700, 400, 1100], ["2026-10-31T17:00:00Z", 777, 1100, 1877]]) {
    const now = new Date(instant);
    const summary = await billing.getSummary(user, { now });
    const raw = await debt.listDebt({ tenantId: user.ma_khach_thue, requester: user, now });
    const projected = await billing.debtViews(raw, user, now);
    assert.equal(summary.current.remainingAmount, current); assert.equal(summary.oldDebt.remainingAmount, old);
    assert.equal(summary.totalRemainingDue, total); assert.equal(summary.postLiquidationDebt.remainingAmount, 200);
    assert.equal(projected.filter((r) => r.loai_thanh_toan === "DINH_KY").reduce((sum, r) => sum + Number(r.so_tien_con_no), 0), total);
    assert.ok(!projected.some((r) => ["paid", "draft", "foreign"].includes(r.ma_thanh_toan)));
    assert.equal(projected.find((r) => r.ma_thanh_toan === "oct").so_tien_con_no, 700);
    assert.doesNotMatch(JSON.stringify(projected), /so_tien_chot_cong_no/);
    if (current === 700) { assert.equal(summary.current.totalDue, 1400); assert.equal(summary.current.cashReceived, 600); assert.equal(summary.current.depositOffset, 100); assert.equal(summary.current.pendingCount, 2); }
  }
});

test("KT-06 debt projection excludes hidden drafts future and foreign rows before reconciliation", async (t) => {
  fixture(t);
  const result = await billing.debtViews([row("own", 10, 700), row("draft", 9, 999, 0, { da_gui: false }), row("future", 11, 888), row("other", 9, 444, 0, { hopDong: { ma_khach_thue: "tenant-b" } })], user, new Date("2026-10-29T01:00:00Z"));
  assert.deepEqual(result.map((r) => r.ma_thanh_toan), ["own"]);
});
