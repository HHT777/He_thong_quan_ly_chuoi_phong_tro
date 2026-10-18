const test = require("node:test");
const assert = require("node:assert/strict");
const {
  TaiKhoan, HopDong, PhongTro, TaiSan, TienCoc, ChiSoDien, ThanhToan,
  ChiTietThanhToan, GiaoDichThanhToan, KhoanThu, KhoanKhauTru,
  BienBanTraPhong, GiaoDichHoanCoc, ViPhamHopDong, SuCo,
  ChiPhiSuCoKhachThue, YeuCauTraPhong,
} = require("../src/models");
const moveOutRequestService = require("../src/services/moveOutRequest.service");
const moveOutService = require("../src/services/moveOut.service");
const cashflowReportService = require("../src/services/cashflowReport.service");
const { businessDate } = require("../src/utils/businessDate.util");
const { integration, request, headers, login, createBaseRental, createFreshRental } = require("./helpers/integration-api");

// Business dates use Vietnam time; UTC's previous day would miss receipts near midnight.
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function prepareMoveOut(landlord, fresh) {
  const created = await request("/api/v1/requests", {
    method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({
      type: "TRA_PHONG", content: "Quyết toán C.2", date: today(),
      earlyReturnReason: "Hai bên thống nhất trả sớm",
    }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const approved = await request(`/api/v1/requests/${created.body.data.ma_yeu_cau}`, {
    method: "PATCH", headers: headers(landlord), body: JSON.stringify({
      status: "DA_DUYET", reason: "Duyệt quyết toán",
      earlyReturnReason: "Hai bên thống nhất trả sớm",
    }),
  });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  await moveOutRequestService.processDueMoveOuts({ now: new Date() });
  assert.equal((await PhongTro.findByPk((await HopDong.findByPk(fresh.contract.ma_hop_dong)).ma_phong)).trang_thai, "DANG_XU_LY_TRA_PHONG");
  return created.body.data.ma_yeu_cau;
}

function baseSettlement(overrides = {}) {
  return {
    assetsChecked: true,
    debtReviewed: true,
    roomCondition: "Đạt yêu cầu",
    deduction: 0,
    finalElectricityReading: 0,
    ...overrides,
  };
}

test("FR-187/188 Vietnam business day controls settlement, meter month and refund at UTC month boundary", async () => {
  const instant = new Date("2026-10-31T19:00:00.000Z"); // 2026-11-01 02:00 in Vietnam.
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "settlement-vietnam-boundary");
  const requestId = await prepareMoveOut(landlord, fresh);
  // Legacy approved requests may lack a stored date; exercise the settlement fallback clock.
  await YeuCauTraPhong.update({ ngay_tra_da_duyet: null }, { where: { ma_yeu_cau: requestId } });
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const settled = await moveOutService.settle(fresh.contract.ma_hop_dong, baseSettlement({ deduction: 1 }), actor.ma_tai_khoan, { now: instant });
  assert.equal(settled.report.ngay_quyet_toan, "2026-11-01");
  assert.equal(settled.report.ngay_kiem_tra, "2026-11-01");
  const finalReading = await ChiSoDien.findOne({ where: { ma_phong: fresh.room.ma_phong, loai_chi_so: "CHOT_TRA_PHONG", khoa_nghiep_vu: fresh.contract.ma_hop_dong } });
  assert.equal(Number(finalReading.nam), 2026);
  assert.equal(Number(finalReading.thang), 11);
  assert.equal(businessDate(finalReading.ngay_ghi_nhan), "2026-11-01");
  const november = await cashflowReportService.getCashflow({ periodType: "month", periodValue: "2026-11", buildingId: fresh.building.ma_can });
  const october = await cashflowReportService.getCashflow({ periodType: "month", periodValue: "2026-10", buildingId: fresh.building.ma_can });
  assert.equal(november.depositDeductions, Math.min(Number(settled.report.tien_coc_ban_dau), Number(settled.report.tong_khoan_khau_tru)));
  assert.equal(november.totalRevenue, november.depositDeductions);
  assert.equal(october.depositDeductions, 0);
  const refund = await moveOutService.recordDepositRefund(settled.report.ma_bien_ban, { soTien: 1, khoaChongTrung: `vn-boundary-${fresh.contract.ma_hop_dong}` }, actor.ma_tai_khoan, { now: instant });
  assert.equal(refund.ngay_hoan, "2026-11-01");
});

test("FR-096/187/188 settlement context, detailed deductions, debt offset and partial refund", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "settlement-positive");
  await prepareMoveOut(landlord, fresh);
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });

  const context = await request(`/api/v1/move-outs/${fresh.contract.ma_hop_dong}/context`, { headers: headers(landlord) });
  assert.equal(context.response.status, 200, JSON.stringify(context.body));
  assert.equal(context.body.data.contract.ma_hop_dong, fresh.contract.ma_hop_dong);
  assert.equal(context.body.data.latestElectricityReading.loai_chi_so, "DAU_HOP_DONG");
  const forbidden = await request(`/api/v1/move-outs/${fresh.contract.ma_hop_dong}/context`, { headers: headers(fresh.tenantToken) });
  assert.equal(forbidden.response.status, 403);

  const asset = await TaiSan.create({ ten_tai_san: "Quạt", so_luong: 1, tinh_trang: "Tốt", ma_phong: fresh.room.ma_phong });
  const violation = await ViPhamHopDong.create({ noi_dung: "Vi phạm nội quy", dieu_khoan_lien_quan: "Điều 4", muc_phat: 30000, ma_hop_dong: fresh.contract.ma_hop_dong });
  const incident = await SuCo.create({ loai_su_co: "HONG_THIET_BI", muc_do_uu_tien: "THAP", mo_ta: "Hỏng khóa", trang_thai: "DANG_XU_LY", ma_nguoi_gui: actor.ma_tai_khoan, ma_phong: fresh.room.ma_phong });
  const incidentCharge = await ChiPhiSuCoKhachThue.create({ ma_su_co: incident.ma_su_co, ma_hop_dong: fresh.contract.ma_hop_dong, so_tien: 40000, can_cu_trach_nhiem: "Khách làm hỏng" });
  const oldBill = await ThanhToan.create({ ma_hop_dong: fresh.contract.ma_hop_dong, thang: 9, nam: 2026, loai_thanh_toan: "DINH_KY", tong_phai_tra: 50000, tong_da_thanh_toan: 0, so_tien_con_no: 50000, trang_thai: "CHUA_THANH_TOAN" });
  await ChiTietThanhToan.create({ ma_thanh_toan: oldBill.ma_thanh_toan, loai_khoan: "PHI_PHAT_SINH", so_tien: 50000, dien_giai: "Nợ cũ" });

  const settled = await request(`/api/v1/move-outs/${fresh.contract.ma_hop_dong}/settle`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify(baseSettlement({
      finalElectricityReading: 10,
      deduction: 20000,
      assetDeductions: [{ assetId: asset.ma_tai_san, quantity: 1, amount: 60000, reason: "Mất quạt" }],
      violationDeductions: [{ violationId: violation.ma_vi_pham, amount: 30000 }],
    })),
  });
  assert.equal(settled.response.status, 200, JSON.stringify(settled.body));
  assert.ok(Number(settled.body.data.refund) > 0);
  assert.ok(Number(settled.body.data.snapshot.water) > 0);
  assert.ok(Number(settled.body.data.snapshot.proratedRent) > 0);
  const reportId = settled.body.data.report.ma_bien_ban;
  assert.equal(Number((await TienCoc.findOne({ where: { ma_hop_dong: fresh.contract.ma_hop_dong } })).so_tien_da_hoan), 0);
  const lines = await KhoanKhauTru.findAll({ where: { ma_bien_ban_tra_phong: reportId } });
  assert.equal(lines.filter((row) => row.ma_tai_san === asset.ma_tai_san).length, 1);
  assert.equal(lines.filter((row) => row.ma_vi_pham === violation.ma_vi_pham).length, 1);
  assert.equal(lines.filter((row) => row.ma_chi_phi_su_co === incidentCharge.ma_chi_phi_su_co).length, 1);
  const offset = await GiaoDichThanhToan.findOne({ where: { ma_thanh_toan: oldBill.ma_thanh_toan, nguon_thanh_toan: "KHAU_TRU_COC" } });
  assert.equal(Number(offset.so_tien), 50000);
  assert.equal(await KhoanThu.count({ where: { ma_giao_dich_thanh_toan: offset.ma_giao_dich } }), 0);
  assert.equal(Number((await ThanhToan.findByPk(oldBill.ma_thanh_toan)).so_tien_con_no), 0);

  const refundable = Number(settled.body.data.refund);
  const firstAmount = Math.floor(refundable / 2);
  const refundKey = `refund-${Date.now()}`;
  const firstRefund = await request(`/api/v1/move-outs/${reportId}/deposit-refunds`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify({ soTien: firstAmount, ngayHoan: today(), khoaChongTrung: refundKey }),
  });
  assert.equal(firstRefund.response.status, 201, JSON.stringify(firstRefund.body));
  const replay = await request(`/api/v1/move-outs/${reportId}/deposit-refunds`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify({ soTien: firstAmount, ngayHoan: today(), khoaChongTrung: refundKey }),
  });
  assert.equal(replay.response.status, 201, JSON.stringify(replay.body));
  assert.equal(await GiaoDichHoanCoc.count({ where: { khoa_chong_trung: refundKey } }), 1);
  const exceeded = await request(`/api/v1/move-outs/${reportId}/deposit-refunds`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify({ soTien: refundable, ngayHoan: today(), khoaChongTrung: `${refundKey}-over` }),
  });
  assert.equal(exceeded.response.status, 422);

  const cashflow = await request(`/api/v1/reports/cashflow?from=${today()}&to=${today()}&buildingId=${fresh.building.ma_can}`, { headers: headers(landlord) });
  assert.equal(cashflow.response.status, 200, JSON.stringify(cashflow.body));
  assert.equal(Number(cashflow.body.data.depositDeductions), Number(settled.body.data.totalDeduction));
  assert.equal(Number(cashflow.body.data.cashReceipts), 0);
  assert.equal(Number(cashflow.body.data.totalRevenue), Number(settled.body.data.totalDeduction));
  assert.equal(cashflow.body.data.receiptDetails.filter((row) => row.source === "KHAU_TRU_COC").length, 1);
  const otherPeriod = await request(`/api/v1/reports/cashflow?from=2026-10-14&to=2026-10-14&buildingId=${fresh.building.ma_can}`, { headers: headers(landlord) });
  assert.equal(Number(otherPeriod.body.data.totalRevenue), 0);
});

