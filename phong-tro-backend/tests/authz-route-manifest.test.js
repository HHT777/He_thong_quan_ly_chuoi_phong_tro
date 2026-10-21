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
  assert.equal(signatures.length, 122, "A new or removed route must be classified in AUTHZ_MATRIX.md");
  assert.equal(new Set(signatures).size, signatures.length, "Duplicate method/path registration in a route file");
  assert.equal(phase1.length, 26);
  for (const route of phase1) assert.ok(signatures.includes(route), `Phase 1 route missing: ${route}`);
  const digest = crypto.createHash("sha256").update(signatures.sort().join("\n")).digest("hex");
  assert.equal(digest, "51f06e1671bf50fe067ff4118935fb99d08637e59f7adcd61a9aeb9c578b18e5",
    "Route signature changed: review ownership scope and update the manifest deliberately");
  const matrix = fs.readFileSync(path.resolve(__dirname, "../../docs/AUTHZ_MATRIX.md"), "utf8");
  const documented = [...matrix.matchAll(/^\| ([A-Za-z]+\.routes\.js) \| (GET|POST|PUT|PATCH|DELETE) \| (\/[^| ]*) \|/gm)]
    .map((match) => `${match[1]} ${match[2]} ${match[3]}`);
  assert.equal(documented.length, 122, "Each route requires one explicit matrix row");
  assert.match(matrix, /^\| mvp\.routes\.js \| POST \| \/system-config\/:key\/reset \| FR-200:/m);
  assert.match(matrix, /^\| mvp\.routes\.js \| GET \| \/dashboard\/summary \| BE-1 FR-024\/144:/m);
  assert.deepEqual(documented.sort(), signatures, "Route inventory and authorization matrix differ");
  assert.match(matrix, /^\| phong\.routes\.js \| GET \| \/ \| BE-1 FR-024:/m);
  assert.match(matrix, /^\| phong\.routes\.js \| GET \| \/:id \| BE-1 FR-026:/m);
});
