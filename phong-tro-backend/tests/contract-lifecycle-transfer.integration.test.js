const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HopDong, PhongTro, ChiSoDien, TienCoc, ThanhVienPhong, ChiTietThanhToan,
  LichSuChuyenPhong, LichSuSuaHopDong, AuditLog, TaiKhoan, YeuCau,
} = require("../src/models");
const hopDongService = require("../src/services/hopDong.service");
const billGenerationService = require("../src/services/billGeneration.service");
const { integration, request, headers, login, createBaseRental, createFreshRental } = require("./helpers/integration-api");

async function createTargetRoom(landlord, label) {
  const base = await createBaseRental(landlord, label);
  return base.room;
}

test("FR-042 contract creation is recorded and history respects tenant ownership", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "history");
  const own = await request(`/api/hop-dong/${fresh.contract.ma_hop_dong}/history`, { headers: { Authorization: `Bearer ${fresh.tenantToken}` } });
  assert.equal(own.response.status, 200, JSON.stringify(own.body));
  assert.ok(own.body.data.some((entry) => entry.type === "CHANGE" && JSON.stringify(entry.data.sau_json).includes("CREATED")));
  const updated = await request(`/api/hop-dong/${fresh.contract.ma_hop_dong}`, {
    method: "PUT", headers: headers(landlord), body: JSON.stringify({ phi_dich_vu: 150000, reason: "Thỏa thuận phí dịch vụ" }),
  });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.body));
  await HopDong.update({ trang_thai: "SAP_HET_HAN" }, { where: { ma_hop_dong: fresh.contract.ma_hop_dong } });
  const renewalRequest = await request("/api/v1/requests", {
    method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({ type: "GIA_HAN", content: "Gia hạn 6 tháng", requestedEndDate: "2028-03-30" }),
  });
  assert.equal(renewalRequest.response.status, 201, JSON.stringify(renewalRequest.body));
  const approved = await request(`/api/v1/requests/${renewalRequest.body.data.ma_yeu_cau}`, {
    method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "DA_DUYET" }),
  });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  const afterChanges = await request(`/api/hop-dong/${fresh.contract.ma_hop_dong}/history`, { headers: { Authorization: `Bearer ${fresh.tenantToken}` } });
  assert.ok(afterChanges.body.data.some((entry) => entry.type === "CHANGE" && JSON.stringify(entry.data.sau_json).includes("UPDATED")));
  assert.ok(afterChanges.body.data.some((entry) => entry.type === "RENEWAL" && Number(entry.data.so_thang) === 6));
  const other = await login(integration.otherTenant);
  const forbidden = await request(`/api/hop-dong/${fresh.contract.ma_hop_dong}/history`, { headers: { Authorization: `Bearer ${other}` } });
  assert.equal(forbidden.response.status, 403);
});

test("FR-108 rejects renewal approval unless the contract is SAP_HET_HAN", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "renewal-status");
  const renewalRequest = await request("/api/v1/requests", {
    method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({
      type: "GIA_HAN", content: "Gia hạn 6 tháng", requestedEndDate: "2028-03-30",
    }),
  });
  assert.equal(renewalRequest.response.status, 201, JSON.stringify(renewalRequest.body));
  const approved = await request(`/api/v1/requests/${renewalRequest.body.data.ma_yeu_cau}`, {
    method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "DA_DUYET", requestedEndDate: "2035-01-01" }),
  });
  assert.equal(approved.response.status, 409, JSON.stringify(approved.body));
  assert.equal(approved.body.error?.code, "CONTRACT_NOT_EXPIRING");
  const [contract, pending] = await Promise.all([
    HopDong.findByPk(fresh.contract.ma_hop_dong),
    YeuCau.findByPk(renewalRequest.body.data.ma_yeu_cau),
  ]);
  assert.equal(contract.ngay_ket_thuc, "2027-09-30");
  assert.equal(pending.trang_thai, "CHO_XU_LY");
});

