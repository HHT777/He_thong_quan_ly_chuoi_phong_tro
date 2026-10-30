const test = require("node:test");
const assert = require("node:assert/strict");
const { HopDong, ThanhVienPhong, ChiSoDien, TaiKhoan, ThanhToan, ChiTietThanhToan, ThongBao, GiaoDichThanhToan, KhoanThu, AuditLog, NhatKyLapPhieu, ChiTietNhatKyLapPhieu } = require("../src/models");
const billingCronService = require("../src/services/billingCron.service");
const paymentLifecycleService = require("../src/services/paymentLifecycle.service");
const { sumSignedLineAmounts } = require("../src/utils/billLine.util");
const { integration, request, headers, login, createFreshRental, createBaseRental, uniqueValues } = require("./helpers/integration-api");
const { withNamedLock } = require("../src/services/dbNamedLock.service");
const cronJobs = require("../src/jobs/cron.jobs");
const reservationService = require("../src/services/reservation.service");
const { actionDue } = require("../src/services/debtLifecycle.service");
const { getPersistedSystemConfig } = require("../src/services/systemConfig.service");
const { businessDate } = require("../src/utils/businessDate.util");

async function confirmedReading(fresh, period, value) {
  const [year, month] = period.split("-").map(Number);
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  return ChiSoDien.create({ ma_phong: fresh.room.ma_phong, nam: year, thang: month, chi_so_moi: value, don_gia_ap_dung: 3500, trang_thai_xac_nhan: "DA_XAC_NHAN", ngay_ghi_nhan: new Date(Date.UTC(year, month, 0, 12)), nguoi_ghi_nhan_id: actor.ma_tai_khoan, nguoi_xac_nhan_id: actor.ma_tai_khoan, ngay_xac_nhan: new Date() });
}

