import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contractMarkup, formMarkup, historyMarkup, moveOutMarkup, renewalPayload, submitGate } from "../src/modules/tenant/tenant-renewal.model.mjs";
test("KT09 shows server dates and eligibility safely without a date input or client date arithmetic", () => {
  const c = { eligible: false, reasonCode: "RENEWAL_ALREADY_PENDING", roomName: '<img src=x>', buildingName: '<script>x</script>', currentEndDate: "2026-10-31", allowedPackages: [{ months: 6, expectedEndDate: "2027-04-30" }] };
  const html = contractMarkup(c, 6); assert.match(html, /30\/04\/2027/); assert.match(html, /chờ xử lý/); assert.match(html, /&lt;script/); assert.doesNotMatch(html, /<script|<img|<input/);
  const source = readFileSync(new URL("../src/modules/tenant/tenant-requests.tab.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /type[=:] ?["']date|requestedEndDate|setMonth|setUTCMonth/); assert.match(source, /\/v1\/me\/renewal-context/); assert.match(source, /error.status !== 401/); assert.match(source, /aria-live="polite"/); assert.match(source, /data-retry/);
});
test("KT09 displays rejected reason legacy and empty history with escaped content", () => {
  assert.match(historyMarkup([]), /Chưa có yêu cầu/);
  const html = historyMarkup([{ loai_yeu_cau: "GIA_HAN", trang_thai: "TU_CHOI", noi_dung: '<img src=x>', ly_do_xu_ly: '<script>no</script>', renewal: { packageMonths: null } }]);
  assert.match(html, /thiếu gói/); assert.match(html, /Từ chối/); assert.match(html, /&lt;script/); assert.doesNotMatch(html, /<script|<img/);
});
test("KT09 payload sends selected contract and package only and validates form", () => {
  assert.deepEqual(renewalPayload("own", "12", " reason "), { type: "GIA_HAN", contractId: "own", packageMonths: 12, content: "reason" });
  for (const args of [["", 6, "x"], ["own", 3, "x"], ["own", 6, " "]]) assert.throws(() => renewalPayload(...args));
});
test("KT09 concurrent submits are suppressed and retry works after network errors", async () => {
  const gate = submitGate(); let release, calls = 0;
  const first = gate(async () => { calls++; await new Promise((r) => { release = r; }); });
  assert.equal(await gate(async () => { calls++; }), false); release(); await first; assert.equal(calls, 1);
  await assert.rejects(gate(async () => { throw Error("network"); })); assert.equal(await gate(async () => { calls++; }), true); assert.equal(calls, 2);
});

const fixture = (values = {}) => ({ contractId: "own", buildingName: "Căn A", roomName: "101", currentEndDate: "2027-03-31", eligible: true, allowedPackages: [{ months: 6, expectedEndDate: "2027-09-30" }, { months: 12, expectedEndDate: "2028-03-31" }], ...values });
test("KT09 styled form uses static single contract or multiple select, server banner and disabled controls", () => {
  const draft = { contractId: "own", packageMonths: "", content: "<img src=x>" };
  const single = formMarkup([fixture()], draft);
  assert.doesNotMatch(single, /name="contractId"|<input/); assert.match(single, /31\/03\/2027/); assert.match(single, /Ngày dự kiến theo gói<\/dt><dd>—/);
  assert.match(single, /class="form-control"/); assert.match(single, /&lt;img/); assert.doesNotMatch(single, /<img/);
  assert.match(formMarkup([fixture(), fixture({ contractId: "second" })], draft), /select class="form-control" id="renewal-contract"/);
  const blocked = formMarkup([fixture({ eligible: false, reasonCode: "CONTRACT_NOT_EXPIRING" })], draft);
  assert.match(blocked, /renewal-notice--blocked/); assert.match(blocked, /Chưa đến thời gian/); assert.doesNotMatch(blocked, /đang bị vô hiệu hóa/);
  assert.match(blocked, /textarea[^>]+disabled/); assert.match(blocked, /select[^>]+id="renewal-package"[^>]+disabled/); assert.match(blocked, /data-submit disabled/);
  assert.match(blocked, /31\/03\/2027/); assert.match(formMarkup([], draft), /Chưa có hợp đồng/);
});
test("KT09 result cards include distinct textual status badges and padded dates", () => {
  for (const [status, label, variant] of [["CHO_XU_LY", "Chờ xử lý", "warning"], ["DA_PHE_DUYET", "Đã duyệt", "success"], ["TU_CHOI", "Từ chối", "danger"]]) {
    const html = historyMarkup([{ loai_yeu_cau: "GIA_HAN", trang_thai: status, ngay_gui: "2026-10-01", renewal: { packageMonths: 6, expectedEndDate: "2027-03-01" }, ly_do_xu_ly: status === "TU_CHOI" ? "<b>Không đồng ý</b>" : null }]);
    assert.ok(html.includes(label)); assert.ok(html.includes(`badge--${variant}`)); assert.match(html, /01\/10\/2026/); assert.match(html, /01\/03\/2027/);
    if (status === "TU_CHOI") { assert.match(html, /Lý do từ chối/); assert.match(html, /&lt;b&gt;/); assert.doesNotMatch(html, /<b>/); }
    assert.doesNotMatch(html, /<button|<input/);
  }
  assert.match(moveOutMarkup(), /tải điều kiện từ hệ thống/);
  assert.doesNotMatch(moveOutMarkup(), /<form|<button|<input|<textarea/);
});

const tabUrl = new URL("../src/modules/tenant/tenant-requests.tab.js", import.meta.url);
const executable = readFileSync(tabUrl, "utf8").replace(/import "[^"\n]+\.css";/g, "")
  .replace(/from "([^"]+)"/g, (_m, p) => `from ${JSON.stringify(new URL(p, tabUrl).href)}`);
const tab = (await import(`data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`)).default;
class Element {
  constructor(html = "") { this._html = html; this.children = new Map(); this.attributes = {}; this.disabled = false; this.hidden = false; this.isConnected = true; this.value = ""; this.textContent = ""; this.classList = { toggle() {} }; }
  set innerHTML(value) { this._html = value; this.children.clear(); }
  get innerHTML() { return this._html; }
  querySelector(selector) {
    if (selector === "[data-renewal]" && !this._html.includes("data-renewal")) return null;
    if (selector === '[name="contractId"]' && !this._html.includes('name="contractId"')) return null;
    if (["[data-fields]", "[data-submit]"].includes(selector) && !this._html.includes(selector.slice(1, -1))) return null;
    if (!this.children.has(selector)) {
      const child = new Element(this._html);
      if (selector.startsWith("#")) { const tag = this._html.match(new RegExp(`<section id="${selector.slice(1)}"[^>]*>`)); child.hidden = Boolean(tag?.[0].includes(" hidden")); }
      this.children.set(selector, child);
    }
    return this.children.get(selector);
  }
  querySelectorAll(selector) { return selector === '[role="tab"]' ? [this.querySelector('[data-tab="renewal"]'), this.querySelector('[data-tab="move-out"]')] : []; }
  setAttribute(key, value) { this.attributes[key] = value; }
  focus() { this.focused = true; }
}
function harness(t, api = {}) {
  const events = new Map(), main = new Element(), gets = [], posts = [];
  const previous = globalThis.window;
  globalThis.window = { addEventListener: (key, fn) => events.set(key, fn), removeEventListener: (key) => events.delete(key) };
  t.after(() => { globalThis.window = previous; });
  const transport = {
    get: async (url) => { gets.push(url); return api.get ? api.get(url) : { data: url.endsWith("renewal-context") ? { contracts: [fixture()] } : [] }; },
    post: async (url, body) => { posts.push({ url, body }); return api.post ? api.post(url, body) : { data: {} }; },
  };
  return { main, gets, posts, events, render: () => tab.render({ main, api: transport }), root: () => main.querySelector("[data-content]") };
}
test("KT09 keyboard tabs preserve renewal and KT10 loads move-out only when selected", async (t) => {
  const h = harness(t); await h.render(); const root = h.root();
  assert.equal(h.gets.length, 2); assert.match(root.innerHTML, /role="tablist"/); assert.match(root.innerHTML, /aria-controls="request-move-out-panel"/);
  const [renewal, move] = root.querySelectorAll('[role="tab"]');
  await move.onclick(); assert.equal(move.attributes["aria-selected"], "true"); assert.equal(move.tabIndex, 0);
  assert.equal(root.querySelector("#request-renewal-panel").hidden, true); assert.equal(root.querySelector("#request-move-out-panel").hidden, false);
  await root.querySelector("[data-refresh]").onclick(); assert.equal(h.gets.length, 4); assert.equal(h.posts.length, 0);
  assert.deepEqual(h.gets.slice(2), ["/v1/me/move-out-context", "/v1/requests"]);
  let prevented = 0; move.onkeydown({ key: "Home", preventDefault() { prevented++; } });
  assert.equal(renewal.focused, true); assert.equal(renewal.attributes["aria-selected"], "true");
  renewal.onkeydown({ key: "ArrowRight", preventDefault() { prevented++; } }); assert.equal(move.attributes["aria-selected"], "true");
  move.onkeydown({ key: "ArrowLeft", preventDefault() { prevented++; } }); assert.equal(prevented, 3); assert.equal(h.gets.length, 4);
});
test("KT09 submit failure preserves typed form content and selected package for retry", async (t) => {
  const h = harness(t, { post: async () => { throw Object.assign(Error("Mất mạng"), { status: 0 }); } }); await h.render();
  const root = h.root(), slot = root.querySelector("[data-form]"), form = slot.querySelector("[data-renewal]");
  const input = form.querySelector('[name="content"]'), packages = form.querySelector('[name="packageMonths"]');
  input.value = "Giữ nội dung đang nhập"; input.oninput(); packages.value = "12"; packages.onchange();
  await form.onsubmit({ preventDefault() {} });
  assert.equal(h.posts[0].body.packageMonths, 12); assert.equal(h.posts[0].body.content, input.value);
  assert.equal(input.value, "Giữ nội dung đang nhập"); assert.equal(packages.value, "12"); assert.equal(root.querySelector("[data-message]").textContent, "Mất mạng");
  assert.equal(slot.querySelector("[data-submit]").disabled, false);
});
test("KT09 network load errors expose retry and successful retry restores form", async (t) => {
  let fail = true;
  const h = harness(t, { get: async (url) => { if (fail) throw Error("Không kết nối được"); return { data: url.endsWith("renewal-context") ? { contracts: [fixture()] } : [] }; } });
  await h.render(); const slot = h.root().querySelector("[data-form]");
  assert.match(slot.innerHTML, /role="alert"/); assert.equal(slot.querySelector("[data-error]").textContent, "Không kết nối được");
  fail = false; await slot.querySelector("[data-retry]").onclick(); assert.match(slot.innerHTML, /data-renewal/); assert.equal(h.gets.length, 4);
});
test("KT09 refresh suppresses double click and announces loading", async (t) => {
  let resolve, held = false;
  const h = harness(t, { get: async (url) => {
    if (!url.endsWith("renewal-context")) return { data: [] };
    if (held) await new Promise((r) => { resolve = r; });
    return { data: { contracts: [fixture()] } };
  } });
  await h.render(); held = true; const refresh = h.root().querySelector("[data-refresh]");
  const loading = refresh.onclick(); await refresh.onclick(); assert.equal(h.gets.length, 4); assert.equal(refresh.disabled, true); assert.match(refresh.innerHTML, /Đang cập nhật/);
  resolve(); await loading; assert.equal(refresh.disabled, false); assert.match(refresh.innerHTML, /Cập nhật trạng thái/);
});
test("KT09 expired session does not overwrite the shared 401 flow", async (t) => {
  const h = harness(t, { post: async () => { h.events.get("isk19:session-expired")(); throw Object.assign(Error("Unauthorized"), { status: 401 }); } });
  await h.render(); const root = h.root(), form = root.querySelector("[data-form]").querySelector("[data-renewal]");
  form.querySelector('[name="content"]').value = "Đề nghị"; form.querySelector('[name="packageMonths"]').value = "6";
  await form.onsubmit({ preventDefault() {} }); assert.notEqual(root.querySelector("[data-message]").textContent, "Unauthorized"); assert.equal(h.posts.length, 1);
});
test("KT09 form suppresses duplicate posts and preserves renewal draft when visiting move-out", async (t) => {
  let release;
  const h = harness(t, { post: async () => new Promise((resolve) => { release = resolve; }) }); await h.render();
  const root = h.root(), slot = root.querySelector("[data-form]"), form = slot.querySelector("[data-renewal]");
  form.querySelector('[name="content"]').value = "Đề nghị giữ lại"; form.querySelector('[name="content"]').oninput();
  form.querySelector('[name="packageMonths"]').value = "6";
  const [renewal, move] = root.querySelectorAll('[role="tab"]'); await move.onclick(); renewal.onclick();
  assert.equal(form.querySelector('[name="content"]').value, "Đề nghị giữ lại"); assert.equal(h.gets.length, 4);
  const pending = form.onsubmit({ preventDefault() {} }); await form.onsubmit({ preventDefault() {} });
  assert.equal(h.posts.length, 1); assert.equal(slot.querySelector("[data-submit]").disabled, true);
  await move.onclick(); release({ data: {} }); await pending; assert.equal(h.gets.length, 4, "hidden renewal must not trigger a post-submit refresh");
});
test("KT09 ineligible form never posts even when submitted programmatically", async (t) => {
  const h = harness(t, { get: async (url) => ({ data: url.endsWith("renewal-context") ? { contracts: [fixture({ eligible: false, reasonCode: "CONTRACT_NOT_EXPIRING" })] } : [] }) });
  await h.render(); const slot = h.root().querySelector("[data-form]");
  await slot.querySelector("[data-renewal]").onsubmit({ preventDefault() {} });
  assert.equal(h.posts.length, 0); assert.equal(slot.querySelector("[data-submit]").disabled, true); assert.match(slot.innerHTML, /renewal-notice--blocked/);
});
