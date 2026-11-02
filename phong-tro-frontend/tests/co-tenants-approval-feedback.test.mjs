import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("approval failures are reported beside the selected request", () => {
  const source = readFileSync(new URL("../src/modules/residents-contracts/co-tenants.tab.js", import.meta.url), "utf8");
  const heading = source.indexOf("Yêu cầu được chọn");
  const feedback = source.indexOf('<p data-message role="status"></p>', heading);
  const table = source.indexOf('<div class="table-wrap">', heading);
  assert.ok(heading >= 0 && feedback > heading && feedback < table);
  assert.match(source, /message\.textContent = error\.message/);
  assert.doesNotMatch(source, /\["Hợp đồng", detail\.contract\?\.id\]/);
});