test("FR-157/164/175/176/179 preview and generation snapshot contract charges atomically", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "billing-definitions");
  const ineligible = await createBaseRental(landlord, "billing-ineligible");
  await HopDong.update({ phi_dich_vu: 120000 }, { where: { ma_hop_dong: fresh.contract.ma_hop_dong } });
  await ThanhVienPhong.create({ ho_ten: "Co tenant billing", so_dien_thoai: "0912345678", ngay_vao: "2026-10-01", trang_thai_cu_tru: "DANG_O", ma_phong: fresh.room.ma_phong, ma_hop_dong: fresh.contract.ma_hop_dong });
  await confirmedReading(fresh, "2026-10", 130);
  const fixed = await request("/api/v1/billing-adjustments", { method: "POST", headers: headers(landlord), body: JSON.stringify({ contractId: fresh.contract.ma_hop_dong, type: "GIAM_TRU", name: "Giảm quản lý căn", amount: 100000, mode: "CO_DINH", startDate: "2026-10-01" }) });
  assert.equal(fixed.response.status, 201, JSON.stringify(fixed.body));
  const onePeriod = await request("/api/v1/billing-adjustments", { method: "POST", headers: headers(landlord), body: JSON.stringify({ contractId: fresh.contract.ma_hop_dong, type: "PHI_PHAT_SINH", name: "Phí kỳ 10", amount: 50000, mode: "THEO_KY", period: "2026-10" }) });
  assert.equal(onePeriod.response.status, 201, JSON.stringify(onePeriod.body));
  const tenantForbidden = await request("/api/v1/billing-adjustments", { method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({}) });
  assert.equal(tenantForbidden.response.status, 403);
  const before = await ThanhToan.count({ where: { ma_hop_dong: fresh.contract.ma_hop_dong } });
  const preview = await request("/api/v1/bills/preview", { method: "POST", headers: headers(landlord), body: JSON.stringify({ period: "2026-10", contractIds: [fresh.contract.ma_hop_dong] }) });
  assert.equal(preview.response.status, 200, JSON.stringify(preview.body));
  assert.equal(await ThanhToan.count({ where: { ma_hop_dong: fresh.contract.ma_hop_dong } }), before, "preview must not write a bill");
  const ineligiblePreview = await request("/api/v1/bills/preview", { method: "POST", headers: headers(landlord), body: JSON.stringify({ period: "2026-10" }) });
  assert.equal(ineligiblePreview.response.status, 200, JSON.stringify(ineligiblePreview.body));
  const ineligibleRoom = ineligiblePreview.body.data.rooms.find((room) => room.roomId === ineligible.room.ma_phong);
  assert.equal(ineligibleRoom.eligible, false);
  assert.equal(ineligibleRoom.reasonCode, "NO_ACTIVE_CONTRACT");
  const item = preview.body.data.previews[0]; assert.equal(item.occupantCount, 2); assert.equal(item.components.water, 200000); assert.equal(item.components.serviceFee, 120000);
  assert.equal(item.components.electricity, 0, "first contract month has no prior electricity");
  assert.equal(item.total, 2500000 + 200000 + 120000 + 50000 - 100000);
  const generated = await request("/api/v1/bills/generate", { method: "POST", headers: headers(landlord), body: JSON.stringify({ period: "2026-10", contractIds: [fresh.contract.ma_hop_dong] }) });
  assert.equal(generated.response.status, 201, JSON.stringify(generated.body)); assert.equal(generated.body.data.created.length, 1);
  const bill = await ThanhToan.findByPk(generated.body.data.created[0].ma_thanh_toan, { include: [{ model: ChiTietThanhToan, as: "chiTiets" }] });
  assert.equal(sumSignedLineAmounts(bill.chiTiets), Number(bill.tong_phai_tra));
  assert.equal(Number(bill.tong_phai_tra), item.total, "preview and saved draft must agree");
  assert.match(bill.chiTiets.find((line) => line.loai_khoan === "TIEN_PHONG").dien_giai, /2\.500\.000 đ\/tháng/);
  assert.match(bill.chiTiets.find((line) => line.loai_khoan === "TIEN_NUOC").dien_giai, /2 người × 100\.000 đ\/người/);
  const draftList = await request("/api/khoan-phai-thu?ky=2026-10&issuance=DRAFT&page=1&limit=20", { headers: headers(landlord) });
  assert.equal(draftList.response.status, 200, JSON.stringify(draftList.body));
  assert.ok(draftList.body.data.some((row) => row.ma_thanh_toan === bill.ma_thanh_toan));
  const draftSummary = await request("/api/v1/bills/summary?ky=2026-10&issuance=DRAFT", { headers: headers(landlord) });
  assert.equal(draftSummary.response.status, 200, JSON.stringify(draftSummary.body));
  assert.ok(draftSummary.body.data.unsent >= 1);
  const allList = await request("/api/khoan-phai-thu?ky=2026-10&page=1&limit=20", { headers: headers(landlord) });
  assert.equal(allList.response.status, 200, JSON.stringify(allList.body));
  const allSummary = await request("/api/v1/bills/summary?ky=2026-10", { headers: headers(landlord) });
  assert.equal(allSummary.response.status, 200, JSON.stringify(allSummary.body));
  assert.equal(bill.chiTiets.filter((line) => line.loai_khoan === "GIAM_TRU").length, 1);
  const edited = await request(`/api/v1/billing-adjustments/${fixed.body.data.ma_khoan_dieu_chinh}`, { method: "PATCH", headers: headers(landlord), body: JSON.stringify({ amount: 200000 }) });
  assert.equal(edited.response.status, 200, JSON.stringify(edited.body));
  const snapshot = await ChiTietThanhToan.findOne({ where: { ma_thanh_toan: bill.ma_thanh_toan, ma_khoan_dieu_chinh: fixed.body.data.ma_khoan_dieu_chinh } }); assert.equal(Number(snapshot.so_tien), -100000);
  const disabled = await request(`/api/v1/billing-adjustments/${fixed.body.data.ma_khoan_dieu_chinh}/toggle`, { method: "POST", headers: headers(landlord), body: JSON.stringify({ enabled: false, reason: "Kết thúc ưu đãi" }) });
  assert.equal(disabled.response.status, 200, JSON.stringify(disabled.body));
  await confirmedReading(fresh, "2026-11", 150);
  const [raceA, raceB] = await Promise.all([0, 1].map(() => request("/api/v1/bills/generate", { method: "POST", headers: headers(landlord), body: JSON.stringify({ period: "2026-11", contractIds: [fresh.contract.ma_hop_dong] }) })));
  assert.equal(raceA.response.status, 201); assert.equal(raceB.response.status, 201);
  assert.equal(raceA.body.data.created.length + raceB.body.data.created.length, 1);
  assert.equal(await ThanhToan.count({ where: { ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2026, thang: 11, loai_thanh_toan: "DINH_KY" } }), 1);
  const duplicate = await request("/api/v1/bills/generate", { method: "POST", headers: headers(landlord), body: JSON.stringify({ period: "2026-10", contractIds: [fresh.contract.ma_hop_dong] }) });
  assert.equal(duplicate.response.status, 201);
  assert.equal(duplicate.body.data.created.length, 0);
  assert.equal(duplicate.body.data.skipped[0].reason, "BILL_ALREADY_EXISTS");
});

