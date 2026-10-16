const test = require("node:test");
const assert = require("node:assert/strict");
const { ThongBao, TaiKhoan, DatGiuPhong, HopDong } = require("../src/models");
const { createIdempotent } = require("../src/services/notification.service");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

test("FR-159 event key schema permits legacy NULL rows without collisions", async () => {
  const landlord = await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } });
  const before = await ThongBao.count({ where: { ma_tai_khoan: landlord.ma_tai_khoan, khoa_su_kien: null } });
  await ThongBao.create({ ma_tai_khoan: landlord.ma_tai_khoan, loai_thong_bao: "TEST", noi_dung: "legacy-a", khoa_su_kien: null });
  await ThongBao.create({ ma_tai_khoan: landlord.ma_tai_khoan, loai_thong_bao: "TEST", noi_dung: "legacy-b", khoa_su_kien: null });
  assert.equal(await ThongBao.count({ where: { ma_tai_khoan: landlord.ma_tai_khoan, khoa_su_kien: null } }), before + 2);
});

test("FR-159 reservation expiry race creates exactly one event-key notification", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "notification-reservation-race", { createAccount: false });
  const owner = await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } });
  const reservation = await DatGiuPhong.create({ ho_ten_nguoi_giu: "Race", so_dien_thoai: fresh.unique.phone, so_tien_giu: 1, ngay_nhan: "2026-01-01", han_giu: "2026-01-02", dieu_kien: "race", ma_phong: fresh.room.ma_phong, nguoi_thuc_hien_id: owner.ma_tai_khoan });
  const eventKey = `GIU_PHONG_HET_HAN:${reservation.ma_dat_giu}:2026-10-16`;
  const [a, b] = await Promise.all([
    createIdempotent({ ma_tai_khoan: (await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } })).ma_tai_khoan, loai_thong_bao: "GIU_PHONG_QUA_HAN", noi_dung: "race", khoa_su_kien: eventKey }),
    createIdempotent({ ma_tai_khoan: (await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } })).ma_tai_khoan, loai_thong_bao: "GIU_PHONG_QUA_HAN", noi_dung: "race", khoa_su_kien: eventKey }),
  ]);
  assert.equal(a.created + b.created, 1);
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: eventKey } }), 1);
});

test("FR-159 contract expiry race uses the event key and emits one notification per recipient", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "notification-contract-race", { createAccount: false });
  await HopDong.update({ ngay_bat_dau: "2025-01-01", ngay_ket_thuc: "2026-01-01", trang_thai: "DANG_HIEU_LUC" }, { where: { ma_hop_dong: fresh.contract.ma_hop_dong } });
  const eventKey = `HOP_DONG:${fresh.contract.ma_hop_dong}:2026-10-16`;
  const account = (await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } })).ma_tai_khoan;
  const results = await Promise.all([1, 2].map(() => createIdempotent({ ma_tai_khoan: account, loai_thong_bao: "HOP_DONG", noi_dung: "expired", khoa_su_kien: eventKey })));
  assert.equal(results.filter((item) => item.created).length, 1);
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: eventKey } }), 1);
});

test("FR-159 broadcast retry with the same maBroadcast returns sent=0 and skipped=N", async () => {
  const landlord = await login(integration.landlord); const maBroadcast = `IT-BROADCAST-${Date.now()}`;
  const first = await request("/api/v1/notifications/broadcast", { method: "POST", headers: headers(landlord), body: JSON.stringify({ subject: "Race", content: "Retry", maBroadcast }) });
  assert.equal(first.response.status, 201); assert.equal(first.body.data.sent, first.body.data.recipients);
  const second = await request("/api/v1/notifications/broadcast", { method: "POST", headers: headers(landlord), body: JSON.stringify({ subject: "Race", content: "Retry", maBroadcast }) });
  assert.equal(second.response.status, 201); assert.equal(second.body.data.sent, 0); assert.equal(second.body.data.skipped, second.body.data.recipients);
});

test("FR-159 idempotent insert race is decided by the database unique key", async () => {
  const landlord = await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } });
  const values = { ma_tai_khoan: landlord.ma_tai_khoan, loai_thong_bao: "TEST_RACE", noi_dung: "same", khoa_su_kien: `TEST_RACE:${Date.now()}` };
  const results = await Promise.all([createIdempotent(values), createIdempotent(values)]);
  assert.equal(results.filter((item) => item.created).length, 1);
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: values.khoa_su_kien } }), 1);
});
