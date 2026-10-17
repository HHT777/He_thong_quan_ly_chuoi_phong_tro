const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { TaiKhoan, ChuTro, DatGiuPhong, LichSuGiaHanGiuPhong, KhoanThu, AuditLog, PhongTro } = require("../src/models");
const { integration, request, headers, login, createBaseRental } = require("./helpers/integration-api");

async function holdFixture(label) {
  const landlord = await login(integration.landlord);
  const fresh = await createBaseRental(landlord, label);
  const created = await request("/api/v1/reservations", { method: "POST", headers: headers(landlord), body: JSON.stringify({ roomId: fresh.room.ma_phong, holderName: "Holder", phone: fresh.unique.phone, amount: 1000000, receivedOn: "2026-10-01", expiresOn: "2026-10-20", terms: "Theo thỏa thuận" }) });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  return { landlord, fresh, id: created.body.data.ma_dat_giu };
}

test("FR-168/169 protected history and quote reads have validation and no writes", async () => {
  const { landlord, id } = await holdFixture("reservation-read");
  const extended = await request(`/api/v1/reservations/${id}/extend`, { method: "PATCH", headers: headers(landlord), body: JSON.stringify({ expiresOn: "2026-10-25", reason: "Gia hạn" }) });
  assert.equal(extended.response.status, 200);
  const before = await Promise.all([DatGiuPhong.count(), LichSuGiaHanGiuPhong.count(), KhoanThu.count(), AuditLog.count()]);
  const history = await request(`/api/v1/reservations/${id}/extension-history`, { headers: headers(landlord) });
  const quote = await request(`/api/v1/reservations/${id}/cancellation-quote?refundAmount=300000`, { headers: headers(landlord) });
  assert.equal(history.response.status, 200, JSON.stringify(history.body));
  assert.equal(history.body.data.length, 1);
  assert.equal(history.body.data[0].oldExpiry, "2026-10-20");
  assert.ok(history.body.data[0].actorId);
  assert.equal(quote.response.status, 200, JSON.stringify(quote.body));
  assert.equal(Number(quote.body.data.refundAmount), 300000);
  assert.equal(Number(quote.body.data.nonRefundAmount), 700000);
  assert.ok(quote.body.data.basis);
  assert.deepEqual(await Promise.all([DatGiuPhong.count(), LichSuGiaHanGiuPhong.count(), KhoanThu.count(), AuditLog.count()]), before);
  for (const url of [`/api/v1/reservations/bad/extension-history`, `/api/v1/reservations/${id}/cancellation-quote?refundAmount=nope`]) assert.equal((await request(url, { headers: headers(landlord) })).response.status, 400);
  assert.equal((await request(`/api/v1/reservations/${crypto.randomUUID()}/extension-history`, { headers: headers(landlord) })).response.status, 404);
  const tenant = await login(integration.tenant);
  assert.equal((await request(`/api/v1/reservations/${id}/extension-history`, { headers: headers(tenant) })).response.status, 403);
  assert.equal((await request(`/api/v1/reservations/${id}/cancellation-quote?refundAmount=300000`, { headers: headers(tenant) })).response.status, 403);
  const rogue = await TaiKhoan.create({ ten_dang_nhap: `oth${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("TestPass123!", 10), vai_tro: "CHU_TRO", trang_thai: "DA_KHOA" });
  await ChuTro.create({ ma_tai_khoan: rogue.ma_tai_khoan, ho_ten: "Other owner", so_dien_thoai: "0987654314" });
  const rogueToken = jwt.sign({ ma_tai_khoan: rogue.ma_tai_khoan, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET);
  assert.equal((await request(`/api/v1/reservations/${id}/cancellation-quote?refundAmount=300000`, { headers: headers(rogueToken) })).response.status, 403);
  const cancelled = await request(`/api/v1/reservations/${id}/cancel`, { method: "POST", headers: headers(landlord), body: JSON.stringify({ refundAmount: 300000, expectedRefundAmount: quote.body.data.refundAmount, reason: "Hủy" }) });
  assert.equal(cancelled.response.status, 200, JSON.stringify(cancelled.body));
  assert.equal(Number(cancelled.body.data.so_tien_hoan), Number(quote.body.data.refundAmount));
  assert.equal((await request(`/api/v1/reservations/${id}/extension-history`, { headers: headers(landlord) })).response.status, 409);
  assert.equal((await request(`/api/v1/reservations/${id}/cancellation-quote?refundAmount=300000`, { headers: headers(landlord) })).response.status, 409);
});

test("FR-169 stale refund quote rolls back and concurrent cancellation has one winner", async () => {
  const { landlord, fresh, id } = await holdFixture("reservation-race-quote");
  const url = `/api/v1/reservations/${id}/cancel`;
  const bad = await request(url, { method: "POST", headers: headers(landlord), body: JSON.stringify({ refundAmount: 300000, expectedRefundAmount: 200000, reason: "Hủy" }) });
  assert.equal(bad.response.status, 409);
  assert.equal(bad.body.error?.code || bad.body.code, "RESERVATION_REFUND_QUOTE_CHANGED");
  assert.equal((await DatGiuPhong.findByPk(id)).trang_thai, "DANG_GIU");
  assert.equal((await PhongTro.findByPk(fresh.room.ma_phong)).trang_thai, "DA_GIU");
  const body = JSON.stringify({ refundAmount: 300000, expectedRefundAmount: 300000, reason: "Hủy" });
  const raced = await Promise.all([request(url, { method: "POST", headers: headers(landlord), body }), request(url, { method: "POST", headers: headers(landlord), body })]);
  assert.deepEqual(raced.map(({ response }) => response.status).sort(), [200, 409]);
  assert.equal((await DatGiuPhong.findByPk(id)).trang_thai, "DA_HUY");
});