test("FR-151/153/155/156 billing cron creates drafts once and landlord sends separately", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "billing-cron"); await confirmedReading(fresh, "2027-05", 80);
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const first = await billingCronService.run({ now: new Date("2027-06-02T08:00:00+07:00"), actorId: actor.ma_tai_khoan, force: true });
  const second = await billingCronService.run({ now: new Date("2027-06-02T08:05:00+07:00"), actorId: actor.ma_tai_khoan, force: true });
  const bill = await ThanhToan.findOne({ where: { ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2027, thang: 6, loai_thanh_toan: "DINH_KY" } });
  assert.ok(bill); assert.equal(bill.da_gui, false); assert.equal(first.sent, 0); assert.equal(second.sent, 0);
  const originalSchedule = await request("/api/v1/bills/schedule", { headers: headers(landlord) });
  assert.equal(originalSchedule.response.status, 200, JSON.stringify(originalSchedule.body));
  const schedule = await request("/api/v1/bills/schedule", { method: "PUT", headers: headers(landlord), body: JSON.stringify({ enabled: true, day: 3, hour: 9, buildingIds: [fresh.room.ma_can] }) });
  assert.equal(schedule.response.status, 200, JSON.stringify(schedule.body));
  assert.equal(schedule.body.data.day, 3);
  assert.equal(schedule.body.data.hour, 9);
  assert.deepEqual(schedule.body.data.buildingIds, [fresh.room.ma_can]);
  const previous = originalSchedule.body.data;
  const restoreSchedule = await request("/api/v1/bills/schedule", { method: "PUT", headers: headers(landlord), body: JSON.stringify({ enabled: previous.enabled, day: previous.day, hour: previous.hour, buildingIds: previous.buildingIds }) });
  assert.equal(restoreSchedule.response.status, 200, JSON.stringify(restoreSchedule.body));
  const runLog = await NhatKyLapPhieu.findOne({ where: { ky: "2027-06" } });
  assert.equal(runLog.trang_thai, "HOAN_TAT");
  assert.equal(await ChiTietNhatKyLapPhieu.count({ where: { ma_lan_chay: runLog.ma_lan_chay, ma_phong: fresh.room.ma_phong, ket_qua: "DA_LAP" } }), 1);
  const sendPreview = await request("/api/v1/bills/send-preview", { method: "POST", headers: headers(landlord), body: JSON.stringify({ billIds: [bill.ma_thanh_toan] }) });
  assert.equal(sendPreview.response.status, 200, JSON.stringify(sendPreview.body));
  assert.equal(sendPreview.body.data.rows[0].recipientAvailable, true);
  const sent = await request("/api/v1/bills/send", { method: "POST", headers: headers(landlord), body: JSON.stringify({ billIds: [bill.ma_thanh_toan] }) });
  assert.equal(sent.response.status, 200); assert.equal(sent.body.data.sent, 1);
  await bill.reload(); assert.equal(bill.da_gui, true); assert.ok(bill.ngay_gui); assert.equal(bill.so_lan_gui, 1);
  assert.equal(await ThongBao.count({ where: { ma_tai_khoan: fresh.account.ma_tai_khoan, loai_thong_bao: "PHIEU_THU" } }), 1);
  const missingKey = await request("/api/v1/bills/send", { method: "POST", headers: headers(landlord), body: JSON.stringify({ billIds: [bill.ma_thanh_toan], resend: true }) });
  assert.equal(missingKey.body.data.results[0].reason, "IDEMPOTENCY_KEY_REQUIRED");
  const resendKey = `resend-${Date.now()}`;
  const resendOptions = { method: "POST", headers: headers(landlord, { "Idempotency-Key": resendKey }), body: JSON.stringify({ billIds: [bill.ma_thanh_toan], resend: true }) };
  const resent = await request("/api/v1/bills/send", resendOptions);
  const replay = await request("/api/v1/bills/send", resendOptions);
  assert.equal(resent.body.data.sent, 1);
  assert.equal(replay.body.data.results[0].reason, "ALREADY_PROCESSED");
  await bill.reload(); assert.equal(bill.so_lan_gui, 2);
  assert.equal(await ThongBao.count({ where: { ma_tai_khoan: fresh.account.ma_tai_khoan, loai_thong_bao: "PHIEU_THU" } }), 2);
  const forbidden = await request("/api/v1/jobs/billing", { method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({ force: true }) }); assert.equal(forbidden.response.status, 403);
});

