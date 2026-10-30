const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { TaiKhoan, ChuTro, YeuCau, DeXuatBanCungPhong, ThanhVienPhong, AuditLog } = require("../src/models");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

test("FR-166 detail is read-only and limited to owner and proposing tenant", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "proposal-detail");
  const body = { name: "Người ở test", phone: "0987654312", identityNumber: "079203009999", birthDate: "2003-05-12", gender: "NAM", permanentAddress: "TP HCM", relationship: "BAN", startDate: "2026-10-15" };
  const created = await request("/api/v1/co-tenants", { method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify(body) });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const id = created.body.data.request.ma_yeu_cau;
  const url = `/api/v1/co-tenant-proposals/${id}`;
  const legacyId = `legacy-${Date.now()}`;
  const originalRequest = await YeuCau.findByPk(id);
  const originalProposal = await DeXuatBanCungPhong.findByPk(id);
  await YeuCau.create({ ...originalRequest.get({ plain: true }), ma_yeu_cau: legacyId });
  await DeXuatBanCungPhong.create({ ...originalProposal.get({ plain: true }), ma_yeu_cau: legacyId });
  assert.equal((await request(`/api/v1/co-tenant-proposals/${legacyId}`, { headers: headers(landlord) })).response.status, 200);
  const countsBefore = await Promise.all([YeuCau.count(), DeXuatBanCungPhong.count(), ThanhVienPhong.count(), AuditLog.count()]);
  const owner = await request(url, { headers: headers(landlord) });
  const proposer = await request(url, { headers: headers(fresh.tenantToken) });
  assert.equal(owner.response.status, 200, JSON.stringify(owner.body));
  assert.equal(proposer.response.status, 200);
  assert.equal(owner.body.data.identityNumber, body.identityNumber);
  assert.equal(owner.body.data.room.capacity, 2);
  assert.equal(owner.body.data.contract.id, fresh.contract.ma_hop_dong);
  assert.deepEqual(await Promise.all([YeuCau.count(), DeXuatBanCungPhong.count(), ThanhVienPhong.count(), AuditLog.count()]), countsBefore);
  const otherTenant = await login(integration.otherTenant);
  assert.equal((await request(url, { headers: headers(otherTenant) })).response.status, 403);
  const otherRole = jwt.sign({ ma_tai_khoan: crypto.randomUUID(), vai_tro: "ADMIN" }, process.env.JWT_SECRET);
  assert.equal((await request(url, { headers: headers(otherRole) })).response.status, 403);
  const rogueAccount = await TaiKhoan.create({ ten_dang_nhap: `own${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("TestPass123!", 10), vai_tro: "CHU_TRO", trang_thai: "DA_KHOA" });
  await ChuTro.create({ ma_tai_khoan: rogueAccount.ma_tai_khoan, ho_ten: "Other owner", so_dien_thoai: "0987654320" });
  const rogue = jwt.sign({ ma_tai_khoan: rogueAccount.ma_tai_khoan, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET);
  assert.equal((await request(url, { headers: headers(rogue) })).response.status, 404);
  assert.equal((await request("/api/v1/co-tenant-proposals/bad!", { headers: headers(landlord) })).response.status, 400);
  assert.equal((await request("/api/v1/co-tenant-proposals/bad", { headers: headers(landlord) })).response.status, 404);
  assert.equal((await request(`/api/v1/co-tenant-proposals/${crypto.randomUUID()}`, { headers: headers(landlord) })).response.status, 404);
  const list = await request("/api/v1/requests", { headers: headers(landlord) });
  assert.equal(JSON.stringify(list.body.data).includes(body.identityNumber), false);
});

test("FR-166 approval rejects each missing identity field and succeeds when complete", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "proposal-required");
  const body = { name: "Người ở đủ", phone: "0987654313", identityNumber: "079203008888", birthDate: "2003-05-12", gender: "NAM", permanentAddress: "TP HCM", relationship: "BAN", startDate: "2026-10-15" };
  const created = await request("/api/v1/co-tenants", { method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify(body) });
  assert.equal(created.response.status, 201);
  const id = created.body.data.request.ma_yeu_cau;
  const proposal = await DeXuatBanCungPhong.findByPk(id);
  const fields = ["ho_ten_nguoi_de_xuat", "so_dien_thoai_nguoi_de_xuat", "cccd_giay_to", "ngay_sinh", "gioi_tinh", "dia_chi_thuong_tru", "quan_he", "ngay_bat_dau_o"];
  for (const field of fields) {
    const original = proposal[field];
    await proposal.update({ [field]: ["ngay_sinh", "ngay_bat_dau_o"].includes(field) ? null : "" });
    const blocked = await request(`/api/v1/requests/${id}`, { method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "DA_PHE_DUYET" }) });
    assert.equal(blocked.response.status, 400, `${field}: ${JSON.stringify(blocked.body)}`);
    assert.equal(blocked.body.error?.code || blocked.body.code, "CO_TENANT_IDENTITY_INCOMPLETE");
    assert.equal((await YeuCau.findByPk(id)).trang_thai, "CHO_XU_LY");
    await proposal.update({ [field]: original });
  }
  const approved = await request(`/api/v1/requests/${id}`, { method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "DA_PHE_DUYET" }) });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
});
