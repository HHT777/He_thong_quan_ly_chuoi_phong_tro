const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const frontend = (relativePath) => fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src", relativePath), "utf8");

test("CT-015 account tab exposes guarded create, lock, unlock and reset actions", () => {
  const tab = frontend("modules/residents-contracts/accounts.tab.js");
  const view = frontend("shared/components/view.js");
  assert.match(view, /config\.rowActions/);
  assert.match(tab, /\/v1\/accounts/);
  assert.match(tab, /status: "DA_KHOA"/);
  assert.match(tab, /status: "HOAT_DONG"/);
  assert.match(tab, /\/v1\/accounts\/reset-password/);
  assert.doesNotMatch(tab, /password\s*:/);
});
