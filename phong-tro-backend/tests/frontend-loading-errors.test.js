const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const front = path.resolve(__dirname, "../../phong-tro-frontend");
const read = (relative) => fs.readFileSync(path.join(front, relative), "utf8");

test("FR-144 bill loading errors replace the spinner and offer retry", () => {
  const source = read("src/modules/finance/bills.tab.js");
  assert.match(source, /try\s*\{\s*const \[contractsResponse, buildingsResponse\]/);
  assert.match(source, /await refresh\(\);\s*\} catch \(error\)/);
  assert.match(source, /Không tải được phiếu thu/);
  assert.match(source, /data-retry-load/);
  assert.match(source, /addEventListener\("click", \(\) => render\(context\)\)/);
});

test("dashboard does not convert failed API calls into zero-valued data", () => {
  const source = read("src/modules/overview/dashboard.view.mjs");
  assert.doesNotMatch(source, /\.catch\(\(\) => \(\{ data:/);
  assert.match(source, /data-retry="\$\{source\}"/);
  assert.match(source, /dashboardError\(error\)/);
  assert.match(source, /sourcePanels\[source\]\.forEach/);
});

test("co-tenant page shows an API loading error instead of leaving stale content", () => {
  const source = read("src/modules/residents-contracts/co-tenants.tab.js");
  assert.match(source, /catch \(error\) \{ content\.innerHTML = `<div class="empty-state empty-state--error">\$\{escapeHtml\(error\.message\)\}<\/div>`; \}/);
});

test("Vietnamese heading uses a Vietnamese-capable font and source text is valid UTF-8", () => {
  const html = read("index.html");
  assert.match(html, /Noto\+Sans/);
  assert.match(html, /subset=vietnamese/);
  assert.match(read("src/shared/styles/design-system.css"), /--font-sans: "Noto Sans"/);
  assert.match(read("src/main.js"), /styles\/vietnamese\.css/);
  assert.match(read("src/shared/styles/vietnamese.css"), /\.module-page h1,[\s\S]*font-family: "Noto Sans"/);
  assert.match(read("src/modules/finance/bills.tab.js"), /title: "Phiếu thu", tabLabel: "Phiếu thu"/);
});
