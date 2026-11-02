const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("F.5 finance and operations screens use shared API and confirmation dialog", () => {
  const root = path.resolve(__dirname, "../../phong-tro-frontend/src/modules");
  const folders = ["finance", "operations", "residents-contracts"];
  const files = folders.flatMap((folder) => fs.readdirSync(path.join(root, folder)).filter((name) => name.endsWith(".js")).map((name) => path.join(root, folder, name)));
  const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /\bfetch\(/);
  assert.doesNotMatch(source, /window\.(alert|confirm|prompt)\(/);
  assert.match(source, /confirmAction\(/);
});
