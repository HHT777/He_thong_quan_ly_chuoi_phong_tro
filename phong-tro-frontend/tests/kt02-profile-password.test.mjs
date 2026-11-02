import test from "node:test";
import assert from "node:assert/strict";

const values = new Map();
globalThis.window = { __API_BASE_URL__: "/api", dispatchEvent() {} };
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

const { validatePasswordChange, createPasswordSubmitHandler, profileBodyHtml, openProfileModal, closeModal } = await import("../src/layout/modals.js");
const { changePassword } = await import("../src/core/session.js");
const { api } = await import("../src/core/api.js");

test("KT-02 password form validates current, new and confirmation like backend", () => {
  assert.match(validatePasswordChange("", "Valid1234", "Valid1234"), /hiện tại/);
  assert.match(validatePasswordChange("old", "short", "short"), /8 ký tự/);
  assert.match(validatePasswordChange("old", "abcdefgh", "abcdefgh"), /chữ và số/);
  assert.match(validatePasswordChange("old", "Valid1234", "Different1234"), /không khớp/);
  assert.equal(validatePasswordChange("old", "Valid1234", "Valid1234"), null);
});

test("KT-02 profile markup only displays escaped read-only server fields and never interpolates secrets", () => {
  const html = profileBodyHtml({
    vai_tro: "KHACH_THUE", ten_dang_nhap: 'bad"<script>',
    khachThue: { ho_ten: "<img src=x onerror=alert(1)>", so_dien_thoai: "<phone>" },
    mat_khau: "hash-should-never-render", token: "token-should-never-render",
  }, true);
  assert.doesNotMatch(html, /<img|<script|hash-should-never-render|token-should-never-render|@isk19\.vn/);
  assert.match(html, /&lt;img/);
  assert.match(html, /readonly disabled/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /name="(?:currentPassword|newPassword|confirmPassword)"[^>]*value=/);
  assert.match(html, /data-password-logout/);
  assert.doesNotMatch(html, /data-modal-close/);
});

test("KT-02 submit handler blocks duplicate requests, preserves fields on failure", async () => {
  const fields = { currentPassword: { value: "old" }, newPassword: { value: "Valid1234" }, confirmPassword: { value: "Valid1234" } };
  const button = { disabled: false };
  let resetCount = 0;
  const form = { elements: { namedItem: (key) => fields[key] }, querySelector: () => button, reset() { resetCount += 1; } };
  let calls = 0;
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const errors = [];
  const success = [];
  const handle = createPasswordSubmitHandler({
    form, submit: async () => { calls += 1; return pending; },
    onError: (value) => errors.push(value), onSuccess: (value) => success.push(value),
  });
  const event = { preventDefault() {} };
  const first = handle(event);
  await handle(event);
  assert.equal(calls, 1);
  assert.equal(button.disabled, true);
  finish({ vai_tro: "KHACH_THUE" });
  await first;
  assert.equal(button.disabled, false);
  assert.equal(resetCount, 1);
  assert.equal(success.length, 1);
  assert.deepEqual(errors, [""]);
  const failed = createPasswordSubmitHandler({ form, submit: async () => { throw new Error("Mật khẩu hiện tại không đúng"); }, onError: (value) => errors.push(value), onSuccess() { throw new Error("Unexpected success"); } });
  await failed(event);
  assert.equal(errors.at(-1), "Mật khẩu hiện tại không đúng");
  assert.equal(resetCount, 1);
});

test("KT-02 password API replaces the stored JWT without exposing its claim in user data", async (t) => {
  values.clear();
  values.set("trohub_token", "old-token");
  values.set("trohub_user", JSON.stringify({ vai_tro: "KHACH_THUE" }));
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; values.clear(); });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ success: true, data: { changed: true, token: "new-token", user: { vai_tro: "KHACH_THUE", mustChangePassword: false } } }) };
  };
  const user = await changePassword("old-secret", "Valid1234");
  assert.equal(request.url, "/api/v1/account/password");
  assert.equal(request.options.method, "PATCH");
  assert.equal(request.options.headers.Authorization, "Bearer old-token");
  assert.deepEqual(JSON.parse(request.options.body), { currentPassword: "old-secret", newPassword: "Valid1234" });
  assert.equal(values.get("trohub_token"), "new-token");
  assert.equal(user.mustChangePassword, false);
  assert.doesNotMatch(values.get("trohub_user"), /old-secret|Valid1234|passwordFingerprint|new-token/);
});

test("KT-02 profile modal fetches the real endpoint and retries a load error", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  t.after(() => { closeModal(true); globalThis.fetch = originalFetch; globalThis.document = originalDocument; values.clear(); });
  values.set("trohub_token", "profile-token");
  let retry;
  const form = { addEventListener() {}, querySelector: () => ({ focus() {} }) };
  const body = {
    innerHTML: "",
    querySelector(selector) {
      if (selector === "[data-profile-error]") return { set textContent(value) { this.value = value; } };
      if (selector === "[data-profile-retry]") return { addEventListener(_type, handler) { retry = handler; } };
      if (selector === "[data-password-form]") return form;
      if (selector === "[data-password-error]") return { textContent: "" };
      if (selector === "[data-password-logout]") return null;
      return null;
    },
  };
  const overlay = { innerHTML: "", className: "", parentElement: null, addEventListener() {}, querySelector: () => body };
  globalThis.document = {
    createElement: () => overlay, addEventListener() {}, removeEventListener() {},
    body: { appendChild(node) { node.parentElement = this; }, removeChild(node) { node.parentElement = null; } },
  };
  let calls = 0;
  globalThis.fetch = async (url) => {
    assert.equal(url, "/api/auth/profile");
    calls += 1;
    if (calls === 1) throw new Error("Mất kết nối");
    return { ok: true, status: 200, json: async () => ({ success: true, data: { vai_tro: "KHACH_THUE", ten_dang_nhap: "tenant", khachThue: { ho_ten: "<name>", so_dien_thoai: "090" } } }) };
  };
  openProfileModal({ vai_tro: "KHACH_THUE" });
  assert.match(body.innerHTML, /Đang tải hồ sơ/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(body.innerHTML, /data-profile-retry/);
  assert.equal(typeof retry, "function");
  retry();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.match(body.innerHTML, /&lt;name&gt;/);
});

test("KT-02 password-required 403 keeps the current token for the change-password form", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; values.clear(); });
  values.set("trohub_token", "forced-token");
  globalThis.fetch = async () => ({
    ok: false, status: 403,
    json: async () => ({ success: false, error: { code: "PASSWORD_CHANGE_REQUIRED", message: "Cần đổi mật khẩu" } }),
  });
  await assert.rejects(api.get("/v1/notifications"), { status: 403, code: "PASSWORD_CHANGE_REQUIRED" });
  assert.equal(values.get("trohub_token"), "forced-token");
});
