const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src", file), "utf8");
const tab = read("modules/finance/reports.tab.js");
const model = read("modules/finance/report.model.mjs");
const view = read("modules/finance/report.view.mjs");

test("FR-132..143 report filters apply month, quarter, year, range and building on change or submit", () => {
  for (const field of ["periodType", "periodValue", "from", "to", "buildingId"]) {
    assert.match(model, new RegExp(`query\\.set\\("${field}"`));
  }
  assert.match(model, /fields\.from > fields\.to/);
  assert.match(tab, /form\.addEventListener\("submit"/);
  assert.match(tab, /form\.addEventListener\("change"/);
  assert.match(tab, /form\.elements\.mode\.value = mode\.dataset\.reportMode;[\s\S]*?syncFields\(\);[\s\S]*?applyCurrent\(\)/);
  assert.match(tab, /load\(fields\)/);
  assert.match(tab, /version !== loadVersion/);
  assert.ok(tab.includes('context.api.get(`/v1/reports/cashflow?${query}`)'));
  assert.match(tab, /error\.status === 400/);
});

test("FR-133 report cards and table use server totals and snapshot fields", () => {
  for (const field of ["totalRevenue", "grossRevenue", "discounts", "depositDeductions", "totalExpenses", "profit"]) {
    assert.match(view, new RegExp(`data\\.${field}`));
  }
  for (const field of ["grossAmount", "discountAllocated", "snapshotSource"]) assert.match(view + model, new RegExp(field));
  assert.match(tab, /readCashflow\(cashflow\)/);
  assert.match(model, /moneyFields\.some/);
  assert.doesNotMatch(tab + view, /data\.totalCollected|\bavgRevenuePerRoom\b/);
});

test("FR-136/137 comparison excludes inactive buildings and detail retains them", () => {
  assert.match(view, /row\.inComparison === true/);
  assert.match(view, /row\.inComparison === false/);
  assert.match(view, /căn ngừng hoạt động có phát sinh/);
  assert.match(view, /data-building=/);
  assert.match(view, /data-type=/);
  assert.match(tab, /state\.view = "table"; state\.tableMode = "transactions"/);
  assert.match(model, /snapshotSource === "SUY_DIEN"/);
});

test("FR-133 dashboard continues to read the server insights contract", () => {
  const source = read("modules/overview/dashboard.view.mjs");
  const insights = read("modules/overview/dashboard.insights.mjs");
  assert.ok(source.includes('readInsights(await context.api.get(`/v1/dashboard/insights?period=${period}`))'));
  assert.match(source, /insights\.cashflow6m\[5\]\.totalRevenue/);
  assert.match(insights, /Number\.isSafeInteger\(value\)/);
});

test("F.5 report month uses the Ho Chi Minh business timezone", () => {
  assert.match(tab, /timeZone: "Asia\/Ho_Chi_Minh"/);
});

test("FR-194 report export uses the exact applied filter and bearer-token blob API", () => {
  const api = read("core/api.js");
  assert.match(tab, /state\.appliedQuery = query/);
  assert.ok(tab.includes('context.api.getBlob(`/v1/reports/cashflow.xlsx?${state.appliedQuery}`)'));
  assert.match(tab, /URL\.createObjectURL\(blob\)/);
  assert.match(tab, /URL\.revokeObjectURL\(url\)/);
  assert.match(api, /async function getBlob/);
  assert.ok(api.includes('headers.Authorization = `Bearer ${token()}`'));
});

test("FR-194 sole-landlord unassigned expenses are shown as included in server total", () => {
  assert.match(view, /!row\.buildingId && Number\(row\.expenses\) > 0/);
  assert.match(view, /Chi phí chưa phân căn: .*đã tính vào tổng chi phí/);
  assert.match(view, /report-building-row--unassigned/);
  assert.match(view, /data\.totalExpenses/);
  assert.doesNotMatch(view, /data\.unassignedExpenses/);
});