test("FR-183 creates the initial meter reading atomically with the contract", async () => {
  const landlordToken = await login(integration.landlord);
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const base = await createBaseRental(landlordToken, "initial-meter");
  const contract = await hopDongService.createHopDong({
    ma_khach_thue: base.tenant.ma_khach_thue, ma_phong: base.room.ma_phong,
    ngay_bat_dau: "2026-10-15", ngay_ket_thuc: "2027-10-14", gia_thue: 2500000,
    tien_coc: 2500000, ngay_nhan_coc: "2026-10-15", don_gia_dien: 3500,
    don_gia_nuoc: 100000, dieu_khoan: "FR-183", da_co_ban_giay_ky: true,
    chi_so_dien_ban_dau: 321,
  }, actor.ma_tai_khoan);
  const reading = await ChiSoDien.findOne({ where: { ma_phong: base.room.ma_phong, loai_chi_so: "DAU_HOP_DONG" } });
  assert.equal(reading.khoa_nghiep_vu, contract.ma_hop_dong);
  assert.equal(Number(reading.chi_so_moi), 321);
  await ThanhVienPhong.create({
    ho_ten: base.tenant.ho_ten,
    so_dien_thoai: base.tenant.so_dien_thoai,
    ngay_vao: "2026-10-15",
    trang_thai_cu_tru: "DANG_O",
    ma_phong: base.room.ma_phong,
    ma_hop_dong: contract.ma_hop_dong,
  });
  await ChiSoDien.create({
    ma_phong: base.room.ma_phong, nam: 2026, thang: 10,
    loai_chi_so: "DINH_KY", khoa_nghiep_vu: "DINH_KY:2026-10",
    chi_so_moi: 351, don_gia_ap_dung: 3500, trang_thai_xac_nhan: "DA_XAC_NHAN",
    ngay_ghi_nhan: new Date("2026-10-31T12:00:00Z"), nguoi_ghi_nhan_id: actor.ma_tai_khoan,
    nguoi_xac_nhan_id: actor.ma_tai_khoan, ngay_xac_nhan: new Date(), da_xoa: false,
  });
  const generated = await billGenerationService.generate("2026-10", actor.ma_tai_khoan);
  const firstBill = generated.created.find((row) => row.ma_hop_dong === contract.ma_hop_dong);
  assert.ok(firstBill, JSON.stringify(generated.skipped));
  const electricityLine = await ChiTietThanhToan.findOne({ where: { ma_thanh_toan: firstBill.ma_thanh_toan, loai_khoan: "TIEN_DIEN" } });
  assert.equal(Number(electricityLine.so_tien), 30 * 3500);

  const rollbackBase = await createBaseRental(landlordToken, "initial-meter-rollback");
  await assert.rejects(() => hopDongService.createHopDong({
    ma_khach_thue: rollbackBase.tenant.ma_khach_thue, ma_phong: rollbackBase.room.ma_phong,
    ngay_bat_dau: "2026-10-15", ngay_ket_thuc: "2027-10-14", gia_thue: 2500000,
    tien_coc: 2500000, don_gia_dien: 3500, don_gia_nuoc: 100000,
    dieu_khoan: "rollback", da_co_ban_giay_ky: true, chi_so_dien_ban_dau: 10,
  }, "00000000-0000-0000-0000-000000000000"));
  assert.equal(await HopDong.count({ where: { ma_phong: rollbackBase.room.ma_phong } }), 0);
  assert.equal(await TienCoc.count({ include: [{ model: HopDong, as: "hopDong", where: { ma_phong: rollbackBase.room.ma_phong } }] }), 0);
  assert.equal((await PhongTro.findByPk(rollbackBase.room.ma_phong)).trang_thai, "TRONG");
});

test("FR-195 transfers a contract and all dependent state atomically", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "transfer");
  const target = await createTargetRoom(landlord, "transfer-target");
  const response = await request(`/api/hop-dong/${fresh.contract.ma_hop_dong}/transfers`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify({
      targetRoomId: target.ma_phong, transferDate: "2026-11-15", newRent: 2700000,
      finalElectricityReading: 145, initialElectricityReading: 12, reason: "Hai bên thống nhất chuyển phòng",
    }),
  });
  assert.equal(response.response.status, 201, JSON.stringify(response.body));
  const [contract, source, destination, history, readings, audit] = await Promise.all([
    HopDong.findByPk(fresh.contract.ma_hop_dong), PhongTro.findByPk(fresh.room.ma_phong), PhongTro.findByPk(target.ma_phong),
    LichSuChuyenPhong.findOne({ where: { ma_hop_dong: fresh.contract.ma_hop_dong } }),
    ChiSoDien.findAll({ where: { nam: 2026, thang: 11, ma_phong: [fresh.room.ma_phong, target.ma_phong] } }),
    AuditLog.findOne({ where: { action: "ROOM_TRANSFERRED", entity_type: "LichSuChuyenPhong" } }),
  ]);
  assert.equal(contract.ma_phong, target.ma_phong);
  assert.equal(source.trang_thai, "TRONG");
  assert.equal(destination.trang_thai, "DANG_THUE");
  assert.ok(history);
  assert.equal(readings.length, 2);
  assert.ok(readings.every((row) => row.trang_thai_xac_nhan === "DA_XAC_NHAN"));
  assert.ok(audit);
  const forbidden = await request(`/api/hop-dong/${fresh.contract.ma_hop_dong}/transfers`, { method: "POST", headers: headers(fresh.tenantToken), body: "{}" });
  assert.equal(forbidden.response.status, 403);
});

test("FR-195 rolls back the old-room meter close when the target meter conflicts", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "transfer-rollback", { createAccount: false });
  const target = await createTargetRoom(landlord, "transfer-conflict");
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  await ChiSoDien.create({
    nam: 2026, thang: 12, loai_chi_so: "CHUYEN_PHONG", khoa_nghiep_vu: `${fresh.contract.ma_hop_dong}:2026-12-15:MOI`, chi_so_moi: 99, don_gia_ap_dung: 3500, trang_thai_xac_nhan: "DA_XAC_NHAN",
    nguoi_ghi_nhan_id: actor.ma_tai_khoan, nguoi_xac_nhan_id: actor.ma_tai_khoan, ngay_xac_nhan: new Date(), ma_phong: target.ma_phong,
  });
  const response = await request(`/api/hop-dong/${fresh.contract.ma_hop_dong}/transfers`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify({
      targetRoomId: target.ma_phong, transferDate: "2026-12-15", newRent: 2600000,
      finalElectricityReading: 200, initialElectricityReading: 10, reason: "Kiểm tra rollback",
    }),
  });
  assert.equal(response.response.status, 409, JSON.stringify(response.body));
  const [contract, oldReading, history, lifecycle] = await Promise.all([
    HopDong.findByPk(fresh.contract.ma_hop_dong),
    ChiSoDien.findOne({ where: { ma_phong: fresh.room.ma_phong, nam: 2026, thang: 12 } }),
    LichSuChuyenPhong.findOne({ where: { ma_hop_dong: fresh.contract.ma_hop_dong } }),
    LichSuSuaHopDong.findOne({ where: { ma_hop_dong: fresh.contract.ma_hop_dong, ly_do: "Kiểm tra rollback" } }),
  ]);
  assert.equal(contract.ma_phong, fresh.room.ma_phong);
  assert.equal(oldReading, null);
  assert.equal(history, null);
  assert.equal(lifecycle, null);
});
