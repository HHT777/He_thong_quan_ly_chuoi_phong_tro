const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("FR-065 landlord OCR screen uses preview token, validates image and handles manual/expired flows", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/operations/meter-readings.tab.js"), "utf8");
  assert.match(source, /validateImage\(file, maxBytes\)/);
  assert.match(source, /image\/jpeg.*image\/png/);
  assert.match(source, /postForm\("\/v1\/meter-readings\/ocr-previews"/);
  assert.match(source, /post\("\/v1\/meter-readings\/ocr-submit"/);
  assert.match(source, /MANUAL_REQUIRED/);
  assert.match(source, /UPLOAD_TOKEN_EXPIRED/);
  assert.match(source, /READING_BELOW_PREVIOUS/);
  assert.match(source, /CHUYEN_PHONG/);
  assert.doesNotMatch(source, /\bfetch\(/);
});
