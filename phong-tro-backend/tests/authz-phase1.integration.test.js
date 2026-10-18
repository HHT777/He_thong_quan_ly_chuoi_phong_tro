const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const { TaiKhoan, ChuTro, TienCoc, ThanhToan, GiaoDichThanhToan, KhoanDieuChinh, PhongTro,
  HopDong, KhoanThu, AuditLog, ThongBao, BienBanTraPhong, GiaoDichHoanCoc, ChiTietThanhToan } = require("../src/models");
const { integration, request, headers, login, createFreshRental, createBaseRental } = require("./helpers/integration-api");

async function setupTwoLandlords() {
  const landlordA = await login(integration.landlord);

  const rogueAccount = await TaiKhoan.create({
    ten_dang_nhap: `landb${Date.now()}`.slice(0, 15),
    mat_khau: await bcrypt.hash("LandlordB123!", 10),
    vai_tro: "CHU_TRO",
    trang_thai: "HOAT_DONG",
    bat_buoc_doi_mat_khau: false,
  });
  const rogueLandlord = await ChuTro.create({
    ma_tai_khoan: rogueAccount.ma_tai_khoan,
    ho_ten: "Chủ trọ B",
    so_dien_thoai: "0987654399",
  });
  const landlordB = jwt.sign(
    { ma_tai_khoan: rogueAccount.ma_tai_khoan, ten_dang_nhap: rogueAccount.ten_dang_nhap, vai_tro: "CHU_TRO" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  const rentalA = await createFreshRental(landlordA, "authz-owner-a");
  const rentalB = await createFreshRental(landlordB, "authz-owner-b");
  // Room codes may repeat across different buildings; IDs must still determine ownership.
  assert.notEqual(rentalA.room.ma_phong, rentalB.room.ma_phong);
  await PhongTro.update({ so_phong: rentalA.room.so_phong }, { where: { ma_phong: rentalB.room.ma_phong } });

  return { landlordA, landlordB, rentalA, rentalB };
}

test("PHASE 1 AUTHZ: Landlord A cannot read or modify Landlord B finance/contract resources", async () => {
  const { landlordA, landlordB, rentalA, rentalB } = await setupTwoLandlords();

  // Create Bill & Payment & Recurring Adjustment for Landlord B
  const billBRes = await request("/api/khoan-phai-thu", {
    method: "POST", headers: headers(landlordB),
    body: JSON.stringify({
      ma_hop_dong: rentalB.contract.ma_hop_dong,
      ky: "2026-11",
      tien_phong: 2000000,
      tong_phai_thanh_toan: 2000000,
    }),
  });
  assert.equal(billBRes.response.status, 201, JSON.stringify(billBRes.body));
  const billB = billBRes.body.data;

  const payBRes = await request("/api/khoan-phai-thu/payment/create", {
    method: "POST", headers: headers(landlordB, { "Idempotency-Key": `pay-b-${Date.now()}` }),
    body: JSON.stringify({
      ma_khoan_phai_thu: billB.ma_thanh_toan,
      ngay_thanh_toan: "2026-11-02",
      so_tien: 500000,
      phuong_thuc: "TIEN_MAT",
    }),
  });
  assert.equal(payBRes.response.status, 201, JSON.stringify(payBRes.body));
  const payB = payBRes.body.data;

  const depositB = await TienCoc.findOne({ where: { ma_hop_dong: rentalB.contract.ma_hop_dong } });

  const adjBRes = await request("/api/v1/billing-adjustments", {
    method: "POST", headers: headers(landlordB),
    body: JSON.stringify({
      contractId: rentalB.contract.ma_hop_dong,
      type: "PHI_PHAT_SINH",
      name: "Phí phụ B",
      amount: 50000,
      mode: "CO_DINH",
      startDate: "2026-11-01",
    }),
  });
  assert.equal(adjBRes.response.status, 201, JSON.stringify(adjBRes.body));
  const adjB = adjBRes.body.data;

  const dummyId = crypto.randomUUID();

  // Test cases: [Label, Method, Path, Body, NonExistentPath, NonExistentBody]
  const routes = [
    // 1. Contract
    {
      name: "POST /api/hop-dong (create contract using room B)",
      method: "POST", path: "/api/hop-dong",
      body: { ma_khach_thue: rentalA.tenant.ma_khach_thue, ma_phong: rentalB.room.ma_phong, ngay_bat_dau: "2026-11-01", ngay_ket_thuc: "2027-10-31", gia_thue: 2000000, tien_coc: 2000000, don_gia_dien: 3500, don_gia_nuoc: 100000, dieu_khoan: "Test", da_co_ban_giay_ky: true },
      fakeBody: { ma_khach_thue: rentalA.tenant.ma_khach_thue, ma_phong: dummyId, ngay_bat_dau: "2026-11-01", ngay_ket_thuc: "2027-10-31", gia_thue: 2000000, tien_coc: 2000000, don_gia_dien: 3500, don_gia_nuoc: 100000, dieu_khoan: "Test", da_co_ban_giay_ky: true },
    },
    {
      name: "GET /api/hop-dong/:id (read contract B)",
      method: "GET", path: `/api/hop-dong/${rentalB.contract.ma_hop_dong}`,
      fakePath: `/api/hop-dong/${dummyId}`,
    },
    {
      name: "PUT /api/hop-dong/:id (update contract B)",
      method: "PUT", path: `/api/hop-dong/${rentalB.contract.ma_hop_dong}`,
      body: { gia_thue: 3000000 },
      fakePath: `/api/hop-dong/${dummyId}`,
      fakeBody: { gia_thue: 3000000 },
    },
    {
      name: "POST /api/hop-dong/:id/transfers (transfer contract B)",
      method: "POST", path: `/api/hop-dong/${rentalB.contract.ma_hop_dong}/transfers`,
      body: { targetRoomId: rentalA.room.ma_phong, transferDate: "2026-11-15", note: "Lấn sân" },
      fakePath: `/api/hop-dong/${dummyId}/transfers`,
      fakeBody: { targetRoomId: rentalA.room.ma_phong, transferDate: "2026-11-15", note: "Lấn sân" },
    },
    // 2. Deposit
    {
      name: "POST /api/dat-coc (create deposit on contract B)",
      method: "POST", path: "/api/dat-coc",
      body: { ma_hop_dong: rentalB.contract.ma_hop_dong, so_tien_coc: 1000000, ngay_nhan_coc: "2026-11-01" },
      fakeBody: { ma_hop_dong: dummyId, so_tien_coc: 1000000, ngay_nhan_coc: "2026-11-01" },
    },
    {
      name: "POST /api/dat-coc/:id/confirm (confirm deposit B)",
      method: "POST", path: `/api/dat-coc/${depositB.ma_tien_coc}/confirm`,
      fakePath: `/api/dat-coc/${dummyId}/confirm`,
    },
    {
      name: "POST /api/dat-coc/:id/cancel (cancel deposit B)",
      method: "POST", path: `/api/dat-coc/${depositB.ma_tien_coc}/cancel`,
      fakePath: `/api/dat-coc/${dummyId}/cancel`,
    },
    // 3. Bills & Payments
    {
      name: "POST /api/khoan-phai-thu (create bill on contract B)",
      method: "POST", path: "/api/khoan-phai-thu",
      body: { ma_hop_dong: rentalB.contract.ma_hop_dong, ky: "2026-12", tien_phong: 1500000, tong_phai_thanh_toan: 1500000 },
      fakeBody: { ma_hop_dong: dummyId, ky: "2026-12", tien_phong: 1500000, tong_phai_thanh_toan: 1500000 },
    },
    {
      name: "POST /api/khoan-phai-thu/payment/create (create payment for bill B)",
      method: "POST", path: "/api/khoan-phai-thu/payment/create",
      body: { ma_khoan_phai_thu: billB.ma_thanh_toan, ngay_thanh_toan: "2026-11-05", so_tien: 100000, phuong_thuc: "TIEN_MAT" },
      fakeBody: { ma_khoan_phai_thu: dummyId, ngay_thanh_toan: "2026-11-05", so_tien: 100000, phuong_thuc: "TIEN_MAT" },
    },
    {
      name: "POST /api/khoan-phai-thu/payment/:id/confirm (confirm payment B)",
      method: "POST", path: `/api/khoan-phai-thu/payment/${payB.ma_giao_dich}/confirm`,
      fakePath: `/api/khoan-phai-thu/payment/${dummyId}/confirm`,
    },
    // 4. Tenant Accounts
    {
      name: "POST /api/v1/accounts (create account for tenant B)",
      method: "POST", path: "/api/v1/accounts",
      body: { tenantId: rentalB.tenant.ma_khach_thue },
      fakeBody: { tenantId: dummyId },
    },
    {
      name: "PATCH /api/v1/accounts/:id/status (lock account B)",
      method: "PATCH", path: `/api/v1/accounts/${rentalB.account.ma_tai_khoan}/status`,
      body: { status: "DA_KHOA" },
      fakePath: `/api/v1/accounts/${dummyId}/status`,
      fakeBody: { status: "DA_KHOA" },
    },
    {
      name: "POST /api/v1/accounts/reset-password (reset password account B)",
      method: "POST", path: "/api/v1/accounts/reset-password",
      body: { tenantId: rentalB.tenant.ma_khach_thue },
      fakeBody: { tenantId: dummyId },
    },
    // 5. Adjustments & Discounts
    {
      name: "POST /api/v1/discounts (discount bill B)",
      method: "POST", path: "/api/v1/discounts",
      body: { billId: billB.ma_thanh_toan, value: 50000, reason: "Giảm trộm" },
      fakeBody: { billId: dummyId, value: 50000, reason: "Giảm trộm" },
    },
    {
      name: "POST /api/v1/bills/:id/adjustments (adjust bill B)",
      method: "POST", path: `/api/v1/bills/${billB.ma_thanh_toan}/adjustments`,
      body: { delta: -50000, reason: "Sửa trộm" },
      fakePath: `/api/v1/bills/${dummyId}/adjustments`,
      fakeBody: { delta: -50000, reason: "Sửa trộm" },
    },
    {
      name: "POST /api/v1/billing-adjustments (create recurring adj for contract B)",
      method: "POST", path: "/api/v1/billing-adjustments",
      body: { contractId: rentalB.contract.ma_hop_dong, type: "PHI_PHAT_SINH", name: "Trộm", amount: 10000, mode: "CO_DINH", startDate: "2026-11-01" },
      fakeBody: { contractId: dummyId, type: "PHI_PHAT_SINH", name: "Trộm", amount: 10000, mode: "CO_DINH", startDate: "2026-11-01" },
    },
    {
      name: "PATCH /api/v1/billing-adjustments/:id (update recurring adj B)",
      method: "PATCH", path: `/api/v1/billing-adjustments/${adjB.id}`,
      body: { amount: 60000 },
      fakePath: `/api/v1/billing-adjustments/${dummyId}`,
      fakeBody: { amount: 60000 },
    },
    {
      name: "POST /api/v1/billing-adjustments/:id/toggle (toggle recurring adj B)",
      method: "POST", path: `/api/v1/billing-adjustments/${adjB.id}/toggle`,
      body: { enabled: false, reason: "Tắt trộm" },
      fakePath: `/api/v1/billing-adjustments/${dummyId}/toggle`,
      fakeBody: { enabled: false, reason: "Tắt trộm" },
    },
    // 6. Bills Preview / Generate / Mark Paid
    {
      name: "POST /api/v1/bills/preview (preview mixed contracts)",
      method: "POST", path: "/api/v1/bills/preview",
      body: { period: "2026-11", contractIds: [rentalA.contract.ma_hop_dong, rentalB.contract.ma_hop_dong] },
      fakeBody: { period: "2026-11", contractIds: [rentalA.contract.ma_hop_dong, dummyId] },
    },
    {
      name: "POST /api/v1/bills/generate (generate mixed contracts)",
      method: "POST", path: "/api/v1/bills/generate",
      body: { period: "2026-11", contractIds: [rentalA.contract.ma_hop_dong, rentalB.contract.ma_hop_dong] },
      fakeBody: { period: "2026-11", contractIds: [rentalA.contract.ma_hop_dong, dummyId] },
    },
    {
      name: "POST /api/v1/bills/:id/mark-paid (mark paid bill B)",
      method: "POST", path: `/api/v1/bills/${billB.ma_thanh_toan}/mark-paid`,
      fakePath: `/api/v1/bills/${dummyId}/mark-paid`,
    },
    {
      name: "POST /api/v1/bills/mark-all-paid (mark all paid building B)",
      method: "POST", path: "/api/v1/bills/mark-all-paid",
      body: { buildingId: rentalB.building.ma_can, period: "2026-11" },
      fakeBody: { buildingId: dummyId, period: "2026-11" },
    },
    {
      name: "POST /api/v1/payments/:id/cancel (cancel payment B)",
      method: "POST", path: `/api/v1/payments/${payB.ma_giao_dich}/cancel`,
      body: { reason: "Hủy trộm" },
      fakePath: `/api/v1/payments/${dummyId}/cancel`,
      fakeBody: { reason: "Hủy trộm" },
    },
    // 7. Move-out
    {
      name: "POST /api/v1/move-outs/:contractId/settle (settle move-out contract B)",
      method: "POST", path: `/api/v1/move-outs/${rentalB.contract.ma_hop_dong}/settle`,
      body: { moveOutDate: "2026-11-01", handoverNotes: "Test", deductions: [] },
      fakePath: `/api/v1/move-outs/${dummyId}/settle`,
      fakeBody: { moveOutDate: "2026-11-01", handoverNotes: "Test", deductions: [] },
    },
    {
      name: "POST /api/v1/move-outs/:id/deposit-refunds (deposit refund B)",
      method: "POST", path: `/api/v1/move-outs/${rentalB.contract.ma_hop_dong}/deposit-refunds`,
      body: { khoaChongTrung: `refund-${dummyId}`, soTien: 100000, ngayHoan: "2026-11-01" },
      fakePath: `/api/v1/move-outs/${dummyId}/deposit-refunds`,
      fakeBody: { khoaChongTrung: `refund-${dummyId}`, soTien: 100000, ngayHoan: "2026-11-01" },
    },
  ];

  console.log(`\n=== RUNNING TABLE-DRIVEN AUTHZ CHECKS FOR ${routes.length} ROUTES ===`);
  const snapshotModels = [TaiKhoan, PhongTro, HopDong, TienCoc, ThanhToan, GiaoDichThanhToan,
    KhoanDieuChinh, KhoanThu, AuditLog, ThongBao, BienBanTraPhong, GiaoDichHoanCoc, ChiTietThanhToan];
  async function fingerprint() {
    const rows = await Promise.all(snapshotModels.map(async (model) => {
      const data = await model.findAll({ raw: true });
      data.sort((a, b) => String(a[model.primaryKeyAttribute]).localeCompare(String(b[model.primaryKeyAttribute])));
      return [model.name, JSON.stringify(data)];
    }));
    return Object.fromEntries(rows);
  }
  const visible = (result) => ({ status: result.response.status, body: {
    code: result.body?.code || result.body?.error?.code || null,
    message: result.body?.message || result.body?.error?.message || null,
  } });
  const failures = [];
  for (const r of routes) {
    const before = await fingerprint();
    // 1. Cross-landlord call (A accessing B's resource)
    const optsB = { method: r.method, headers: headers(landlordA) };
    if (r.body) optsB.body = JSON.stringify(r.body);
    const resB = await request(r.path, optsB);
    const afterForeign = await fingerprint();

    const isDeniedB = resB.response.status === 404 && 
      (resB.body?.code === "RESOURCE_NOT_FOUND" || resB.body?.error?.code === "RESOURCE_NOT_FOUND");
    
    // 2. Non-existent resource call
    const fakePath = r.fakePath || r.path;
    const optsFake = { method: r.method, headers: headers(landlordA) };
    if (r.fakeBody) optsFake.body = JSON.stringify(r.fakeBody);
    else if (r.body) optsFake.body = JSON.stringify(r.body);
    const resFake = await request(fakePath, optsFake);
    const afterMissing = await fingerprint();

    const isDeniedFake = resFake.response.status === 404 && 
      (resFake.body?.code === "RESOURCE_NOT_FOUND" || resFake.body?.error?.code === "RESOURCE_NOT_FOUND");

    const changedForeign = Object.keys(before).filter((key) => before[key] !== afterForeign[key]);
    const changedMissing = Object.keys(afterForeign).filter((key) => afterForeign[key] !== afterMissing[key]);
    const sameResponse = JSON.stringify(visible(resB)) === JSON.stringify(visible(resFake));
    if (!isDeniedB || changedForeign.length || !sameResponse) failures.push({ route: r.name, target: "cross-landlord", actual: visible(resB), expected: visible(resFake), changedTables: changedForeign });
    if (!isDeniedFake || changedMissing.length) failures.push({ route: r.name, target: "non-existent", actual: visible(resFake), changedTables: changedMissing });
  }
  for (const item of [
    { route: `GET /api/hop-dong/${rentalB.contract.ma_hop_dong}`, missing: `GET /api/hop-dong/${dummyId}` },
    { route: `GET /api/khoan-phai-thu/${billB.ma_thanh_toan}`, missing: `GET /api/khoan-phai-thu/${dummyId}` },
  ]) {
    const [, path] = item.route.split(" ");
    const [, missingPath] = item.missing.split(" ");
    const foreign = await request(path, { headers: headers(rentalA.tenantToken) });
    const absent = await request(missingPath, { headers: headers(rentalA.tenantToken) });
    if (foreign.response.status !== 404 || JSON.stringify(visible(foreign)) !== JSON.stringify(visible(absent))) {
      failures.push({ route: item.route, target: "tenant-cross-access", actual: visible(foreign), expected: visible(absent) });
    }
  }
  const tenantWrite = await request("/api/v1/bills/generate", {
    method: "POST", headers: headers(rentalA.tenantToken),
    body: JSON.stringify({ period: "2026-11", contractIds: [rentalA.contract.ma_hop_dong] }),
  });
  if (tenantWrite.response.status !== 403) failures.push({ route: "POST /api/v1/bills/generate", target: "tenant-role", actual: visible(tenantWrite) });

  console.log(`Phase 1 Unpatched/Failing checks count: ${failures.length} (total routes: ${routes.length})`);
  if (failures.length > 0) {
    console.log(`AUTHZ_RED_ROUTES ${new Set(failures.map((item) => item.route)).size}`);
    for (const failure of failures) {
      console.log("AUTHZ_RED", JSON.stringify({ route: failure.route, target: failure.target,
        status: failure.actual.status, body: failure.actual.body, expected: failure.expected,
        changedTables: failure.changedTables }));
    }
  }
  assert.equal(failures.length, 0, `Có ${failures.length} kiểm tra vi phạm authorization theo chiều ngang!`);
});
