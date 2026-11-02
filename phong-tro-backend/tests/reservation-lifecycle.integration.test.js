const test = require("node:test");
const assert = require("node:assert/strict");
const { DatGiuPhong, LichSuGiaHanGiuPhong, KhoanThu, ThongBao, AuditLog, PhongTro, TaiKhoan } = require("../src/models");
const reservationService = require("../src/services/reservation.service");
const { integration, request, headers, login, createBaseRental } = require("./helpers/integration-api");

const owner = () => login(integration.landlord);
const ownerId = async () => (await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } })).ma_tai_khoan;
const payload = (roomId, phone, extra = {}) => ({ roomId, holderName: "Holder", phone, amount: 1000000, receivedOn: "2026-10-01", expiresOn: "2026-10-20", terms: "Theo thỏa thuận", ...extra });

test("FR-167 reservation changes TRONG to DA_GIU and rejects a non-empty room", async () => {
  const token = await owner(); const fresh = await createBaseRental(token, "reservation-create");
  const created = await request("/api/v1/reservations", { method: "POST", headers: headers(token), body: JSON.stringify(payload(fresh.room.ma_phong, fresh.unique.phone)) });
  assert.equal(created.response.status, 201); assert.equal((await PhongTro.findByPk(fresh.room.ma_phong)).trang_thai, "DA_GIU");
  const rejected = await request("/api/v1/reservations", { method: "POST", headers: headers(token), body: JSON.stringify(payload(fresh.room.ma_phong, fresh.unique.phone)) }); assert.equal(rejected.response.status, 409);
});

test("FR-168 reservation extension records its history", async () => {
  const token = await owner(); const fresh = await createBaseRental(token, "reservation-extend");
  const created = await request("/api/v1/reservations", { method: "POST", headers: headers(token), body: JSON.stringify(payload(fresh.room.ma_phong, fresh.unique.phone)) });
  const extended = await request(`/api/v1/reservations/${created.body.data.ma_dat_giu}/extend`, { method: "PATCH", headers: headers(token), body: JSON.stringify({ expiresOn: "2026-10-25", reason: "Gia hạn" }) });
  assert.equal(extended.response.status, 200); assert.equal(await LichSuGiaHanGiuPhong.count({ where: { ma_dat_giu: created.body.data.ma_dat_giu } }), 1);
});

test("FR-169 cancellation returns agreed refund and records non-refundable income", async () => {
  const token = await owner(); const fresh = await createBaseRental(token, "reservation-cancel");
  const created = await request("/api/v1/reservations", { method: "POST", headers: headers(token), body: JSON.stringify(payload(fresh.room.ma_phong, fresh.unique.phone)) });
  const cancelled = await request(`/api/v1/reservations/${created.body.data.ma_dat_giu}/cancel`, { method: "POST", headers: headers(token), body: JSON.stringify({ refundAmount: 300000, reason: "Hủy" }) });
  assert.equal(cancelled.response.status, 200); assert.equal((await PhongTro.findByPk(fresh.room.ma_phong)).trang_thai, "TRONG"); assert.equal(await KhoanThu.count({ where: { loai_khoan_thu: "GIU_PHONG_KHONG_HOAN", so_tien: 700000 } }), 1);
});

test("FR-168 expiry only notifies once and keeps room and hold DA_GIU", async () => {
  const token = await owner(); const fresh = await createBaseRental(token, "reservation-expiry");
  const hold = await reservationService.create(payload(fresh.room.ma_phong, fresh.unique.phone, { expiresOn: "2026-10-10" }), await ownerId());
  const key = `GIU_PHONG_HET_HAN:${hold.ma_dat_giu}:2026-10-16`;
  await reservationService.notifyExpired({ now: new Date("2026-10-16T00:00:00Z") }); await reservationService.notifyExpired({ now: new Date("2026-10-16T00:00:00Z") });
  assert.equal((await PhongTro.findByPk(fresh.room.ma_phong)).trang_thai, "DA_GIU"); assert.equal((await DatGiuPhong.findByPk(hold.ma_dat_giu)).trang_thai, "DANG_GIU"); assert.equal(await ThongBao.count({ where: { khoa_su_kien: key } }), 1);
  const list = await request("/api/v1/reservations", { headers: headers(token) }); assert.equal(list.body.data.find((r) => r.ma_dat_giu === hold.ma_dat_giu).quaHan, true);
});

