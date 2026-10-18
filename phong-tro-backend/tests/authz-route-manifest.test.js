const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const routesDir = path.resolve(__dirname, "../src/routes");
const phase1 = [
  "hopDong.routes.js POST /", "hopDong.routes.js GET /:id", "hopDong.routes.js PUT /:id",
  "hopDong.routes.js POST /:id/transfers",
  "datCoc.routes.js POST /", "datCoc.routes.js POST /:id/confirm", "datCoc.routes.js POST /:id/cancel",
  "khoanPhaiThu.routes.js POST /", "khoanPhaiThu.routes.js POST /payment/create",
  "khoanPhaiThu.routes.js POST /payment/:id/confirm", "khoanPhaiThu.routes.js GET /payment/stats",
  "mvp.routes.js POST /accounts", "mvp.routes.js PATCH /accounts/:id/status",
  "mvp.routes.js POST /accounts/reset-password", "mvp.routes.js POST /discounts",
  "mvp.routes.js POST /bills/:id/adjustments", "mvp.routes.js POST /billing-adjustments",
  "mvp.routes.js PATCH /billing-adjustments/:id", "mvp.routes.js POST /billing-adjustments/:id/toggle",
  "mvp.routes.js POST /bills/preview", "mvp.routes.js POST /bills/generate",
  "mvp.routes.js POST /bills/:id/mark-paid", "mvp.routes.js POST /bills/mark-all-paid",
  "mvp.routes.js POST /payments/:id/cancel", "mvp.routes.js POST /move-outs/:contractId/settle",
  "mvp.routes.js POST /move-outs/:id/deposit-refunds",
];

test("authz route manifest: inventory changes require explicit review", () => {
  const signatures = fs.readdirSync(routesDir).filter((file) => file.endsWith(".routes.js"))
    .flatMap((file) => [...fs.readFileSync(path.join(routesDir, file), "utf8")
      .matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)]
      .map((match) => `${file} ${match[1].toUpperCase()} ${match[2]}`));
  assert.equal(signatures.length, 117, "A new or removed route must be classified in AUTHZ_MATRIX.md");
  assert.equal(new Set(signatures).size, signatures.length, "Duplicate method/path registration in a route file");
  assert.equal(phase1.length, 26);
  for (const route of phase1) assert.ok(signatures.includes(route), `Phase 1 route missing: ${route}`);
  const digest = crypto.createHash("sha256").update(signatures.sort().join("\n")).digest("hex");
  assert.equal(digest, "c8bf62b38c40c50ed003a5e05e9432b9f7f20e93035bf8ddd370c92977e1f6fe",
    "Route signature changed: review ownership scope and update the manifest deliberately");
});
