const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const { TaiKhoan, ChuTro, HopDong, PhongTro, ThongBao } = require("../src/models");
const reservationService = require("../src/services/reservation.service");
const cronJobs = require("../src/jobs/cron.jobs");
const { integration, request, headers, login, createBaseRental, createFreshRental } = require("./helpers/integration-api");

test("FR-159 only the owning landlord receives reservation, contract and broadcast notifications", async () => {
  const ownerA = await login(integration.landlord);
  const accountB = await TaiKhoan.create({
    ten_dang_nhap: `notif${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("B-notification-test", 10),
    vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false,
  });
  await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "Chu tro B", so_dien_thoai: "0987654311" });
  const ownerB = jwt.sign({ ma_tai_khoan: accountB.ma_tai_khoan, ten_dang_nhap: accountB.ten_dang_nhap, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET, { expiresIn: "1h" });

  try {
    const holdA = await createBaseRental(ownerA, "notice-hold-a");
    const holdB = await createBaseRental(ownerB, "notice-hold-b");
    const rentalA = await createFreshRental(ownerA, "notice-contract-a");
    const rentalB = await createFreshRental(ownerB, "notice-contract-b");
    // Same visible room number must not become an ownership key.
    await PhongTro.update({ so_phong: holdA.room.so_phong }, { where: { ma_phong: holdB.room.ma_phong } });
    await PhongTro.update({ so_phong: rentalA.room.so_phong }, { where: { ma_phong: rentalB.room.ma_phong } });

    const payload = (rental) => ({ roomId: rental.room.ma_phong, holderName: "Holder", phone: rental.unique.phone,
      amount: 1000000, receivedOn: "2026-10-01", expiresOn: "2026-10-10", terms: "Test" });
    const reservationA = await reservationService.create(payload(holdA), (await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } })).ma_tai_khoan);
    const reservationB = await reservationService.create(payload(holdB), accountB.ma_tai_khoan);
    const now = new Date("2026-10-16T00:00:00Z");
    const first = await reservationService.notifyExpired({ now });
    const second = await reservationService.notifyExpired({ now });
    assert.ok(first.created >= 2);
    assert.equal(second.created, 0);
    const keyA = `GIU_PHONG_HET_HAN:${reservationA.ma_dat_giu}:2026-10-16`;
    const keyB = `GIU_PHONG_HET_HAN:${reservationB.ma_dat_giu}:2026-10-16`;
    assert.equal(await ThongBao.count({ where: { khoa_su_kien: keyA } }), 1);
    assert.equal(await ThongBao.count({ where: { khoa_su_kien: keyB } }), 1);
    const notificationsA = await request("/api/v1/notifications", { headers: headers(ownerA) });
    const notificationsB = await request("/api/v1/notifications", { headers: headers(ownerB) });
    assert.equal(notificationsA.response.status, 200);
    assert.equal(notificationsB.response.status, 200);
    assert.ok(notificationsA.body.data.some((row) => row.khoa_su_kien === keyA));
    assert.ok(!notificationsA.body.data.some((row) => row.khoa_su_kien === keyB));
    assert.ok(notificationsB.body.data.some((row) => row.khoa_su_kien === keyB));
    assert.ok(!notificationsB.body.data.some((row) => row.khoa_su_kien === keyA));

    await HopDong.update({ ngay_bat_dau: "2025-01-01", ngay_ket_thuc: "2026-10-01", trang_thai: "DANG_HIEU_LUC" },
      { where: { ma_hop_dong: [rentalA.contract.ma_hop_dong, rentalB.contract.ma_hop_dong] } });
    await cronJobs.updateContractStates();
    for (const [contract, ownerAccount, otherAccount] of [
      [rentalA.contract, (await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } })).ma_tai_khoan, accountB.ma_tai_khoan],
      [rentalB.contract, accountB.ma_tai_khoan, (await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } })).ma_tai_khoan],
    ]) {
      const prefix = `HOP_DONG:${contract.ma_hop_dong}:`;
      assert.equal(await ThongBao.count({ where: { ma_tai_khoan: ownerAccount, khoa_su_kien: { [require("sequelize").Op.like]: `${prefix}%` } } }), 1);
      assert.equal(await ThongBao.count({ where: { ma_tai_khoan: otherAccount, khoa_su_kien: { [require("sequelize").Op.like]: `${prefix}%` } } }), 0);
    }

    const broadcastKey = `BROADCAST:${crypto.randomUUID()}`;
    const foreign = await request("/api/v1/notifications/broadcast", { method: "POST", headers: headers(ownerA),
      body: JSON.stringify({ subject: "A only", content: "Private", maBroadcast: broadcastKey.slice(10), recipientIds: [rentalB.account.ma_tai_khoan] }) });
    assert.equal(foreign.response.status, 404);
    assert.equal(await ThongBao.count({ where: { khoa_su_kien: broadcastKey } }), 0);
    const sent = await request("/api/v1/notifications/broadcast", { method: "POST", headers: headers(ownerA),
      body: JSON.stringify({ subject: "A only", content: "Private", maBroadcast: broadcastKey.slice(10) }) });
    assert.equal(sent.response.status, 201, JSON.stringify(sent.body));
    assert.ok(sent.body.data.sent >= 1);
    assert.equal(await ThongBao.count({ where: { khoa_su_kien: broadcastKey, ma_tai_khoan: rentalB.account.ma_tai_khoan } }), 0);
    assert.equal(await ThongBao.count({ where: { khoa_su_kien: broadcastKey, ma_tai_khoan: rentalA.account.ma_tai_khoan } }), 1);
  } finally {
    // Preserve the single-active-landlord fixture expected by unrelated legacy tests.
    await accountB.update({ trang_thai: "DA_KHOA" });
  }
});
