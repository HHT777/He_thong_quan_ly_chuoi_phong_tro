const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("FR-166/169 room-access wrapper uses common ownership policy and retains capacity", () => {
  const wrapper = fs.readFileSync(path.resolve(__dirname, "../src/services/propertyAccess.service.js"), "utf8");
  const policy = fs.readFileSync(path.resolve(__dirname, "../src/services/ownership.service.js"), "utf8");
  assert.match(wrapper, /assertOwned\(user, "room", roomId, \{ transaction \}\)/);
  assert.match(policy, /"ma_phong", "ma_can", "so_nguoi_toi_da"/);
  assert.match(policy, /RESOURCE_NOT_FOUND/);
});