test("FR-170 valid hold converts to contract and room becomes DANG_THUE", async () => {
  const token = await owner(); const fresh = await createBaseRental(token, "reservation-convert");
  const hold = await reservationService.create(payload(fresh.room.ma_phong, fresh.unique.phone, { holderName: "Converter", amount: 3000000 }), await ownerId());
  const contract = await request("/api/hop-dong", { method: "POST", headers: headers(token), body: JSON.stringify({ ma_khach_thue: fresh.tenant.ma_khach_thue, ma_phong: fresh.room.ma_phong, ma_dat_giu: hold.ma_dat_giu, ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-09-30", gia_thue: 2500000, tien_coc: 2500000, don_gia_dien: 3500, don_gia_nuoc: 100000, chi_so_dien_ban_dau: 0, dieu_khoan: "Converted", ngay_nhan_coc: "2026-10-01", da_co_ban_giay_ky: true }) });
  assert.equal(contract.response.status, 201); assert.equal((await DatGiuPhong.findByPk(hold.ma_dat_giu)).trang_thai, "DA_CHUYEN_THANH_HOP_DONG"); assert.equal((await PhongTro.findByPk(fresh.room.ma_phong)).trang_thai, "DANG_THUE");
});

test("FR-167 concurrent reservations have one winner and one conflict", async () => {
  const token = await owner(); const fresh = await createBaseRental(token, "reservation-race"); const body = payload(fresh.room.ma_phong, fresh.unique.phone);
  const [a, b] = await Promise.all([request("/api/v1/reservations", { method: "POST", headers: headers(token), body: JSON.stringify(body) }), request("/api/v1/reservations", { method: "POST", headers: headers(token), body: JSON.stringify({ ...body, phone: `09${Date.now()}` }) })]);
  assert.equal([a, b].filter((r) => r.response.status === 201).length, 1); assert.equal([a, b].filter((r) => r.response.status === 409).length, 1);
});

test("FR-167 reservation route is landlord-only", async () => {
  const token = await owner(); const fresh = await createBaseRental(token, "reservation-rbac");
  const contract = await request("/api/hop-dong", { method: "POST", headers: headers(token), body: JSON.stringify({ ma_khach_thue: fresh.tenant.ma_khach_thue, ma_phong: fresh.room.ma_phong, ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-09-30", gia_thue: 2500000, tien_coc: 2500000, don_gia_dien: 3500, don_gia_nuoc: 100000, chi_so_dien_ban_dau: 0, dieu_khoan: "RBAC", ngay_nhan_coc: "2026-10-01", da_co_ban_giay_ky: true }) }); assert.equal(contract.response.status, 201);
  const account = await request("/api/v1/accounts", { method: "POST", headers: headers(token), body: JSON.stringify({ tenantId: fresh.tenant.ma_khach_thue }) }); assert.equal(account.response.status, 201);
  const initial = await login({ username: fresh.unique.phone, password: "1" }); await request("/api/v1/account/password", { method: "PATCH", headers: headers(initial), body: JSON.stringify({ currentPassword: "1", newPassword: integration.newAccountPassword }) }); const tenant = await login({ username: fresh.unique.phone, password: integration.newAccountPassword });
  const forbidden = await request("/api/v1/reservations", { method: "POST", headers: headers(tenant), body: JSON.stringify(payload(fresh.room.ma_phong, fresh.unique.phone)) }); assert.equal(forbidden.response.status, 403);
});

test("FR-167 reservation creation writes exactly one audit row", async () => {
  const token = await owner(); const fresh = await createBaseRental(token, "reservation-audit"); const before = await AuditLog.count({ where: { action: "ROOM_RESERVED" } });
  const created = await request("/api/v1/reservations", { method: "POST", headers: headers(token), body: JSON.stringify(payload(fresh.room.ma_phong, fresh.unique.phone)) }); assert.equal(created.response.status, 201); assert.equal(await AuditLog.count({ where: { action: "ROOM_RESERVED" } }), before + 1);
});

