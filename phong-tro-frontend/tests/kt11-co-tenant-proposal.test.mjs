import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fields, newDraft, proposalPayload, formMarkup, historyMarkup } from "../src/modules/tenant/tenant-co-tenants.model.mjs";
const fake = () => ({ ...newDraft(), contractId: "own", name: "TEST PERSON", phone: "00000000001", identityNumber: "TESTDOC0001", birthDate: "1900-01-01", gender: "KHAC", permanentAddress: "TEST ONLY ADDRESS", relationship: "TEST", startDate: "2026-11-01" });
const data = { today: "2026-10-30", contracts: [{ contractId: "own", buildingName: "TEST BUILDING", roomName: "TEST ROOM", currentOccupants: 1, capacity: 2, availablePlaces: 1, eligible: true }], proposals: [], members: [] };
test("KT11 full form is styled scoped to server contract and shows server capacity", () => {
  const single = formMarkup(data, fake());
  for (const [field] of fields) assert.equal(single.includes('name="' + field + '"'), true);
  assert.equal(single.includes('class="contract-detail-grid co-tenant-summary"'), true);
  for (const label of ["Căn / Phòng", "Đang ở", "số người tối đa", "Chỗ còn lại"]) assert.equal(single.includes(`${label}</dt>`), true);
  assert.equal(single.includes("Đang ở và đã được duyệt"), false); assert.equal(single.includes("Sức chứa tối đa"), false);
  assert.equal(single.includes("(server)"), false); assert.equal(single.includes('name="roomId"'), false); assert.equal(single.includes('name="tenantId"'), false);
  assert.equal(single.includes('name="contractId"'), false);
  const multiple = formMarkup({ ...data, contracts: [...data.contracts, { ...data.contracts[0], contractId: "second" }] }, fake());
  assert.equal(multiple.includes('name="contractId"'), true);
  assert.equal(formMarkup({ contracts: [] }, fake()).includes("Chưa có hợp đồng hiện hành"), true);
  assert.equal(formMarkup({ ...data, contracts: [{ ...data.contracts[0], eligible: false }] }, fake()).includes("renewal-notice--blocked"), true);
});
test("KT11 review precedes submit and escapes all local inputs", () => {
  const review = formMarkup(data, { ...fake(), name: "<img src=x>", permanentAddress: "<script>TEST</script>" }, true);
  assert.equal(review.includes("data-confirm"), true); assert.equal(review.includes("data-edit"), true);
  assert.equal(/<img|<script/.test(review), false); assert.equal(review.includes("&lt;script&gt;"), true);
  assert.equal(review.includes("01/11/2026"), true);
  const payload = proposalPayload(fake()); assert.deepEqual(Object.keys(payload), ["contractId", ...fields.map(([k]) => k), "note"]);
  assert.throws(() => proposalPayload({ ...fake(), identityNumber: "" }));
});
test("KT11 history displays masked documents and status or rejection without mutation actions", () => {
  for (const [status, label] of [["CHO_XU_LY", "Chờ xử lý"], ["DA_PHE_DUYET", "Đã duyệt"], ["TU_CHOI", "Từ chối"]]) {
    const html = historyMarkup({ proposals: [{ status, name: "<img src=x>", identityNumber: "****0001", rejectionReason: "<script>TEST</script>", startDate: "2026-11-01" }], members: [] });
    assert.equal(html.includes(label), true); assert.equal(html.includes("****0001"), true); assert.equal(/<script|<img|<button/.test(html), false);
  }
  assert.equal(historyMarkup(data).includes("Chưa có đề xuất"), true);
});
const tabUrl = new URL("../src/modules/tenant/tenant-co-tenants.tab.js", import.meta.url);
const source = readFileSync(tabUrl, "utf8");
const executable = source.replace(/import "[^"\n]+\.css";/g, "").replace(/from "([^"]+)"/g, (_m, p) => `from ${JSON.stringify(new URL(p, tabUrl).href)}`);
const tab = (await import(`data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`)).default;
class Element {
  constructor(html = "") { this._html = html; this.children = new Map(); this.value = ""; this.textContent = ""; this.isConnected = true; this.attributes = {}; }
  set innerHTML(html) { this._html = html; this.children.clear(); }
  get innerHTML() { return this._html; }
  querySelector(key) {
    if (key === "fieldset" && !this._html.includes("fieldset")) return null;
    if (key === '[name="contractId"]' && !this._html.includes('name="contractId"')) return null;
    if (!this.children.has(key)) this.children.set(key, new Element(this._html));
    return this.children.get(key);
  }
  querySelectorAll(key) { return key === "button" ? [this.querySelector("[data-action]")] : []; }
  setAttribute(key, value) { this.attributes[key] = value; }
  focus() {}
}
function harness(t, handlers = {}) {
  const main = new Element(), posts = [], gets = [], events = new Map(), previous = globalThis.window;
  globalThis.window = { addEventListener: (k, fn) => events.set(k, fn), removeEventListener: (k) => events.delete(k) }; t.after(() => { globalThis.window = previous; });
  const api = { get: async (url) => { gets.push(url); return handlers.get ? handlers.get(url) : { data }; }, post: async (url, body) => { posts.push({ url, body }); return handlers.post?.(url, body); } };
  const root = () => main.querySelector("[data-content]"), slot = () => root().querySelector("[data-form]");
  return { render: () => tab.render({ main, api }), posts, gets, events, root, slot, fill() { const form = slot().querySelector("[data-proposal]"); for (const [key, value] of Object.entries(fake())) if (key !== "contractId") { const input = form.querySelector(`[name="${key}"]`); input.value = value; input.oninput?.(); } return form; } };
}
test("KT11 review makes no POST, edit preserves draft, confirm posts only once and retry keeps memory state", async (t) => {
  let release; const h = harness(t, { post: () => new Promise((_, reject) => { release = reject; }) }); await h.render();
  const form = h.fill(); form.onsubmit({ preventDefault() {} }); assert.equal(h.posts.length, 0);
  assert.equal(h.slot().innerHTML.includes("data-confirm"), true);
  const first = h.slot().querySelector("[data-confirm]").onclick(); await h.slot().querySelector("[data-confirm]").onclick(); assert.equal(h.posts.length, 1);
  release(Error("TEST NETWORK FAILURE")); await first; assert.equal(h.root().querySelector("[data-message]").textContent === "TEST NETWORK FAILURE", true);
  h.slot().querySelector("[data-edit]").onclick(); assert.equal(h.slot().innerHTML.includes("TESTDOC0001"), true);
  assert.equal(h.gets.length, 1);
});
test("KT11 load error retries and 401 stays under shared session behavior", async (t) => {
  let fail = true; const h = harness(t, { get: async () => { if (fail) throw Error("TEST OFFLINE"); return { data }; } }); await h.render();
  assert.equal(h.slot().innerHTML.includes("data-retry"), true); fail = false; await h.slot().querySelector("[data-retry]").onclick(); assert.equal(h.slot().innerHTML.includes("data-proposal"), true);
  const expired = harness(t, { post: async () => { throw Object.assign(Error("TEST UNAUTHORIZED"), { status: 401 }); } }); await expired.render(); expired.fill().onsubmit({ preventDefault() {} }); await expired.slot().querySelector("[data-confirm]").onclick();
  assert.equal(expired.root().querySelector("[data-message]").textContent === "TEST UNAUTHORIZED", false);
});
test("KT11 role APIs and storage policy preserve owner decision and water service", () => {
  assert.deepEqual(tab.roles, ["KHACH_THUE"]); assert.equal(tab.route, "/tenant/co-tenants");
  assert.equal(/localStorage|sessionStorage|console\.|\/settle|accounts|setMonth/.test(source), false);
  assert.equal(source.includes("/v1/me/co-tenant-context"), true); assert.equal(source.includes("/v1/co-tenants"), true);
  const owner = readFileSync(new URL("../src/modules/residents-contracts/co-tenants.tab.js", import.meta.url), "utf8");
  assert.equal(owner.includes("data-detail"), true); assert.equal(owner.includes("detail.startDate"), true); assert.equal(owner.includes('status: "DA_PHE_DUYET"'), true);
});
