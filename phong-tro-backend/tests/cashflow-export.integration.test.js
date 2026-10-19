const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { TaiKhoan, ChuTro, KhoanThu, KhoanChi } = require("../src/models");
const { integration, request, headers, login, createBaseRental } = require("./helpers/integration-api");
const { readXlsxWorkbook } = require("./helpers/read-xlsx");

test("FR-194 cashflow and XLSX contain only owned buildings and identical server amounts", async () => {
  const ownerA = await login(integration.landlord);
  const tenant = await login(integration.tenant);
  const accountB = await TaiKhoan.create({
    ten_dang_nhap: `export${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("g3-test-owner-only", 10),
    vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false,
  });
  await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "Owner B", so_dien_thoai: "0987654312" });
  const ownerB = jwt.sign({ ma_tai_khoan: accountB.ma_tai_khoan, ten_dang_nhap: accountB.ten_dang_nhap, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  try {
    const a = await createBaseRental(ownerA, "export-a");
    const b = await createBaseRental(ownerB, "export-b");
    const date = "2026-10-19";
    await KhoanThu.bulkCreate([
      { ma_can: a.building.ma_can, loai_khoan_thu: "KHAC", so_tien: 123456, doanh_thu_gop: 123456, giam_tru_phan_bo: 0, nguon_snapshot: "GHI_NHAN", ngay_ghi_nhan: date, trang_thai_ghi_nhan: "HIEU_LUC" },
      { ma_can: b.building.ma_can, loai_khoan_thu: "KHAC", so_tien: 999999, doanh_thu_gop: 999999, giam_tru_phan_bo: 0, nguon_snapshot: "GHI_NHAN", ngay_ghi_nhan: date, trang_thai_ghi_nhan: "HIEU_LUC" },
    ]);
    await KhoanChi.bulkCreate([
      { ma_can: a.building.ma_can, loai_khoan_chi: "KHAC", so_tien: 23456, ngay_phat_sinh: date, pham_vi: "CAN_TRO", trang_thai: "HIEU_LUC" },
      { ma_can: b.building.ma_can, loai_khoan_chi: "KHAC", so_tien: 888888, ngay_phat_sinh: date, pham_vi: "CAN_TRO", trang_thai: "HIEU_LUC" },
    ]);
    const query = "periodType=month&periodValue=2026-10";
    const jsonA = await request(`/api/v1/reports/cashflow?${query}`, { headers: headers(ownerA) });
    const jsonB = await request(`/api/v1/reports/cashflow?${query}`, { headers: headers(ownerB) });
    assert.equal(jsonA.response.status, 200, JSON.stringify(jsonA.body));
    assert.equal(jsonB.response.status, 200, JSON.stringify(jsonB.body));
    assert.ok(jsonA.body.data.receiptDetails.some((row) => row.buildingId === a.building.ma_can));
    assert.ok(jsonB.body.data.receiptDetails.some((row) => row.buildingId === b.building.ma_can));
    assert.ok(jsonA.body.data.receiptDetails.every((row) => row.buildingId !== b.building.ma_can));
    assert.ok(jsonB.body.data.receiptDetails.every((row) => row.buildingId !== a.building.ma_can));
    assert.ok(jsonA.body.data.totalRevenue >= 123456);
    assert.ok(jsonB.body.data.totalRevenue >= 999999);
    const foreignA = await request(`/api/v1/reports/cashflow?${query}&buildingId=${b.building.ma_can}`, { headers: headers(ownerA) });
    const missingA = await request(`/api/v1/reports/cashflow?${query}&buildingId=00000000-0000-4000-8000-000000000001`, { headers: headers(ownerA) });
    assert.equal(foreignA.response.status, 404);
    assert.equal(missingA.response.status, 404);
    assert.equal(foreignA.body.error.code, "RESOURCE_NOT_FOUND");
    assert.equal(missingA.body.error.code, foreignA.body.error.code);
    const endpoint = `/api/v1/reports/cashflow.xlsx?${query}`;
    const excelA = await fetch(`${integration.baseUrl}${endpoint}`, { headers: headers(ownerA) });
    assert.equal(excelA.status, 200);
    assert.equal(excelA.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.equal(excelA.headers.get("content-disposition"), 'attachment; filename="bao-cao-thu-chi_month_2026-10.xlsx"');
    assert.equal(excelA.headers.get("cache-control"), "private, no-store");
    const workbook = readXlsxWorkbook(Buffer.from(await excelA.arrayBuffer()));
    const report = jsonA.body.data;
    const sortedRows = (rows) => rows.map((row) => JSON.stringify(row)).sort();
    assert.deepEqual(Object.keys(workbook), ["Tong quan", "Theo loai", "Theo can", "Thu", "Chi"]);
    assert.deepEqual(workbook["Tong quan"].slice(5).map((row) => row[1]), [
      report.totalRevenue, report.grossRevenue, report.discounts, report.depositDeductions,
      report.totalExpenses, report.profit, report.unassignedExpenses.count, report.unassignedExpenses.total,
    ]);
    assert.deepEqual(sortedRows(workbook["Theo loai"].slice(1)), sortedRows(report.revenueByType.map((row) => [row.type, row.amount])));
    assert.deepEqual(sortedRows(workbook["Theo can"].slice(1)), sortedRows(report.byBuilding.map((row) => [
      row.buildingId || "", String(row.inComparison), row.revenue, row.grossRevenue,
      row.discounts, row.depositDeductions, row.expenses, row.profit,
    ])));
    assert.deepEqual(sortedRows(workbook.Thu.slice(1)), sortedRows(report.receiptDetails.filter((row) => row.source !== "CHI_PHI").map((row) => [
      row.buildingId || "", row.roomId || "", row.source, row.amount, row.date || "",
      row.grossAmount, row.discountAllocated, row.snapshotSource || "",
    ])));
    assert.deepEqual(sortedRows(workbook.Chi.slice(1)), sortedRows(report.receiptDetails.filter((row) => row.source === "CHI_PHI").map((row) => [
      row.buildingId || "", row.roomId || "", row.type || row.source, row.amount, row.date || "",
    ])));
    assert.equal(workbook["Theo loai"].slice(1).reduce((sum, row) => sum + row[1], 0), report.totalRevenue);
    assert.equal(workbook["Theo can"].slice(1).reduce((sum, row) => sum + row[2], 0), report.totalRevenue);
    assert.ok(workbook.Thu.some((row) => row[0] === a.building.ma_can));
    assert.ok(workbook.Chi.some((row) => row[0] === a.building.ma_can));
    assert.ok(!workbook.Thu.some((row) => row[0] === b.building.ma_can));
    assert.ok(!workbook.Chi.some((row) => row[0] === b.building.ma_can));
    const forbidden = await fetch(`${integration.baseUrl}${endpoint}`, { headers: headers(tenant) });
    assert.equal(forbidden.status, 403);
    const foreignExport = await fetch(`${integration.baseUrl}${endpoint}&buildingId=${b.building.ma_can}`, { headers: headers(ownerA) });
    assert.equal(foreignExport.status, 404);
    assert.equal((await foreignExport.json()).error.code, "RESOURCE_NOT_FOUND");
    const invalid = await fetch(`${integration.baseUrl}/api/v1/reports/cashflow.xlsx?periodType=month&periodValue=2026-13`, { headers: headers(ownerA) });
    assert.equal(invalid.status, 400);
  } finally {
    await accountB.update({ trang_thai: "DA_KHOA" });
  }
});