test("FR-153 sending a draft without a tenant account leaves bill and notification unchanged", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "bill-no-recipient", { createAccount: false });
  const bill = await ThanhToan.create({ ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2027, thang: 2, loai_thanh_toan: "DINH_KY", tong_phai_tra: 2500000, tong_da_thanh_toan: 0, so_tien_con_no: 2500000, trang_thai: "CHUA_THANH_TOAN", da_gui: false });
  const sent = await request("/api/v1/bills/send", { method: "POST", headers: headers(landlord), body: JSON.stringify({ billIds: [bill.ma_thanh_toan] }) });
  assert.equal(sent.response.status, 200);
  assert.equal(sent.body.data.sent, 0);
  assert.equal(sent.body.data.results[0].reason, "RECIPIENT_UNAVAILABLE");
  await bill.reload(); assert.equal(bill.da_gui, false); assert.equal(bill.so_lan_gui, 0);
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: `PHIEU_THU:${bill.ma_thanh_toan}` } }), 0);
});

test("FR-152 a draft stays out of tenant bills and debt until landlord sends it", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "bill-draft-debt");
  const bill = await ThanhToan.create({ ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2026, thang: 10, loai_thanh_toan: "DINH_KY", tong_phai_tra: 2500000, tong_da_thanh_toan: 0, so_tien_con_no: 2500000, trang_thai: "CHUA_THANH_TOAN", da_gui: false });
  const debtBefore = await request("/api/v1/debt", { headers: headers(landlord) });
  assert.equal(debtBefore.body.data.some((item) => item.ma_thanh_toan === bill.ma_thanh_toan), false);
  const tenantBillsBefore = await request("/api/khoan-phai-thu?ky=2026-10", { headers: headers(fresh.tenantToken) });
  assert.equal(tenantBillsBefore.body.data.some((item) => item.ma_thanh_toan === bill.ma_thanh_toan), false);
  const tenantDetailBefore = await request(`/api/khoan-phai-thu/${bill.ma_thanh_toan}`, { headers: headers(fresh.tenantToken) });
  assert.equal(tenantDetailBefore.response.status, 404);
  const payment = await request("/api/khoan-phai-thu/payment/create", { method: "POST", headers: headers(landlord, { "Idempotency-Key": `draft-${Date.now()}` }), body: JSON.stringify({ ma_khoan_phai_thu: bill.ma_thanh_toan, ngay_thanh_toan: "2026-10-17", so_tien: 100000, phuong_thuc: "CHUYEN_KHOAN" }) });
  assert.equal(payment.response.status, 409);
  assert.equal(payment.body.code, "BILL_NOT_SENT");
  const sent = await request("/api/v1/bills/send", { method: "POST", headers: headers(landlord), body: JSON.stringify({ billIds: [bill.ma_thanh_toan] }) });
  assert.equal(sent.body.data.sent, 1);
  const debtAfter = await request("/api/v1/debt", { headers: headers(landlord) });
  assert.equal(debtAfter.body.data.some((item) => item.ma_thanh_toan === bill.ma_thanh_toan), true);
  const tenantBillsAfter = await request("/api/khoan-phai-thu?ky=2026-10", { headers: headers(fresh.tenantToken) });
  assert.equal(tenantBillsAfter.body.data.some((item) => item.ma_thanh_toan === bill.ma_thanh_toan), true);
});

