const test = require("node:test");
const assert = require("node:assert/strict");
const { DatGiuPhong, LichSuGiaHanGiuPhong, KhoanThu, ThongBao, AuditLog, PhongTro } = require("../src/models");
const reservationService = require("../src/services/reservation.service");
const { integration, request, headers, login, createBaseRental } = require("./helpers/integration-api");

test("FR-167..170 UC-26 reservation completes create, extend, cancel/refund, expiry, conversion, race and RBAC", async () => {
  const owner = await login(integration.landlord);

  const first = await createBaseRental(owner, "reservation-lifecycle");
  const auditBefore = await AuditLog.count({ where: { action: "ROOM_RESERVED" } });
  const created = await request("/api/v1/reservations", { method: "POST", headers: headers(owner), body: JSON.stringify({ roomId: first.room.ma_phong, holderName: "Holder", phone: first.unique.phone, amount: 1000000, receivedOn: "2026-10-01", expiresOn: "2026-10-20", terms: "Hoàn 300000 nếu hủy" }) });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  assert.equal((await PhongTro.findByPk(first.room.ma_phong)).trang_thai, "DA_GIU");
  assert.equal(await AuditLog.count({ where: { action: "ROOM_RESERVED" } }), auditBefore + 1);

  const extended = await request(`/api/v1/reservations/${created.body.data.ma_dat_giu}/extend`, { method: "PATCH", headers: headers(owner), body: JSON.stringify({ expiresOn: "2026-10-25", reason: "Khách hẹn lại" }) });
  assert.equal(extended.response.status, 200);
  assert.equal(await LichSuGiaHanGiuPhong.count({ where: { ma_dat_giu: created.body.data.ma_dat_giu } }), 1);
  const cancelled = await request(`/api/v1/reservations/${created.body.data.ma_dat_giu}/cancel`, { method: "POST", headers: headers(owner), body: JSON.stringify({ refundAmount: 300000, reason: "Hủy theo thỏa thuận" }) });
  assert.equal(cancelled.response.status, 200);
  assert.equal((await PhongTro.findByPk(first.room.ma_phong)).trang_thai, "TRONG");
  assert.equal(await KhoanThu.count({ where: { loai_khoan_thu: "GIU_PHONG_KHONG_HOAN", so_tien: 700000 } }), 1);

  const expired = await createBaseRental(owner, "reservation-expiry");
  const expiredRes = await reservationService.create({ roomId: expired.room.ma_phong, holderName: "Expired", phone: expired.unique.phone, amount: 500000, receivedOn: "2026-10-01", expiresOn: "2026-10-10", terms: "Không hoàn" }, (await require("../src/models").TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } })).ma_tai_khoan);
  const beforeNotice = await ThongBao.count({ where: { khoa_su_kien: `GIU_PHONG_HET_HAN:${expiredRes.ma_dat_giu}:2026-10-16` } });
  await reservationService.notifyExpired({ now: new Date("2026-10-16T00:00:00Z") });
  await reservationService.notifyExpired({ now: new Date("2026-10-16T00:00:00Z") });
  assert.equal((await PhongTro.findByPk(expired.room.ma_phong)).trang_thai, "TRONG");
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: `GIU_PHONG_HET_HAN:${expiredRes.ma_dat_giu}:2026-10-16` } }), beforeNotice + 1);

  const race = await createBaseRental(owner, "reservation-race");
  const raceBody = (phone) => ({ roomId: race.room.ma_phong, holderName: "Race", phone, amount: 1, receivedOn: "2026-10-01", expiresOn: "2026-10-20", terms: "race" });
  const [r1, r2] = await Promise.all([request("/api/v1/reservations", { method: "POST", headers: headers(owner), body: JSON.stringify(raceBody(race.unique.phone)) }), request("/api/v1/reservations", { method: "POST", headers: headers(owner), body: JSON.stringify(raceBody(`09${Date.now()}`)) })]);
  assert.equal([r1, r2].filter((r) => r.response.status === 201).length, 1);
  assert.equal([r1, r2].filter((r) => r.response.status === 409).length, 1);

  const convert = await createBaseRental(owner, "reservation-convert");
  const hold = await reservationService.create({ roomId: convert.room.ma_phong, holderName: "Converter", phone: convert.unique.phone, amount: 3000000, receivedOn: "2026-10-01", expiresOn: "2026-10-20", terms: "Trừ vào cọc" }, (await require("../src/models").TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } })).ma_tai_khoan);
  const contract = await request("/api/hop-dong", { method: "POST", headers: headers(owner), body: JSON.stringify({ ma_khach_thue: convert.tenant.ma_khach_thue, ma_phong: convert.room.ma_phong, ma_dat_giu: hold.ma_dat_giu, ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-09-30", gia_thue: 2500000, tien_coc: 2500000, don_gia_dien: 3500, don_gia_nuoc: 100000, chi_so_dien_ban_dau: 0, dieu_khoan: "Converted", ngay_nhan_coc: "2026-10-01", da_co_ban_giay_ky: true }) });
  assert.equal(contract.response.status, 201, JSON.stringify(contract.body));
  assert.equal((await DatGiuPhong.findByPk(hold.ma_dat_giu)).trang_thai, "DA_CHUYEN_THANH_HOP_DONG");
  assert.equal((await PhongTro.findByPk(convert.room.ma_phong)).trang_thai, "DANG_THUE");

  const tenant = await createBaseRental(owner, "reservation-rbac");
  const tenantContract = await request("/api/hop-dong", { method: "POST", headers: headers(owner), body: JSON.stringify({ ma_khach_thue: tenant.tenant.ma_khach_thue, ma_phong: tenant.room.ma_phong, ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-09-30", gia_thue: 2500000, tien_coc: 2500000, don_gia_dien: 3500, don_gia_nuoc: 100000, chi_so_dien_ban_dau: 0, dieu_khoan: "RBAC", ngay_nhan_coc: "2026-10-01", da_co_ban_giay_ky: true }) });
  assert.equal(tenantContract.response.status, 201);
  const account = await request("/api/v1/accounts", { method: "POST", headers: headers(owner), body: JSON.stringify({ tenantId: tenant.tenant.ma_khach_thue }) });
  assert.equal(account.response.status, 201);
  const initial = await login({ username: tenant.unique.phone, password: "1" });
  await request("/api/v1/account/password", { method: "PATCH", headers: headers(initial), body: JSON.stringify({ currentPassword: "1", newPassword: integration.newAccountPassword }) });
  const tenantToken = await login({ username: tenant.unique.phone, password: integration.newAccountPassword });
  const forbidden = await request("/api/v1/reservations", { method: "POST", headers: headers(tenantToken), body: JSON.stringify({ roomId: tenant.room.ma_phong, holderName: "x", phone: "0900000000", amount: 1, receivedOn: "2026-10-01", expiresOn: "2026-10-20", terms: "x" }) });
  assert.equal(forbidden.response.status, 403);
});
