import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Exercise the real tab and renderer; only stylesheet loading and the DOM transport
// are replaced, without installing a second browser/runtime dependency.
const url = new URL("../src/modules/tenant/tenant-finance.tab.js", import.meta.url);
const source = readFileSync(url, "utf8");
const executable = source.replace(/import "[^"\n]+\.css";/g, "")
  .replace(/from "([^"]+)"/g, (_match, path) => `from ${JSON.stringify(new URL(path, url).href)}`);
const tab = (await import(`data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`)).default;
class Element {
  constructor() { this.innerHTML = ""; this.isConnected = true; this.listeners = {}; this.children = new Map(); this.disabled = false; }
  querySelector(selector) { return this.children.get(selector) || null; }
  querySelectorAll() { return []; }
  addEventListener(event, handler) { this.listeners[event] = handler; }
  setAttribute(key, value) { this[key] = value; }
  removeAttribute(key) { delete this[key]; }
  before(element) { this.beforeElement = element; }
  click() { return this.disabled ? undefined : this.listeners.click?.(); }
}
const summary = (amount) => ({ data: { currentPeriod: "2026-10", businessDate: "2026-10-29", current: { totalDue: 900, settledAmount: 900 - amount, cashReceived: 900 - amount, depositOffset: 0, remainingAmount: amount, pendingCount: 0 }, oldDebt: { remainingAmount: 0 }, postLiquidationDebt: { remainingAmount: 0, bills: [] }, totalRemainingDue: amount } });
function harness(t, get) {
  const main = new Element(), content = new Element(), form = new Element(), period = { value: "" };
  main.children.set("[data-content]", content);
  for (const selector of ["[data-summary]", "[data-post-debt]", "[data-bills]", "[data-all-periods]"]) content.children.set(selector, new Element());
  content.children.set("[data-period-form]", form); form.elements = { namedItem: () => period }; form.reset = () => { period.value = ""; };
  const bills = content.querySelector("[data-bills]");
  for (const selector of ["[data-bill-prev]", "[data-bill-next]", "[data-retry]", "[data-error]"]) bills.children.set(selector, new Element());
  const stat = content.querySelector("[data-summary]");
  for (const selector of ["[data-retry]", "[data-error]"]) stat.children.set(selector, new Element());
  const original = globalThis.document; globalThis.document = { createElement: () => new Element() };
  t.after(() => { globalThis.document = original; });
  return { main, content, form, period, bills, stat, render: () => tab.render({ main, api: { get } }), button: () => content.beforeElement };
}
const listed = (page = 1) => ({ data: [{ ma_thanh_toan: "bill-a", thang: 9, nam: 2026, tong_phai_tra: 900, tong_da_thanh_toan: 200, so_tien_con_no: 700, trang_thai: "THANH_TOAN_MOT_PHAN" }], pagination: { page, totalPages: 3, hasNext: true, hasPrev: page > 1 } });

test("KT-06 refresh reloads authoritative summary and selected history period/page without duplicate clicks", async (t) => {
  let amount = 900; let release; let blocked = false; const paths = [];
  const h = harness(t, async (path) => { paths.push(path); if (blocked) await new Promise((resolve) => { const previous = release; release = () => { previous?.(); resolve(); }; }); return path.includes("billing-summary") ? summary(amount) : listed(Number(new URLSearchParams(path.split("?")[1]).get("page"))); });
  await h.render(); assert.match(h.stat.innerHTML, /900 đ/);
  h.period.value = "2026-09"; h.form.listeners.submit({ preventDefault() {} }); await new Promise(setImmediate);
  h.bills.querySelector("[data-bill-next]").click(); await new Promise(setImmediate);
  amount = 0; blocked = true; const before = paths.length; const pending = h.button().click();
  h.button().click(); assert.equal(paths.length - before, 2); assert.equal(h.button().disabled, true);
  assert.equal(h.button()["aria-busy"], "true"); blocked = false; release(); await pending;
  assert.deepEqual(paths.slice(-2), ["/v1/me/billing-summary", "/khoan-phai-thu?ky=2026-09&page=2&limit=20"]);
  assert.equal(h.period.value, "2026-09"); assert.match(h.stat.innerHTML, /0 đ/); assert.equal(h.button().disabled, false);
  assert.equal(h.button().textContent, "Cập nhật số liệu");
});

test("KT-06 refresh failure keeps retry available, re-enables button and never invents totals", async (t) => {
  let offline = false;
  const h = harness(t, async (path) => { if (offline) throw new Error('<img src=x onerror="oops"> offline'); return path.includes("billing-summary") ? summary(700) : listed(); });
  await h.render(); offline = true; await h.button().click();
  assert.equal(h.button().disabled, false); assert.doesNotMatch(h.stat.innerHTML, /700 đ|0 đ|<img/);
  assert.match(h.stat.querySelector("[data-error]").textContent, /offline/);
  offline = false; await h.stat.querySelector("[data-retry]").click(); await h.bills.querySelector("[data-retry]").click();
  assert.match(h.stat.innerHTML, /700 đ/);
});

test("KT-06 tenant UI keeps one summary source and no debt list, financial arithmetic or write actions", () => {
  assert.doesNotMatch(source, /\/v1\/debt|\.reduce\(|Math\.round|\.post\(|\.patch\(/);
  assert.match(source, /loadSummary\("\/v1\/me\/billing-summary"\)/);
  assert.match(source, /billListPath\(period, page\)/);
});