test("FR-151/153 migration backfill keeps legacy bills inert across all cron workers", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "legacy-backfill");
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const protectedAt = new Date("2026-01-01T00:00:00Z");
  const legacy = await ThanhToan.create({
    ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2025, thang: 1, loai_thanh_toan: "DINH_KY",
    tong_phai_tra: 321000, tong_da_thanh_toan: 0, so_tien_con_no: 321000, trang_thai: "CHUA_THANH_TOAN",
    da_gui: true, ngay_gui: protectedAt, da_nhac_han: true, ngay_nhac_han: protectedAt,
    qua_han: true, ngay_qua_han: protectedAt, da_chot_cong_no: true, ngay_chot_cong_no: protectedAt, so_tien_chot_cong_no: 321000,
  });
  await billingCronService.run({ now: new Date("2026-10-02T08:00:00+07:00"), actorId: actor.ma_tai_khoan, force: true });
  await request("/api/v1/jobs/debt-lifecycle", { method: "POST", headers: headers(landlord), body: JSON.stringify({ now: "2026-10-11T00:15:00+07:00" }) });
  await cronJobs.updateContractStates(); await reservationService.notifyExpired({ now: new Date("2026-10-11T00:15:00+07:00") }); await cronJobs.processDueMoveOuts({ now: new Date("2026-10-11T00:15:00+07:00") });
  await legacy.reload();
  assert.equal(Number(legacy.so_tien_con_no), 321000); assert.equal(Number(legacy.so_tien_chot_cong_no), 321000);
  assert.equal(await ThongBao.count({ where: { ma_tai_khoan: fresh.account.ma_tai_khoan, noi_dung: { [require("sequelize").Op.like]: "%2025-01%" } } }), 0);
});

test("FR-078/172/173 debt milestones catch up once and expose derived overdue state", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "debt-cron");
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const bill = await ThanhToan.create({ ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2026, thang: 10, loai_thanh_toan: "DINH_KY", tong_phai_tra: 900000, tong_da_thanh_toan: 0, so_tien_con_no: 900000, trang_thai: "CHUA_THANH_TOAN", da_gui: true, ngay_gui: new Date("2026-10-02T01:00:00Z") });
  const day5 = await request("/api/v1/jobs/debt-lifecycle", { method: "POST", headers: headers(landlord), body: JSON.stringify({ now: "2026-10-05T08:00:00+07:00" }) });
  assert.equal(day5.response.status, 200, JSON.stringify(day5.body)); await bill.reload(); assert.equal(bill.da_nhac_han, true); assert.equal(bill.qua_han, false); assert.equal(bill.da_chot_cong_no, false);
  await request("/api/v1/jobs/debt-lifecycle", { method: "POST", headers: headers(landlord), body: JSON.stringify({ now: "2026-10-06T08:00:00+07:00" }) });
  await request("/api/v1/jobs/debt-lifecycle", { method: "POST", headers: headers(landlord), body: JSON.stringify({ now: "2026-10-11T00:15:00+07:00" }) });
  const repeated = await request("/api/v1/jobs/debt-lifecycle", { method: "POST", headers: headers(landlord), body: JSON.stringify({ now: "2026-10-11T00:20:00+07:00" }) });
  assert.equal(repeated.body.data.processed.some((row) => row.billId === bill.ma_thanh_toan), false);
  await bill.reload(); assert.equal(bill.qua_han, true); assert.equal(bill.da_chot_cong_no, true); assert.equal(Number(bill.so_tien_chot_cong_no), 900000);
  assert.equal(await ThongBao.count({ where: { ma_tai_khoan: fresh.account.ma_tai_khoan, loai_thong_bao: ["NHAC_THANH_TOAN", "CONG_NO"] } }), 2);
  const debt = await request("/api/v1/debt", { headers: headers(landlord) }); const item = debt.body.data.find((row) => row.ma_thanh_toan === bill.ma_thanh_toan);
  assert.equal(item.isOverdue, true); assert.equal(item.debtGroup.buildingId, fresh.building.ma_can); assert.ok(item.debtAgeDays >= 0);
  const forbidden = await request("/api/v1/jobs/debt-lifecycle", { method: "POST", headers: headers(fresh.tenantToken), body: "{}" }); assert.equal(forbidden.response.status, 403);
  assert.ok(actor);
});

