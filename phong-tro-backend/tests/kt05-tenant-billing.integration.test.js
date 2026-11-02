const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sequelize = require("../src/config/database");
const { TaiKhoan, ChuTro, HopDong, TienCoc, ThanhToan, ChiTietThanhToan, GiaoDichThanhToan, KhoanThu } = require("../src/models");
const { businessDate } = require("../src/utils/businessDate.util");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

async function snapshot() {
  const result = {};
  for (const model of Object.values(sequelize.models)) {
    const rows = await model.findAll({ raw: true });
    rows.sort((a, b) => String(a[model.primaryKeyAttribute]).localeCompare(String(b[model.primaryKeyAttribute])));
    result[model.name] = crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  }
  return result;
}
const shape = (r) => ({ status: r.response.status, code: r.body.error?.code || r.body.code, message: r.body.error?.message || r.body.message, keys: Object.keys(r.body).sort(), errorKeys: Object.keys(r.body.error || {}).sort() });
const root = "/api/khoan-phai-thu";
const summaryPath = "/api/v1/me/billing-summary";
async function read(token, path) {
  const before = await snapshot();
  const result = await request(path, { headers: headers(token) });
  assert.deepEqual(await snapshot(), before, `Read must not write any table: ${path}`);
  return result;
}
const ids = (response) => response.body.data.map((row) => row.ma_thanh_toan);

