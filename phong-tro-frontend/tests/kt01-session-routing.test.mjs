import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tabsForUser, tabForRoute } from "../src/core/route-policy.mjs";
import { captureDraft, draftForUser, restoreDraft } from "../src/core/session-draft.mjs";

const tabs = [
  { route: "/overview/dashboard", roles: ["CHU_TRO"] },
  { route: "/tenant/rental-info", roles: ["KHACH_THUE"] },
  { route: "/notifications/inbox", roles: ["CHU_TRO", "KHACH_THUE"] },
];

test("KT-01 allows exact role routes for both roles and rejects cross-role/unknown routes", () => {
  const owner = { vai_tro: "CHU_TRO" };
  const tenant = { vai_tro: "KHACH_THUE" };
  assert.equal(tabForRoute(tabs, "/overview/dashboard", owner)?.route, "/overview/dashboard");
  assert.equal(tabForRoute(tabs, "/tenant/rental-info", tenant)?.route, "/tenant/rental-info");
  assert.equal(tabForRoute(tabs, "/notifications/inbox", owner)?.route, "/notifications/inbox");
  assert.equal(tabForRoute(tabs, "/notifications/inbox", tenant)?.route, "/notifications/inbox");
  assert.equal(tabForRoute(tabs, "/tenant/rental-info", owner), undefined);
  assert.equal(tabForRoute(tabs, "/overview/dashboard", tenant), undefined);
  assert.equal(tabForRoute(tabs, "/tenant/notifications", tenant), undefined);
  assert.deepEqual(tabsForUser(tabs, { vai_tro: "ADMIN" }), []);
  assert.deepEqual(tabsForUser(tabs, null), []);
});

test("KT-01 router replaces forbidden hash without adding a back-button loop and bell targets shared inbox", () => {
  const router = readFileSync(new URL("../src/core/router.js", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../src/layout/app-shell.js", import.meta.url), "utf8");
  const entry = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(router, /const target = routeAllowed\(route, context\.user\) \? route : defaultRoute\(context\.user\)/);
  assert.match(router, /history\.replaceState\(null, "",/);
  assert.match(router, /return Boolean\(findTab\(clean\(route\), currentUser\)\)/);
  assert.match(shell, /api\.get\("\/v1\/notifications\/unread-count"\)/);
  assert.match(readFileSync(new URL("../src/layout/notification-bell.mjs", import.meta.url), "utf8"), /navigate\("\/notifications\/inbox"\)/);
  assert.doesNotMatch(shell, /\/tenant\/notifications/);
  assert.match(shell, /href="#\$\{defaultRoute\(currentUser\)\}"/);
  assert.ok(entry.indexOf("await validateSession()") < entry.indexOf("mountShell(root, currentUser)"));
  assert.match(entry, /setShellActive\(root, tab, currentUser\)/);
});

test("KT-01 keeps non-secret form values in memory for the same account after 401", () => {
  const textField = { name: "content", type: "text", value: "Nội dung đang nhập", checked: false };
  const passwordField = { name: "password", type: "password", value: "secret", checked: false };
  const form = { querySelectorAll: () => [textField, passwordField] };
  const root = { querySelectorAll: () => [form] };
  const draft = captureDraft(root, "/tenant/requests", 5);
  assert.equal(draftForUser(draft, 5), draft);
  assert.equal(draftForUser(draft, 6), null);
  assert.deepEqual(draft.forms[0].map((field) => field.name), ["content"]);
  textField.value = "";
  passwordField.value = "";
  restoreDraft(root, draft);
  assert.equal(textField.value, "Nội dung đang nhập");
  assert.equal(passwordField.value, "");
});

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
globalThis.window = new EventTarget();
window.__API_BASE_URL__ = "/api";
const { api, TOKEN_KEY } = await import("../src/core/api.js");
const { login, validateSession } = await import("../src/core/session.js");

test("KT-01 login failure keeps credentials and does not emit session expiry", async (t) => {
  values.clear();
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let expired = 0;
  const onExpired = () => { expired += 1; };
  window.addEventListener("isk19:session-expired", onExpired);
  t.after(() => window.removeEventListener("isk19:session-expired", onExpired));
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: "Sai mật khẩu" }), { status: 401, headers: { "Content-Type": "application/json" } });
  await assert.rejects(login({ ten_dang_nhap: "tenant", mat_khau: "wrong" }), /Sai mật khẩu/);
  assert.equal(expired, 0);
  assert.equal(values.has(TOKEN_KEY), false);
});

test("KT-01 validates stored session against profile and cleans both keys on protected 401", async (t) => {
  values.clear();
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/auth/login")) return new Response(JSON.stringify({ success: true, data: { token: "tenant-token", user: { ma_tai_khoan: 5, vai_tro: "KHACH_THUE" } } }), { status: 200 });
    assert.equal(options.headers.Authorization, "Bearer tenant-token");
    return new Response(JSON.stringify({ success: true, data: { ma_tai_khoan: 5, vai_tro: "KHACH_THUE", khachThue: { ma_khach_thue: 9 } } }), { status: 200 });
  };
  await login({ ten_dang_nhap: "tenant", mat_khau: "correct" });
  assert.equal((await validateSession()).ma_khach_thue, 9);
  let expired = 0;
  const onExpired = () => { expired += 1; };
  window.addEventListener("isk19:session-expired", onExpired);
  t.after(() => window.removeEventListener("isk19:session-expired", onExpired));
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: "Expired" }), { status: 401 });
  await assert.rejects(api.get("/auth/profile"), /Expired/);
  assert.equal(expired, 1);
  assert.equal(values.has(TOKEN_KEY), false);
  assert.equal(values.has("trohub_user"), false);
});

test("KT-01 stale request 401 cannot log out a newer session, while 403 keeps the current form session", async (t) => {
  values.clear();
  values.set(TOKEN_KEY, "old-token");
  values.set("trohub_user", JSON.stringify({ vai_tro: "KHACH_THUE" }));
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => {
    values.set(TOKEN_KEY, "new-token");
    return new Response(JSON.stringify({ success: false, message: "Expired" }), { status: 401 });
  };
  await assert.rejects(api.get("/v1/notifications"), /Expired/);
  assert.equal(values.get(TOKEN_KEY), "new-token");
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: "Forbidden" }), { status: 403 });
  await assert.rejects(api.get("/v1/notifications"), /Forbidden/);
  assert.equal(values.get(TOKEN_KEY), "new-token");
  assert.equal(values.has("trohub_user"), true);
});

test("KT-01 HTML and blob requests share 401 session cleanup", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: "Expired" }), { status: 401 });
  let expired = 0;
  const onExpired = () => { expired += 1; };
  window.addEventListener("isk19:session-expired", onExpired);
  t.after(() => window.removeEventListener("isk19:session-expired", onExpired));
  for (const [method, path] of [["getHtml", "/hop-dong/1/print"], ["getBlob", "/v1/reports/cashflow.xlsx"]]) {
    values.set(TOKEN_KEY, "current-token");
    values.set("trohub_user", JSON.stringify({ ma_tai_khoan: 5, vai_tro: "KHACH_THUE" }));
    await assert.rejects(api[method](path), /Expired/);
    assert.equal(values.has(TOKEN_KEY), false);
    assert.equal(values.has("trohub_user"), false);
  }
  assert.equal(expired, 2);
});