test("FR-074/075/079 mark paid and cancellation are idempotent, reversible and audited", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "payment-lifecycle");
  const bill = await ThanhToan.create({ ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2026, thang: 12, loai_thanh_toan: "DINH_KY", tong_phai_tra: 700000, tong_da_thanh_toan: 0, so_tien_con_no: 700000, trang_thai: "CHUA_THANH_TOAN", da_gui: true, ngay_gui: new Date(), qua_han: true, ngay_qua_han: new Date() });
  const key = `mark-paid-${Date.now()}`; const first = await request(`/api/v1/bills/${bill.ma_thanh_toan}/mark-paid`, { method: "POST", headers: headers(landlord, { "Idempotency-Key": key }), body: "{}" });
  const again = await request(`/api/v1/bills/${bill.ma_thanh_toan}/mark-paid`, { method: "POST", headers: headers(landlord, { "Idempotency-Key": key }), body: "{}" });
  assert.equal(first.response.status, 201, JSON.stringify(first.body)); assert.equal(again.response.status, 201); assert.equal(await GiaoDichThanhToan.count({ where: { ma_thanh_toan: bill.ma_thanh_toan } }), 1);
  await bill.reload(); assert.equal(Number(bill.so_tien_con_no), 0);
  const revenueBeforeCancel = await request(`/api/v1/reports/cashflow?buildingId=${fresh.building.ma_can}`, { headers: headers(landlord) });
  assert.equal(revenueBeforeCancel.response.status, 200); assert.equal(revenueBeforeCancel.body.data.cashReceipts, 700000);
  const debtPaid = await request("/api/v1/debt", { headers: headers(landlord) }); assert.equal(debtPaid.body.data.some((row) => row.ma_thanh_toan === bill.ma_thanh_toan), false);
  const paymentId = first.body.data.payment.ma_giao_dich; const noReason = await request(`/api/v1/payments/${paymentId}/cancel`, { method: "POST", headers: headers(landlord), body: "{}" }); assert.equal(noReason.response.status, 422);
  const forbidden = await request(`/api/v1/payments/${paymentId}/cancel`, { method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({ reason: "x" }) }); assert.equal(forbidden.response.status, 403);
  const cancelled = await request(`/api/v1/payments/${paymentId}/cancel`, { method: "POST", headers: headers(landlord), body: JSON.stringify({ reason: "Ghi nhận nhầm" }) }); assert.equal(cancelled.response.status, 200, JSON.stringify(cancelled.body));
  const twice = await request(`/api/v1/payments/${paymentId}/cancel`, { method: "POST", headers: headers(landlord), body: JSON.stringify({ reason: "Lần hai" }) }); assert.equal(twice.response.status, 409);
  const confirmCancelled = await request(`/api/khoan-phai-thu/payment/${paymentId}/confirm`, { method: "POST", headers: headers(landlord), body: "{}" }); assert.equal(confirmCancelled.response.status, 409);
  await bill.reload(); assert.equal(Number(bill.so_tien_con_no), 700000); assert.equal((await KhoanThu.findOne({ where: { ma_giao_dich_thanh_toan: paymentId } })).trang_thai_ghi_nhan, "DA_HUY");
  const revenueAfterCancel = await request(`/api/v1/reports/cashflow?buildingId=${fresh.building.ma_can}`, { headers: headers(landlord) });
  assert.equal(revenueAfterCancel.response.status, 200); assert.equal(revenueAfterCancel.body.data.cashReceipts, 0);
  const debtAgain = await request("/api/v1/debt", { headers: headers(landlord) });
  const [year, month, day] = businessDate().split("-").map(Number);
  const expectedOverdue = actionDue(bill, { year, month, day }, await getPersistedSystemConfig()).overdue;
  assert.equal(bill.qua_han, true, "Historical cron flag remains unchanged after cancelling payment");
  assert.equal(debtAgain.body.data.find((row) => row.ma_thanh_toan === bill.ma_thanh_toan).isOverdue, expectedOverdue);
  const deposit = await GiaoDichThanhToan.create({ ma_thanh_toan: bill.ma_thanh_toan, so_tien: 1, trang_thai_xac_nhan: "DA_XAC_NHAN", thoi_diem_xac_nhan: new Date(), nguon_thanh_toan: "KHAU_TRU_COC" });
  const rejectDeposit = await request(`/api/v1/payments/${deposit.ma_giao_dich}/cancel`, { method: "POST", headers: headers(landlord), body: JSON.stringify({ reason: "Không hợp lệ" }) }); assert.equal(rejectDeposit.response.status, 409);
  await deposit.destroy();
});

