const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const frontend = path.resolve(__dirname, "../../phong-tro-frontend/src");
const read = (name) => fs.readFileSync(path.join(frontend, name), "utf8");

test("FR-200 configuration client validates server domains and groups without inventing defaults", async () => {
  const model = await import(pathToFileURL(path.join(frontend, "modules/settings/system-config.model.mjs")));
  const number = { key: "overdueDay", type: "integer", domain: { min: 1, max: 28 }, group: "Công nợ" };
  const zone = { key: "timezone", type: "timezone", domain: { options: ["Asia/Ho_Chi_Minh", "Asia/Saigon"] }, group: "Chung" };
  assert.equal(model.validateSetting(number, "6"), 6);
  for (const invalid of ["", "  ", "-1", "1.5", "29", "abc"]) assert.throws(() => model.validateSetting(number, invalid));
  assert.equal(model.validateSetting(zone, "Asia/Ho_Chi_Minh"), "Asia/Ho_Chi_Minh");
  assert.throws(() => model.validateSetting(zone, "UTC"));
  const imageSize = { key: "maxFileSizeBytes", type: "integer", domain: { min: 1, max: 100 * 1048576 } };
  assert.equal(model.validateDisplaySetting(imageSize, "10"), 10 * 1048576);
  assert.equal(model.validateDisplaySetting(imageSize, "1.5"), 1572864);
  assert.throws(() => model.validateDisplaySetting(imageSize, "101"));
  assert.throws(() => model.validateDisplaySetting(imageSize, "abc"));
  assert.deepEqual([...model.groupSettings([number, zone]).keys()], ["Công nợ", "Chung"]);
});

test("FR-200 screen uses protected config API, retry, confirmation and escaped server text", () => {
  const screen = read("modules/settings/system-config.tab.js");
  const registry = read("core/module-registry.js");
  const shell = read("layout/app-shell.js");
  assert.match(screen, /roles: \["CHU_TRO"\]/);
  assert.match(screen, /context\.api\.get\("\/v1\/system-config"\)/);
  assert.match(screen, /context\.api\.put\(`\/v1\/system-config\/\$\{key\}`/);
  assert.match(screen, /context\.api\.post\(`\/v1\/system-config\/\$\{key\}\/reset`/);
  assert.match(screen, /confirmAction\(/);
  assert.match(screen, /data-retry>Thử lại/);
  assert.match(screen, /data-retry.*addEventListener\("click", load\)/);
  assert.match(screen, /escapeHtml\(row\.description\)/);
  assert.match(screen, /escapeHtml\(row\.updatedBy\?\.username/);
  assert.match(screen, /affectsMoney/);
  assert.doesNotMatch(screen, /JWT_SECRET|DB_PASSWORD|contractStatusJobCron/);
  assert.match(registry, /!tab\.hiddenFromNav/);
  assert.match(shell, /go\("\/settings\/system-config"\)/);
});
