const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src", file), "utf8");

test("FR-132..143 report screen sends month, quarter, year, range and building filters", () => {
  const source = read("modules/finance/reports.tab.js");
  for (const field of ["periodType", "periodValue", "from", "to", "buildingId"]) assert.match(source, new RegExp(`query\\.set\\(\"${field}\"`));
  assert.match(source, /\/v1\/reports\/cashflow\?\$\{query\.toString\(\)\}/);
  assert.match(source, /error\.status === 400/);
  assert.match(source, /Bộ lọc không hợp lệ/);
  assert.match(source, /raw\.from > raw\.to/);
  assert.match(source, /Loại kỳ báo cáo không hợp lệ/);
});

test("FR-133..143 report screen consumes server totals without deriving money totals", () => {
  const source = read("modules/finance/reports.tab.js");
  for (const field of ["totalRevenue", "totalCollected", "grossRevenue", "discounts", "depositDeductions", "totalExpenses", "profit"]) assert.match(source, new RegExp(`data\\.${field}`));
  assert.doesNotMatch(source, /\.reduce\(/);
  assert.match(source, /Doanh thu thực nhận = đã trừ giảm trừ/);
  assert.match(source, /Các tổng tiền dưới đây do server trả về/);
});

test("FR-136/137 report screen separates inactive buildings and shows snapshot detail", () => {
  const source = read("modules/finance/reports.tab.js");
  assert.match(source, /row\.inComparison === true/);
  assert.match(source, /row\.inComparison === false/);
  assert.match(source, /Ngừng hoạt động, không tham gia so sánh/);
  assert.match(source, /THU_TIEN/);
  assert.match(source, /KHAU_TRU_COC/);
  assert.match(source, /grossAmount/);
  assert.match(source, /discountAllocated/);
  assert.match(source, /snapshotSource === "SUY_DIEN"/);
  assert.match(source, /Ước tính \(dữ liệu cũ\)/);
});

test("FR-133 dashboard reads server report fields and does not synthesize money totals", () => {
  const source = read("modules/overview/dashboard.tab.js");
  for (const field of ["totalRevenue", "grossRevenue", "discounts", "depositDeductions", "totalExpenses", "profit"]) assert.match(source, new RegExp(`cashflow\\.${field}`));
  assert.doesNotMatch(source, /due \*|avgRevenuePerRoom|billRows\.reduce/);
  assert.doesNotMatch(source, /\+12\.5%|Tháng hiện tại/);
});

test("F.5 dates use the Ho Chi Minh timezone", () => {
  assert.match(read("shared/components/view.js"), /timeZone: "Asia\/Ho_Chi_Minh"/);
});
