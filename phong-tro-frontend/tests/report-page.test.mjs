import test from "node:test";
import assert from "node:assert/strict";
import { estimatedRows, filterTransactions, periodLabel, readCashflow, reportDate, reportMoney, reportQuery, revenueLabel } from "../src/modules/finance/report.model.mjs";
import { buildingCompareMarkup, detailMarkup, kpiMarkup, revenueMixMarkup } from "../src/modules/finance/report.view.mjs";

const names = new Map([["a", "Căn Hoa Sen"], ["b", "Căn Bình Minh"]]);
const data = {
  totalRevenue: 3_000_000, grossRevenue: 3_100_000, discounts: 100_000, depositDeductions: 200_000,
  totalExpenses: 1_300_000, profit: 1_700_000,
  revenueByType: [{ type: "TIEN_DIEN", amount: 700_000 }, { type: "TIEN_PHONG", amount: 2_300_000 }],
  byBuilding: [
    { buildingId: "a", inComparison: true, revenue: 2_500_000, expenses: 700_000, profit: 1_800_000 },
    { buildingId: "b", inComparison: false, revenue: 500_000, expenses: 0, profit: 500_000 },
    { buildingId: null, inComparison: false, revenue: 0, expenses: 600_000, profit: -600_000 },
  ],
  receiptDetails: [
    { source: "THU_TIEN", buildingId: "a", date: "2026-10-09", amount: 2_500_000, grossAmount: 2_600_000, discountAllocated: 100_000, snapshotSource: "SUY_DIEN" },
    { source: "CHI_PHI", buildingId: null, date: "2026-10-08", amount: 600_000 },
  ],
};

test("kỳ và tiền Việt Nam được định dạng theo dữ liệu API", () => {
  assert.equal(reportDate("2026-10-09T00:00:00.000Z"), "09/10/2026");
  assert.equal(reportMoney(-600_000), "−600.000 đ");
  assert.equal(revenueLabel("TIEN_PHONG"), "Tiền phòng");
  assert.equal(periodLabel({ mode: "quarter", quarter: "4", quarterYear: "2026" }), "Quý 4/2026");
  assert.equal(reportQuery({ mode: "month", month: "2026-10", buildingId: "a" }).toString(), "buildingId=a&periodType=month&periodValue=2026-10");
  assert.equal(reportQuery({ mode: "quarter", quarterYear: "2026", quarter: "4", buildingId: "a" }).toString(), "buildingId=a&periodType=quarter&periodValue=2026-4");
  assert.equal(reportQuery({ mode: "year", year: "2025" }).toString(), "periodType=year&periodValue=2025");
  assert.equal(reportQuery({ mode: "range", from: "2026-10-01", to: "2026-10-31" }).toString(), "from=2026-10-01&to=2026-10-31");
  assert.throws(() => reportQuery({ mode: "range", from: "2026-11-01", to: "2026-10-31" }));
  assert.equal(reportMoney(null), "—");
  assert.equal(readCashflow({ data }), data);
  assert.throws(() => readCashflow({ data: { ...data, totalRevenue: undefined } }), /không hợp lệ/);
});

test("chi phí chưa phân căn là thanh riêng đã tính trong tổng backend", () => {
  const markup = buildingCompareMarkup(data, names);
  assert.match(markup, /Chưa phân căn/);
  assert.match(markup, /Chi phí chưa phân căn: 600\.000 đ \(đã tính vào tổng chi phí\)/);
  assert.match(markup, /Đã tính trong tổng chi phí/);
  assert.match(kpiMarkup(data), /1\.300\.000 đ/);
  assert.doesNotMatch(buildingCompareMarkup({ ...data, byBuilding: data.byBuilding.slice(0, 2) }, names), /report-info/);
});

test("doanh thu theo loại dùng nhãn và sắp giảm dần", () => {
  const markup = revenueMixMarkup(data);
  assert.ok(markup.indexOf("Tiền phòng") < markup.indexOf("Tiền điện"));
  assert.match(markup, /76,7%/);
});

test("giao dịch ước tính và bộ lọc client chỉ dựa vào hàng API", () => {
  assert.equal(estimatedRows(data.receiptDetails).length, 1);
  assert.equal(filterTransactions(data.receiptDetails, { buildingId: "a", estimatedOnly: true }, names).length, 1);
  assert.equal(filterTransactions(data.receiptDetails, { query: "Hoa Sen" }, names).length, 1);
  const markup = detailMarkup(data, names, { tableMode: "transactions", buildingId: "", search: "", estimatedOnly: false });
  assert.match(markup, /09\/10\/2026/);
  assert.match(markup, /−600\.000 đ/);
  assert.match(markup, /1 dòng ước tính/);
  assert.doesNotMatch(markup, /<th[^>]*>Phòng<\/th>/);
});

test("panel rỗng có hướng dẫn, không hiện số mẫu", () => {
  assert.match(revenueMixMarkup({ revenueByType: [] }), /Chưa có doanh thu theo loại/);
  assert.match(buildingCompareMarkup({ byBuilding: [] }, names), /Chưa có căn phát sinh/);
  assert.match(detailMarkup({ ...data, receiptDetails: [] }, names, { tableMode: "transactions", buildingId: "", search: "", estimatedOnly: false }), /Không có giao dịch thu\/chi/);
});