test("FR-075 marks every periodic bill in one building/period atomically", async () => {
  const landlord = await login(integration.landlord); const first = await createFreshRental(landlord, "mark-all", { createAccount: false }); const unique = uniqueValues();
  const room = await request("/api/phong", { method: "POST", headers: headers(landlord), body: JSON.stringify({ ma_can: first.building.ma_can, so_phong: `ALL-${unique.suffix}`, dien_tich: 20, gia_thue: 2200000, so_nguoi_toi_da: 2, trang_thai: "TRONG" }) }); assert.equal(room.response.status, 201, JSON.stringify(room.body));
  const tenant = await request("/api/management/khach-thue", { method: "POST", headers: headers(landlord), body: JSON.stringify({ ho_ten: `All ${unique.suffix}`, so_dien_thoai: unique.phone, cccd_giay_to: unique.identity }) }); assert.equal(tenant.response.status, 201, JSON.stringify(tenant.body));
  const contract = await request("/api/hop-dong", { method: "POST", headers: headers(landlord), body: JSON.stringify({ ma_khach_thue: tenant.body.data.ma_khach_thue, ma_phong: room.body.data.ma_phong, ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-09-30", gia_thue: 2200000, tien_coc: 2200000, don_gia_dien: 3500, don_gia_nuoc: 100000, chi_so_dien_ban_dau: 0, dieu_khoan: "Mark all", ngay_nhan_coc: "2026-10-01", da_co_ban_giay_ky: true }) }); assert.equal(contract.response.status, 201, JSON.stringify(contract.body));
  const bills = await Promise.all([first.contract.ma_hop_dong, contract.body.data.ma_hop_dong].map((contractId) => ThanhToan.create({ ma_hop_dong: contractId, nam: 2027, thang: 1, loai_thanh_toan: "DINH_KY", tong_phai_tra: 500000, tong_da_thanh_toan: 0, so_tien_con_no: 500000, trang_thai: "CHUA_THANH_TOAN", da_gui: true, ngay_gui: new Date() })));
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  await assert.rejects(() => paymentLifecycleService.markAllPaid({ buildingId: first.building.ma_can, period: "2027-01", key: `rollback-${Date.now()}`, actorId: actor.ma_tai_khoan, failAfter: 1 }), (error) => error.code === "INJECTED_FAILURE");
  for (const bill of bills) { await bill.reload(); assert.equal(Number(bill.so_tien_con_no), 500000); assert.equal(await GiaoDichThanhToan.count({ where: { ma_thanh_toan: bill.ma_thanh_toan } }), 0); }
  const key = `all-${Date.now()}`; const marked = await request("/api/v1/bills/mark-all-paid", { method: "POST", headers: headers(landlord, { "Idempotency-Key": key }), body: JSON.stringify({ buildingId: first.building.ma_can, period: "2027-01" }) }); assert.equal(marked.response.status, 201, JSON.stringify(marked.body)); assert.equal(marked.body.data.processed, 2);
  const repeated = await request("/api/v1/bills/mark-all-paid", { method: "POST", headers: headers(landlord, { "Idempotency-Key": key }), body: JSON.stringify({ buildingId: first.building.ma_can, period: "2027-01" }) }); assert.equal(repeated.response.status, 201); assert.equal(repeated.body.data.processed, 0);
  const tenantToken = await login(integration.tenant); const forbidden = await request("/api/v1/bills/mark-all-paid", { method: "POST", headers: headers(tenantToken, { "Idempotency-Key": `forbidden-${Date.now()}` }), body: JSON.stringify({ buildingId: first.building.ma_can, period: "2027-01" }) }); assert.equal(forbidden.response.status, 403);
});

test("FR-200 configuration changes apply without restart and named lock admits one worker", async () => {
  const landlord = await login(integration.landlord);
  await request("/api/v1/system-config/billScheduleHour", { method: "PUT", headers: headers(landlord), body: JSON.stringify({ value: 8 }) });
  const auditCountBefore = await AuditLog.count({ where: { action: "SYSTEM_CONFIG_UPDATED" } });
  const changed = await request("/api/v1/system-config/billScheduleHour", { method: "PUT", headers: headers(landlord), body: JSON.stringify({ value: 9 }) });
  assert.equal(changed.response.status, 200, JSON.stringify(changed.body));
  const enabled = await request("/api/v1/system-config/billScheduleEnabled", { method: "PUT", headers: headers(landlord), body: JSON.stringify({ value: true }) });
  assert.equal(enabled.response.status, 200);
  const auditCountAfterConfig = await AuditLog.count({ where: { action: "SYSTEM_CONFIG_UPDATED" } });
  const beforeHour = await request("/api/v1/jobs/billing", { method: "POST", headers: headers(landlord), body: JSON.stringify({ now: "2027-02-02T08:00:00+07:00" }) });
  assert.equal(beforeHour.body.data.due, false);
  const configuredHour = await request("/api/v1/jobs/billing", { method: "POST", headers: headers(landlord), body: JSON.stringify({ now: "2027-02-02T09:00:00+07:00" }) });
  assert.equal(configuredHour.body.data.due, true);
  const missedScheduleDay = await request("/api/v1/jobs/billing", { method: "POST", headers: headers(landlord), body: JSON.stringify({ now: "2027-02-03T09:00:00+07:00" }) });
  assert.equal(missedScheduleDay.body.data.due, false, "a missed schedule day is skipped rather than caught up later");
  const invalid = await request("/api/v1/system-config/billScheduleDay", { method: "PUT", headers: headers(landlord), body: JSON.stringify({ value: 29 }) });
  assert.equal(invalid.response.status, 400);
  assert.equal(auditCountAfterConfig, auditCountBefore + 2);
  assert.equal(await AuditLog.count({ where: { action: "SYSTEM_CONFIG_UPDATED" } }), auditCountAfterConfig, "invalid configuration must not be audited as an update");
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const first = withNamedLock("qlpt:test:exclusive", async () => { await held; return { worker: 1 }; });
  await new Promise((resolve) => setTimeout(resolve, 50));
  const second = await withNamedLock("qlpt:test:exclusive", async () => ({ worker: 2 }));
  release();
  assert.equal(second.lockAcquired, false);
  assert.equal((await first).worker, 1);
  await request("/api/v1/system-config/billScheduleHour", { method: "PUT", headers: headers(landlord), body: JSON.stringify({ value: 8 }) });
  await request("/api/v1/system-config/billScheduleEnabled", { method: "PUT", headers: headers(landlord), body: JSON.stringify({ value: false }) });
});

test("FR-151 enabled automatic schedule creates one July draft and disabled schedule does not run", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "billing-auto-schedule");
  await confirmedReading(fresh, "2027-06", 80);
  const original = await request("/api/v1/bills/schedule", { headers: headers(landlord) });
  assert.equal(original.response.status, 200, JSON.stringify(original.body));
  const putSchedule = (enabled) => request("/api/v1/bills/schedule", { method: "PUT", headers: headers(landlord), body: JSON.stringify({ enabled, day: 2, hour: 8, buildingIds: [fresh.building.ma_can] }) });
  try {
    assert.equal((await putSchedule(false)).response.status, 200);
    const dueTime = new Date("2027-07-02T08:00:00+07:00");
    assert.equal((await billingCronService.run({ now: dueTime })).due, false);
    assert.equal(await ThanhToan.count({ where: { ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2027, thang: 7 } }), 0);
    assert.equal((await putSchedule(true)).response.status, 200);
    assert.equal((await billingCronService.run({ now: new Date("2027-07-02T07:00:00+07:00") })).due, false);
    const first = await billingCronService.run({ now: dueTime });
    assert.equal(first.due, true);
    assert.ok(first.created >= 1);
    assert.equal(first.sent, 0);
    const bill = await ThanhToan.findOne({ where: { ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2027, thang: 7, loai_thanh_toan: "DINH_KY" } });
    assert.ok(bill);
    assert.equal(bill.da_gui, false);
    const repeat = await billingCronService.run({ now: dueTime });
    assert.equal(repeat.alreadyRan, true);
    assert.equal(repeat.created, 0);
    assert.equal(await ThanhToan.count({ where: { ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2027, thang: 7 } }), 1);
  } finally {
    const before = original.body.data;
    await request("/api/v1/bills/schedule", { method: "PUT", headers: headers(landlord), body: JSON.stringify({ enabled: before.enabled, day: before.day, hour: before.hour, buildingIds: before.buildingIds }) });
  }
});
