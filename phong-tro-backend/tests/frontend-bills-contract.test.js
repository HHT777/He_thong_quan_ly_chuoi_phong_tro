const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const read = (file) => fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src", file), "utf8");

test("FR-144..157/164/175/176 bill screen uses preview, manual sending and server totals", () => {
  const source = read("modules/finance/bills-v2.js");
  assert.match(source, /post\("\/v1\/bills\/preview", \{ period, buildingIds:/);
  assert.match(source, /post\("\/v1\/bills\/generate", \{ period, contractIds:/);
  assert.match(source, /post\("\/v1\/bills\/send-preview", \{ billIds:/);
  assert.match(source, /post\("\/v1\/bills\/send", payload/);
  assert.match(source, /`\/v1\/bills\/summary\?\$\{query/);
  assert.match(source, /get\("\/v1\/bills\/schedule"\)/);
  assert.match(source, /put\("\/v1\/bills\/schedule"/);
  assert.match(source, /\/v1\/bills\/\$\{row\.ma_thanh_toan\}\/adjustments/);
  assert.match(source, /reason: requiredText\(raw\.reason/);
  assert.match(source, /"Idempotency-Key": keys\.keyFor\(scope, payload\)/);
  for (const scope of ["resend:", "pay:", "cancel:"]) assert.ok(source.includes(`scope = \`${scope}`));
  assert.match(source, /keys\.complete\(scope\)/);
  assert.match(source, /\/v1\/payments\/\$\{row\.ma_giao_dich\}\/cancel/);
  assert.match(source, /row\.nguon_thanh_toan !== "KHAU_TRU_COC"/);
  assert.match(source, /\/v1\/billing-adjustments/);
  assert.match(source, /escapeHtml/);
  assert.match(source, /button\.disabled = true/);
});

test("bill drafts stay visible and schedule scope is explicit", () => {
  const source = read("modules/finance/bills-v2.js");
  assert.match(source, /summaryResult\.value\?\.data/);
  assert.match(source, /if \(result\.created\?\.length\) \{ root\.querySelector\('\[name="period"\]'\)\.value = period; root\.querySelector\('\[name="issuance"\]'\)\.value = "DRAFT"/);
  assert.match(source, /row\.preview\.lines\.map/);
  assert.match(source, /name="scope" value="all"/);
  assert.match(source, /name="scope" value="selected"/);
  assert.match(source, /buildingIds: form\.elements\.namedItem\("scope"\)\.value === "all" \? \[\]/);
});

test("a failed summary request does not hide the bill list", async () => {
  const url = pathToFileURL(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/finance/billRequests.js")).href;
  const { fetchBillPage } = await import(url);
  const bill = { ma_thanh_toan: "bill-1", da_gui: false };
  const api = { get: async (endpoint) => {
    if (endpoint.includes("summary")) throw new Error("Lỗi máy chủ nội bộ");
    return { data: [bill], pagination: { total: 1 } };
  } };
  const result = await fetchBillPage(api, "/khoan-phai-thu?ky=2026-10", "/v1/bills/summary?ky=2026-10");
  assert.deepEqual(result.billResponse.data, [bill]);
  assert.match(result.summaryResult.error.message, /Lỗi máy chủ nội bộ/);
});

test("F.5 shared API client exposes status and server error code", () => {
  const source = read("core/api.js");
  assert.match(source, /error\.status = response\.status/);
  assert.match(source, /error\.code = code/);
  assert.match(source, /ADJUSTMENT_EXCEEDS_OUTSTANDING/);
});
