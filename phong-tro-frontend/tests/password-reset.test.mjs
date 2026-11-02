import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const values = new Map();
globalThis.window = { __API_BASE_URL__: "/api" };
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

const { requestPasswordReset } = await import("../src/core/session.js");

test("password reset request uses the public auth endpoint and phone payload", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; values.clear(); });
  values.set("trohub_token", "stale-token");
  values.set("trohub_user", JSON.stringify({ vai_tro: "KHACH_THUE" }));
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 201, json: async () => ({ success: true, data: { trang_thai: "CHO_XU_LY" } }) };
  };
  const result = await requestPasswordReset("0901234567");
  assert.equal(request.url, "/api/auth/password-reset-requests");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(request.options.body), { so_dien_thoai: "0901234567" });
  assert.equal(result.trang_thai, "CHO_XU_LY");
});

test("login screen exposes a route to the forgot-password interface", () => {
  const source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(source, /data-forgot-password/);
  assert.match(source, /id="password-reset-form"/);
  assert.match(source, /requestPasswordReset\(phone\)/);
});
