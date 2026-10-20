const test = require("node:test");
const assert = require("node:assert/strict");
const { writeWorkbook, safeText, MAX_ROWS } = require("../src/utils/xlsxWriter.util");
const { workbookSheets, periodToken } = require("../src/services/cashflowExport.service");
const { readXlsxEntries, readXlsxWorkbook } = require("./helpers/read-xlsx");

test("FR-194 XLSX has typed money cells and neutralized formula strings", () => {
  const dangerous = ["=SUM(1,2)", "+1+1", "-1+1", "@cmd", "\tformula", "\rformula", "\nformula"];
  const buffer = writeWorkbook([
    { name: "Tong quan", rows: [["Amount", -125000], ...dangerous.map((value) => [value, value])] },
    { name: "Thu", rows: [["Can", "So tien"], ["A", 125000]] },
    { name: "Chi", rows: [["Can", "So tien"], ["A", 25000]] },
  ]);
  assert.equal(buffer.readUInt32LE(0), 0x04034b50);
  const entries = readXlsxEntries(buffer);
  assert.equal(entries.size, 8);
  assert.match(entries.get("xl/workbook.xml"), /name="Tong quan".*name="Thu".*name="Chi"/);
  const xml = entries.get("xl/worksheets/sheet1.xml");
  assert.match(xml, /<c r="B1"><v>-125000<\/v><\/c>/, "negative numbers stay numeric");
  dangerous.forEach((value, index) => {
    assert.equal(safeText(value), `'${value}`);
    assert.ok(xml.includes(`<c r="A${index + 2}" t="inlineStr"><is><t xml:space="preserve">`));
  });
  assert.ok(!xml.includes("<f>"), "untrusted data is never a formula cell");
  assert.match(xml, /&apos;=SUM\(1,2\)/);
  const independentlyRead = readXlsxWorkbook(buffer);
  assert.equal(independentlyRead["Tong quan"][0][1], -125000);
  dangerous.forEach((value, index) => assert.equal(independentlyRead["Tong quan"][index + 1][0], `'${value}`));
});

test("FR-194 workbook uses server amounts and a validated period token", () => {
  const report = {
    totalRevenue: 120000, grossRevenue: 150000, discounts: 30000,
    depositDeductions: 20000, totalExpenses: 25000, profit: 95000, unassignedExpenses: { count: 2, total: 99000 },
    revenueByType: [{ type: "THU_TIEN", amount: 100000 }, { type: "KHAU_TRU_COC", amount: 20000 }],
    byBuilding: [{ buildingId: "A", inComparison: true, revenue: 120000, grossRevenue: 150000, discounts: 30000, depositDeductions: 20000, expenses: 25000, profit: 95000 }],
    receiptDetails: [
      { source: "THU_TIEN", buildingId: "A", roomId: "P1", amount: 100000, grossAmount: 130000, discountAllocated: 30000, snapshotSource: "GHI_NHAN", date: "2026-10-19" },
      { source: "KHAU_TRU_COC", buildingId: "A", roomId: "P1", amount: 20000, grossAmount: 20000, discountAllocated: 0, snapshotSource: null, date: "2026-10-19" },
      { source: "CHI_PHI", type: "BAO_TRI", buildingId: "A", roomId: null, amount: 25000, date: "2026-10-19" },
    ],
  };
  const sheets = workbookSheets(report, { periodType: "month", periodValue: "2026-10" });
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Tong quan", "Theo loai", "Theo can", "Thu", "Chi"]);
  assert.deepEqual(sheets[4].rows[0], ["Căn", "Phòng", "Loại", "Số tiền", "Ngày"]);
  assert.deepEqual(sheets[0].rows.slice(5).map((row) => row[1]), [120000, 150000, 30000, 20000, 25000, 95000, 2, 99000]);
  assert.deepEqual(sheets[1].rows.slice(1), [["THU_TIEN", 100000], ["KHAU_TRU_COC", 20000]]);
  assert.deepEqual(sheets[2].rows[1], ["A", true, 120000, 150000, 30000, 20000, 25000, 95000]);
  assert.deepEqual(sheets[3].rows[1], ["A", "P1", "THU_TIEN", 100000, "2026-10-19", 130000, 30000, "GHI_NHAN"]);
  assert.deepEqual(sheets[4].rows[1], ["A", "", "BAO_TRI", 25000, "2026-10-19"]);
  assert.equal(sheets[1].rows.slice(1).reduce((sum, row) => sum + row[1], 0), report.totalRevenue);
  assert.equal(sheets[2].rows.slice(1).reduce((sum, row) => sum + row[2], 0), report.totalRevenue);
  const verified = readXlsxWorkbook(writeWorkbook(sheets));
  assert.deepEqual(Object.keys(verified), sheets.map((sheet) => sheet.name));
  assert.deepEqual(verified["Thu"][1], ["A", "P1", "THU_TIEN", 100000, "2026-10-19", 130000, 30000, "GHI_NHAN"]);
  assert.equal(periodToken({ periodType: "month", periodValue: "2026-10" }), "month_2026-10");
  assert.equal(periodToken({ from: "2026-10-01", to: "2026-10-31" }), "2026-10-01_2026-10-31");
  assert.throws(() => periodToken({ periodType: "month", periodValue: "../../bad" }), { code: "REPORT_PERIOD_VALUE_INVALID" });
  assert.throws(() => writeWorkbook([{ name: "Tong quan", rows: Array.from({ length: MAX_ROWS + 1 }, () => ["x"]) }, { name: "Thu", rows: [] }, { name: "Chi", rows: [] }]), { code: "REPORT_EXPORT_TOO_LARGE" });
  assert.throws(() => writeWorkbook([{ name: "Bad/Name", rows: [["x"]] }]), /Invalid or duplicate Excel sheet name/);
});
