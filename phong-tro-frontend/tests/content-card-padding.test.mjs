import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { overviewMarkup } from "../src/modules/tenant/rental-contract.model.mjs";
import { moveOutCardsMarkup } from "../src/modules/residents-contracts/request-cards.mjs";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const css = read("shared/components/content-card.css");
test("opt-in content cards use existing spacing tokens without changing base panels or other screens", () => {
  assert.match(css, /\.panel--padded\s*\{[^}]*padding: var\(--space-6\)/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.panel--padded\s*\{\s*padding: var\(--space-4\)/);
  assert.match(css, /\.panel--padded \.table-wrap\s*\{[^}]*min-width: 0;[^}]*max-width: 100%;[^}]*overflow-x: auto/);
  assert.match(css, /\.content-card-stack\s*\{[^}]*gap: var\(--space-5\);[^}]*min-width: 0/);
  assert.match(css, /\.panel--padded \.mgmt-toolbar label, \.panel--padded \.mgmt-toolbar \.btn \{ width: 100%; \}/);
  assert.doesNotMatch(css, /!important|(?:^|\})\s*\.panel\s*\{|(?:^|\})\s*(?:h2|table|button)\s*\{/);
  for (const screen of ["operations/meter-readings.tab.js", "finance/bills.tab.js", "tenant/tenant-meter.tab.js", "tenant/tenant-requests.tab.js", "tenant/tenant-co-tenants.tab.js", "notifications/inbox.tab.js"]) {
    const source = read(`modules/${screen}`);
    assert.doesNotMatch(source, /panel--padded|content-card\.css/);
  }
});

test("current and historical rental cards and empty sections have padding, spacing and escaped content", () => {
  const rows = ["DANG_HIEU_LUC", "HET_HAN"].map((trang_thai, i) => ({ ma_hop_dong: `test-${i}`, trang_thai, phongTro: { so_phong: "<script>bad</script>", canTro: { ten_can: "TEST" } } }));
  const html = overviewMarkup(rows);
  assert.equal((html.match(/class="panel panel--padded" data-contract-card/g) || []).length, 2);
  assert.match(html, /class="content-card-stack" aria-label="Hợp đồng hiện hành"/);
  assert.match(html, /class="content-card-stack" aria-label="Hợp đồng trước đây"/);
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  assert.match(overviewMarkup(rows.slice(0, 1)), /class="panel panel--padded">Chưa có hợp đồng trước đây/);
  assert.match(overviewMarkup([]), /empty-state/);
});

test("finance cards, history filter and toolbar opt into padding while preserving APIs and labels", () => {
  const source = read("modules/tenant/tenant-finance.tab.js");
  assert.equal((source.match(/class="panel panel--padded"/g) || []).length, 3);
  assert.match(source, /<div class="content-card-stack" data-bills>/);
  assert.match(source, /input class="form-control" type="month" name="period" aria-label="Kỳ xem lịch sử"/);
  assert.match(source, /class="btn btn--secondary" data-all-periods>Tất cả kỳ/);
  assert.match(source, /class="tenant-finance-period-form" data-period-form/);
  assert.match(source, /class="tenant-finance-period-form__actions"/);
  assert.match(source, /class="btn btn--primary">Xem kỳ/);
  assert.match(source, /import "\.\/tenant-finance\.css"/);
  assert.match(source, /refreshButton.className = "btn btn--secondary content-card-action"/);
  assert.match(source, /loadSummary\("\/v1\/me\/billing-summary"\)/);
  for (const path of ["tenant/tenant-finance.tab.js", "tenant/rental-info.tab.js", "residents-contracts/requests.tab.js"]) assert.match(read(`modules/${path}`), /import "\.\.\/\.\.\/shared\/components\/content-card\.css"/);
});

test("owner move-out cards require TRA_PHONG type, preserve submitted content and escape notes", () => {
  const moveOut = { requestedDate: "2026-12-01", approvedDate: null, minimumNormalMoveOutDate: "2026-12-02", earlyReturnReason: '<img src=x onerror="bad">' };
  const other = { loai_yeu_cau: "KHAC", noi_dung: "Muốn đổi phòng khác", moveOut };
  assert.equal(moveOutCardsMarkup([other]), "");
  assert.equal(moveOutCardsMarkup([{ loai_yeu_cau: "TRA_PHONG" }]), "");
  const html = moveOutCardsMarkup([other, { loai_yeu_cau: "TRA_PHONG", noi_dung: "TEST <script>bad</script>", moveOut }]);
  assert.match(html, /<h3>Đề nghị trả phòng<\/h3>/); assert.doesNotMatch(html, /Đề ngi|Muốn đổi phòng khác|<img|<script>/);
  assert.match(html, /01\/12\/2026/); assert.match(html, /02\/12\/2026/); assert.match(html, /&lt;img/);
  assert.equal((html.match(/class="panel panel--padded"/g) || []).length, 2);
  assert.match(moveOutCardsMarkup([{ loai_yeu_cau: "TRA_PHONG", noi_dung: "Muốn đổi phòng khác", moveOut }]), /Muốn đổi phòng khác/);
});