test("FR-189 zero/negative settlement is idempotent and post-liquidation debt remains collectible", async () => {
  const landlord = await login(integration.landlord);
  const zeroRental = await createFreshRental(landlord, "settlement-zero");
  await prepareMoveOut(landlord, zeroRental);
  const date = new Date(`${today()}T00:00:00Z`);
  const days = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const currentBill = await ThanhToan.create({ ma_hop_dong: zeroRental.contract.ma_hop_dong, thang: date.getUTCMonth() + 1, nam: date.getUTCFullYear(), loai_thanh_toan: "DINH_KY", tong_phai_tra: 2500000, tong_da_thanh_toan: 2500000, so_tien_con_no: 0, trang_thai: "DA_THANH_TOAN" });
  await ChiTietThanhToan.create({ ma_thanh_toan: currentBill.ma_thanh_toan, loai_khoan: "TIEN_PHONG", so_tien: 2500000, dien_giai: "Tiền phòng trả trước" });
  const water = Math.round(100000 * date.getUTCDate() / days * 100) / 100;
  const rent = Math.round(2500000 * date.getUTCDate() / days * 100) / 100;
  const prepaidRefund = Math.round(2500000 * (1 - date.getUTCDate() / days) * 100) / 100;
  const exactOther = Math.round((2500000 + prepaidRefund - water) * 100) / 100;
  const zero = await request(`/api/v1/move-outs/${zeroRental.contract.ma_hop_dong}/settle`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify(baseSettlement({ deduction: exactOther })),
  });
  assert.equal(zero.response.status, 200, JSON.stringify(zero.body));
  assert.equal(Number(zero.body.data.report.gia_tri_quyet_toan_rong), 0);
  assert.equal(Number(zero.body.data.refund), 0);
  assert.equal(Number(zero.body.data.postDebt), 0);
  assert.equal(Number(zero.body.data.snapshot.prepaidRentRefund), prepaidRefund);
  assert.equal(Number(zero.body.data.snapshot.proratedRent), 0);

  const negativeRental = await createFreshRental(landlord, "settlement-negative");
  await prepareMoveOut(landlord, negativeRental);
  const negativeOther = Math.round((2500000 - rent - water + 400000) * 100) / 100;
  const negative = await request(`/api/v1/move-outs/${negativeRental.contract.ma_hop_dong}/settle`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify(baseSettlement({ deduction: negativeOther })),
  });
  assert.equal(negative.response.status, 200, JSON.stringify(negative.body));
  assert.equal(Number(negative.body.data.postDebt), 400000);
  const repeated = await request(`/api/v1/move-outs/${negativeRental.contract.ma_hop_dong}/settle`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify(baseSettlement({ deduction: negativeOther })),
  });
  assert.equal(repeated.response.status, 409);
  const postBills = await ThanhToan.findAll({ where: { ma_hop_dong: negativeRental.contract.ma_hop_dong, loai_thanh_toan: "SAU_THANH_LY" } });
  assert.equal(postBills.length, 1);
  assert.equal((await TaiKhoan.findByPk(negativeRental.account.ma_tai_khoan)).trang_thai, "DA_KHOA");

  const debt = await request("/api/v1/debt", { headers: headers(landlord) });
  assert.equal(debt.response.status, 200);
  assert.ok(debt.body.data.some((row) => row.ma_thanh_toan === postBills[0].ma_thanh_toan));
  const paid = await request("/api/khoan-phai-thu/payment/create", {
    method: "POST", headers: headers(landlord, { "Idempotency-Key": `post-debt-${Date.now()}` }),
    body: JSON.stringify({ ma_khoan_phai_thu: postBills[0].ma_thanh_toan, so_tien: 400000, ngay_thanh_toan: new Date().toISOString(), phuong_thuc: "CHUYEN_KHOAN" }),
  });
  assert.equal(paid.response.status, 201, JSON.stringify(paid.body));
  assert.equal(Number((await ThanhToan.findByPk(postBills[0].ma_thanh_toan)).so_tien_con_no), 0);
  const report = await request(`/api/v1/reports/cashflow?from=${today()}&to=${today()}&buildingId=${negativeRental.building.ma_can}`, { headers: headers(landlord) });
  assert.equal(report.response.status, 200, JSON.stringify(report.body));
  assert.equal(Number(report.body.data.depositDeductions), 2500000);
  assert.equal(Number(report.body.data.cashReceipts), 400000);
  assert.equal(Number(report.body.data.totalRevenue), 2900000);
});

