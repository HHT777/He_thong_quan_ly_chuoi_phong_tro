const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../phong-tro-frontend/src");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("FR-184 contract detail offers print, loading error and retry", () => {
  const source = read("modules/residents-contracts/contracts.tab.js");
  assert.match(source, /openDetail: openContractDetail/);
  assert.match(source, /id: "detail", label: "Chi tiết", openDetail: true/);
  assert.match(source, /data-print>In hợp đồng/);
  assert.match(source, /getHtml\(`\/hop-dong\/\$\{encodeURIComponent\(row\.ma_hop_dong\)\}\/print`\)/);
  assert.match(source, /Không tải được bản in/);
  assert.match(source, /retry\.addEventListener\("click", loadPrint\)/);
  assert.match(source, /frame\.setAttribute\("sandbox", "allow-same-origin allow-modals"\)/);
});

test("FR-184 HTML API uses the shared base URL and authenticated request", () => {
  const source = read("core/api.js");
  assert.match(source, /async function getHtml\(path\)/);
  assert.match(source, /headers\.Authorization = `Bearer \$\{token\(\)\}`/);
  assert.match(source, /fetch\(`\$\{API_ROOT\}\$\{path\.startsWith/);
  assert.match(source, /getHtml,/);
});