test("KT-05 billing scopes, stored money, hidden drafts, read-only snapshots and owner regression", async (t) => {
  // Isolate the list/count/sort assertions from the runner's existing landlord bills.
  const ownerAName = `kt05a${Date.now()}`.slice(0, 15);
  const ownerAAccount = await TaiKhoan.create({ ten_dang_nhap: ownerAName, mat_khau: "Kt05OwnerA123", vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  await ChuTro.create({ ma_tai_khoan: ownerAAccount.ma_tai_khoan, ho_ten: "KT05 owner A", so_dien_thoai: "0987654396" });
  const ownerA = await login({ username: ownerAName, password: "Kt05OwnerA123" });
  const ownerAId = ownerAAccount.ma_tai_khoan;
  const username = `kt05b${Date.now()}`.slice(0, 15);
  const account = await TaiKhoan.create({ ten_dang_nhap: username, mat_khau: "Kt05OwnerB123", vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  await ChuTro.create({ ma_tai_khoan: account.ma_tai_khoan, ho_ten: "KT05 owner B", so_dien_thoai: "0987654397" });
  const ownerB = await login({ username, password: "Kt05OwnerB123" });
  const a = await createFreshRental(ownerA, "kt05-a");
  const b = await createFreshRental(ownerA, "kt05-b");
  const c = await createFreshRental(ownerB, "kt05-c");
  const empty = await createFreshRental(ownerA, "kt05-empty");
  // Reverse insertion order so paging must sort rooms before LIMIT, not after it.
  await sequelize.models.PhongTro.update({ so_phong: "KT05-Z" }, { where: { ma_phong: a.room.ma_phong } });
  await sequelize.models.PhongTro.update({ so_phong: "KT05-A" }, { where: { ma_phong: b.room.ma_phong } });
  const [year, month] = businessDate().split("-").map(Number);
  const period = (offset) => { const d = new Date(Date.UTC(year, month - 1 + offset, 1)); return { nam: d.getUTCFullYear(), thang: d.getUTCMonth() + 1 }; };
  async function bill(contract, offset, total, { paid = 0, sent = true, type = "DINH_KY", lines } = {}) {
    const row = await ThanhToan.create({ ma_hop_dong: contract.ma_hop_dong, ...period(offset), loai_thanh_toan: type, tong_phai_tra: total, tong_da_thanh_toan: paid, so_tien_con_no: total - paid, trang_thai: total === paid ? "DA_THANH_TOAN" : paid ? "THANH_TOAN_MOT_PHAN" : "CHUA_THANH_TOAN", da_gui: sent, ngay_gui: sent ? new Date() : null });
    for (const [kind, amount] of lines || [["TIEN_PHONG", total]]) {
      await ChiTietThanhToan.create({ ma_thanh_toan: row.ma_thanh_toan, loai_khoan: kind, so_tien: amount, dien_giai: '<img src=x onerror="alert(1)"> stored line', nguoi_thuc_hien_id: ownerAId });
    }
    return row;
  }
  const current = await bill(a.contract, 0, 1000, { paid: 350, lines: [["TIEN_PHONG", 1130], ["GIAM_TRU", -100], ["DIEU_CHINH_GIAM", -30]] });
  const old = await bill(a.contract, -1, 400);
  const future = await bill(a.contract, 1, 777);
  const draft = await bill(a.contract, -2, 999, { sent: false });
  const post = await bill(a.contract, 0, 200, { sent: false, type: "SAU_THANH_LY" });
  const postFuture = await bill(a.contract, 1, 900, { sent: false, type: "SAU_THANH_LY" });
  const foreign = await bill(b.contract, 0, 5555);
  const otherOwner = await bill(c.contract, 0, 6666);
  const shared = await HopDong.create({ ...c.contract, ma_hop_dong: crypto.randomUUID(), ma_khach_thue: a.tenant.ma_khach_thue, ngay_bat_dau: "2025-01-01", ngay_ket_thuc: "2025-12-31", ngay_thanh_ly: "2025-12-31", trang_thai: "DA_THANH_LY" });
  await TienCoc.create({ ma_hop_dong: shared.ma_hop_dong, so_tien_coc: 0, trang_thai: "CHUA_NHAN", ngay_nhan_coc: null, so_tien_da_hoan: 0, so_tien_da_khau_tru: 0 });
  const sharedBill = await bill(shared, -1, 7000);
  const payment = (parent, amount, state, source = "THU_TIEN") => GiaoDichThanhToan.create({ ma_thanh_toan: parent.ma_thanh_toan, so_tien: amount, trang_thai_xac_nhan: state, nguon_thanh_toan: source, thoi_diem_xac_nhan: state === "CHO_XAC_NHAN" ? null : new Date(), minh_chung_url: "PRIVATE-evidence", ...(state === "DA_HUY" ? { ngay_huy: new Date(), nguoi_huy_id: ownerAId, ly_do_huy: "PRIVATE-owner-note" } : {}) });
  const cash = await payment(current, 300, "DA_XAC_NHAN");
  await payment(current, 50, "DA_XAC_NHAN", "KHAU_TRU_COC");
  await payment(current, null, "CHO_XAC_NHAN");
  await payment(current, 125, "CHO_XAC_NHAN");
  await payment(current, 75, "DA_HUY");
  const draftPayment = await payment(draft, null, "CHO_XAC_NHAN");
  const foreignPayment = await payment(foreign, null, "CHO_XAC_NHAN");
  const otherPayment = await payment(otherOwner, null, "CHO_XAC_NHAN");
  await KhoanThu.create({ loai_khoan_thu: "THANH_TOAN", so_tien: 300, ngay_ghi_nhan: businessDate(), ghi_chu: "PRIVATE-owner-note", trang_thai_ghi_nhan: "HIEU_LUC", ma_giao_dich_thanh_toan: cash.ma_giao_dich, ma_can: a.building.ma_can, doanh_thu_gop: 300, giam_tru_phan_bo: 0, nguon_snapshot: "GHI_NHAN" });

  await t.test("summary keeps cash, deposit, pending, old, future and post-liquidation separate", async () => {
    const result = await read(a.tenantToken, summaryPath);
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    const dto = result.body.data;
    assert.equal(dto.current.totalDue, 1000); assert.equal(dto.current.cashReceived, 300);
    assert.equal(dto.current.depositOffset, 50); assert.equal(dto.current.settledAmount, 350);
    assert.equal(dto.current.pendingCount, 2); assert.equal(dto.current.remainingAmount, 650);
    assert.equal(dto.oldDebt.remainingAmount, 7400); assert.equal(dto.totalRemainingDue, 8050);
    assert.equal(dto.postLiquidationDebt.remainingAmount, 200); assert.deepEqual(dto.postLiquidationDebt.bills.map((row) => row.ma_thanh_toan), [post.ma_thanh_toan]);
    assert.equal(dto.oldDebt.isOverdue, true); assert.equal(dto.isOverdue, true);
    assert.doesNotMatch(JSON.stringify(dto), /PRIVATE|so_tien_chot_cong_no|nguoi_gui_id|cccd/);
    assert.equal((await read(ownerA, summaryPath)).response.status, 403);
    assert.equal((await read(a.tenantToken, `${summaryPath}?tenantId=${b.tenant.ma_khach_thue}`)).response.status, 400);
  });

  await t.test("foreign and missing bills and payments have identical opaque 404 responses", async () => {
    for (const [suffix, candidates] of [["", [foreign.ma_thanh_toan, otherOwner.ma_thanh_toan]], ["/payment", [foreignPayment.ma_giao_dich, otherPayment.ma_giao_dich]]]) {
      const absent = await read(a.tenantToken, `${root}${suffix}/${crypto.randomUUID()}`);
      assert.equal(absent.response.status, 404); assert.equal(shape(absent).code, "RESOURCE_NOT_FOUND");
      for (const id of candidates) assert.deepEqual(shape(await read(a.tenantToken, `${root}${suffix}/${id}`)), shape(absent));
    }
  });

  await t.test("drafts stay hidden on every tenant bill payment overdue debt and summary read", async () => {
    for (const path of [root, `${root}?issuance=DRAFT`, `${root}/list/overdue`, `${root}/khach-thue/${a.tenant.ma_khach_thue}`, "/api/v1/debt"]) {
      const result = await read(a.tenantToken, path); assert.equal(result.response.status, 200, JSON.stringify(result.body));
      assert.ok(!ids(result).includes(draft.ma_thanh_toan), path);
      assert.ok(!ids(result).includes(foreign.ma_thanh_toan), path);
      assert.doesNotMatch(JSON.stringify(result.body.data), /PRIVATE|nguoi_thuc_hien_id|cccd_giay_to|nguoi_gui_id|so_tien_chot_cong_no/);
    }
    assert.equal((await read(a.tenantToken, `${root}/${draft.ma_thanh_toan}`)).response.status, 404);
    assert.equal((await read(a.tenantToken, `${root}/payment/${draftPayment.ma_giao_dich}`)).response.status, 404);
    const list = await read(a.tenantToken, `${root}/payment/list?ma_thanh_toan=${draft.ma_thanh_toan}`);
    assert.equal(list.body.pagination.total, 0); assert.deepEqual(list.body.data, []);
    const all = await read(a.tenantToken, `${root}/payment/list`);
    assert.equal(all.body.data.length, 5); assert.doesNotMatch(JSON.stringify(all.body.data), /PRIVATE|minh_chung_url|ly_do_huy|nguoi_huy_id/);
    for (const path of ["/api/v1/debt", `${root}/khach-thue/${a.tenant.ma_khach_thue}`]) {
      const result = await read(a.tenantToken, path);
      assert.ok(!ids(result).includes(future.ma_thanh_toan)); assert.ok(!ids(result).includes(postFuture.ma_thanh_toan));
      assert.ok(ids(result).includes(post.ma_thanh_toan));
    }
  });

  await t.test("stored signed lines, pending null amounts, multiple contracts and pagination are retained", async () => {
    const detail = (await read(a.tenantToken, `${root}/${current.ma_thanh_toan}`)).body.data;
    assert.deepEqual(detail.chiTiets.map((row) => Number(row.so_tien)).sort((a, b) => a - b), [-100, -30, 1130]);
    assert.equal(Number(detail.tong_phai_tra), 1000);
    assert.ok(detail.giaoDichs.some((row) => row.trang_thai_xac_nhan === "CHO_XAC_NHAN" && row.so_tien === null));
    assert.doesNotMatch(JSON.stringify(detail), /PRIVATE|gia_thue|nguoi_thuc_hien_id|cccd/);
    const first = await read(a.tenantToken, `${root}?limit=1&page=1`);
    const second = await read(a.tenantToken, `${root}?limit=1&page=2`);
    assert.equal(first.body.pagination.total, 4); assert.equal(first.body.data.length, 1);
    assert.notEqual(first.body.data[0].ma_thanh_toan, second.body.data[0].ma_thanh_toan);
    const payments = await read(a.tenantToken, `${root}/payment/list?ma_thanh_toan=${current.ma_thanh_toan}&limit=1&page=2`);
    assert.equal(payments.body.pagination.total, 5); assert.equal(payments.body.data.length, 1);
    const oldDetail = await read(a.tenantToken, `${root}/${sharedBill.ma_thanh_toan}`);
    assert.equal(oldDetail.response.status, 200); assert.equal(Number(oldDetail.body.data.tong_phai_tra), 7000);
  });

  await t.test("no bills yields explicit empty data and tenant cannot record or confirm money", async () => {
    const dto = (await read(empty.tenantToken, summaryPath)).body.data;
    assert.equal(dto.current.count, 0); assert.equal(dto.totalRemainingDue, 0);
    assert.deepEqual((await read(empty.tenantToken, root)).body.data, []);
    const before = await snapshot();
    for (const path of [`${root}/payment/create`, `${root}/payment/${cash.ma_giao_dich}/confirm`, `/api/v1/bills/${current.ma_thanh_toan}/mark-paid`]) {
      const result = await request(path, { method: "POST", headers: headers(a.tenantToken), body: "{}" });
      assert.equal(result.response.status, 403, path);
    }
    assert.deepEqual(await snapshot(), before);
  });

  await t.test("landlord bills screen paginated list and summary work with nested room scope and multiple children", async () => {
    const ky = `${year}-${String(month).padStart(2, "0")}`;
    const list = await read(ownerA, `${root}?ky=${ky}&page=1&limit=20`);
    assert.equal(list.response.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.pagination.total, 2);
    assert.deepEqual(ids(list), [foreign.ma_thanh_toan, current.ma_thanh_toan]);
    const first = await read(ownerA, `${root}?ky=${ky}&page=1&limit=1`);
    const second = await read(ownerA, `${root}?ky=${ky}&page=2&limit=1`);
    assert.equal(first.response.status, 200); assert.equal(second.response.status, 200);
    assert.deepEqual(ids(first), [foreign.ma_thanh_toan]); assert.deepEqual(ids(second), [current.ma_thanh_toan]);
    assert.equal(second.body.data[0].chiTiets.length, 3); assert.equal(second.body.data[0].giaoDichs.length, 5);
    const scoped = await read(ownerA, `${root}?ky=${ky}&ma_can=${a.building.ma_can}&limit=20`);
    assert.equal(scoped.response.status, 200); assert.deepEqual(ids(scoped), [current.ma_thanh_toan]);
    const draftList = await read(ownerA, `${root}?issuance=DRAFT&limit=20`);
    assert.equal(draftList.response.status, 200); assert.deepEqual(ids(draftList), [draft.ma_thanh_toan]);
    const other = await read(ownerB, `${root}?ky=${ky}&limit=20`);
    assert.equal(other.response.status, 200); assert.deepEqual(ids(other), [otherOwner.ma_thanh_toan]);
    const summary = await read(ownerA, `/api/v1/bills/summary?ky=${ky}`);
    assert.equal(summary.response.status, 200); assert.equal(Number(summary.body.data.totalDue), 6555);
    assert.equal(Number(summary.body.data.totalPaid), 350);
  });

  await t.test("landlord bill/payment behavior is retained and shared tenant outstanding is building scoped", async () => {
    const detail = await read(ownerA, `${root}/${current.ma_thanh_toan}`);
    assert.equal(detail.response.status, 200); assert.equal(Number(detail.body.data.tong_phai_tra), 1000);
    assert.equal(Number(detail.body.data.tong_da_thanh_toan), 350);
    assert.equal((await read(ownerA, `${root}/${draft.ma_thanh_toan}`)).response.status, 200);
    assert.equal((await read(ownerA, `${root}/payment/${draftPayment.ma_giao_dich}`)).response.status, 200);
    const aBills = ids(await read(ownerA, `${root}/khach-thue/${a.tenant.ma_khach_thue}`));
    assert.deepEqual(new Set(aBills), new Set([current.ma_thanh_toan, old.ma_thanh_toan, future.ma_thanh_toan]));
    assert.deepEqual(ids(await read(ownerB, `${root}/khach-thue/${a.tenant.ma_khach_thue}`)), [sharedBill.ma_thanh_toan]);
    assert.equal((await read(ownerB, `${root}/${current.ma_thanh_toan}`)).response.status, 404);
  });
});