test("FR-190 settlement rolls back all lifecycle state after a mid-transaction failure", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "settlement-rollback");
  await prepareMoveOut(landlord, fresh);
  const deposit = await TienCoc.findOne({ where: { ma_hop_dong: fresh.contract.ma_hop_dong } });
  await deposit.update({ trang_thai: "CHUA_NHAN", ngay_nhan_coc: null });
  const beforeReadings = await ChiSoDien.count({ where: { ma_phong: fresh.room.ma_phong } });
  await assert.rejects(
    moveOutService.settle(fresh.contract.ma_hop_dong, baseSettlement(), (await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } })).ma_tai_khoan),
    (error) => error.code === "DEPOSIT_NOT_RECEIVED",
  );
  assert.equal(await ChiSoDien.count({ where: { ma_phong: fresh.room.ma_phong } }), beforeReadings);
  assert.equal(await BienBanTraPhong.count({ where: { ma_hop_dong: fresh.contract.ma_hop_dong } }), 0);
  assert.equal((await HopDong.findByPk(fresh.contract.ma_hop_dong)).trang_thai, "DANG_HIEU_LUC");
  assert.equal((await PhongTro.findByPk(fresh.room.ma_phong)).trang_thai, "DANG_XU_LY_TRA_PHONG");
  assert.equal((await TienCoc.findByPk(deposit.ma_tien_coc)).trang_thai, "CHUA_NHAN");
  assert.equal((await TaiKhoan.findByPk(fresh.account.ma_tai_khoan)).trang_thai, "HOAT_DONG");
});

test("FR-195 transfer then move-out in the same month uses the transferred-room reading", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "transfer-move-out");
  const targetBase = await createBaseRental(landlord, "transfer-move-out-target");
  const transferred = await request(`/api/hop-dong/${fresh.contract.ma_hop_dong}/transfers`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify({
      targetRoomId: targetBase.room.ma_phong, transferDate: today(), newRent: 2500000,
      finalElectricityReading: 5, initialElectricityReading: 10, reason: "Chuyển rồi trả trong tháng",
    }),
  });
  assert.equal(transferred.response.status, 201, JSON.stringify(transferred.body));
  await prepareMoveOut(landlord, fresh);
  const settled = await request(`/api/v1/move-outs/${fresh.contract.ma_hop_dong}/settle`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify(baseSettlement({ finalElectricityReading: 15 })),
  });
  assert.equal(settled.response.status, 200, JSON.stringify(settled.body));
  assert.equal(settled.body.data.snapshot.previousElectricityReading, 10);
  assert.equal(settled.body.data.snapshot.electricity, 17500);
  const final = await ChiSoDien.findOne({ where: { ma_phong: targetBase.room.ma_phong, loai_chi_so: "CHOT_TRA_PHONG" } });
  assert.ok(final);
});
