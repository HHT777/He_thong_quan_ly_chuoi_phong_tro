import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formMarkup, historyMarkup, needsException, moveOutPayload } from "../src/modules/tenant/tenant-move-out.model.mjs";
import { createMoveOutPanel } from "../src/modules/tenant/tenant-move-out.panel.mjs";
const context = { today: "2026-10-30", minimumNormalMoveOutDate: "2026-11-29", contracts: [{ contractId: "own", buildingName: "Căn A", roomName: "101", currentEndDate: "2027-03-31", eligible: true }] };
const draft = { contractId: "own", expectedMoveOutDate: "2026-11-28", content: "Request", earlyReturnReason: "Ngoại lệ" };
test("KT10 form uses server bounds, selected own contract, early reason and shared styled controls", () => {
  const html = formMarkup(context.contracts, draft, context);
  assert.match(html, /29\/11\/2026/); assert.match(html, /31\/03\/2027/); assert.match(html, /min="2026-10-30" max="2027-03-31"/);
  assert.match(html, /name="earlyReturnReason"[^>]*required/); assert.doesNotMatch(html, /theo dữ liệu server|\(server\)/); assert.doesNotMatch(html, /<select\b|thanh lý<\/button|type="number"/);
  assert.match(formMarkup([...context.contracts, { ...context.contracts[0], contractId: "second" }], draft, context), /select class="form-control" id="move-out-contract"/);
  assert.match(formMarkup([], draft, context), /Chưa có hợp đồng/);
  assert.equal(needsException("2026-11-29", context), false); assert.equal(needsException("2026-11-28", context), true);
});
test("KT10 pending conflict banners disable form without hiding contract information", () => {
  for (const reasonCode of ["CONTRACT_REQUEST_CONFLICT", "MOVE_OUT_ALREADY_PENDING_OR_APPROVED", "CONTRACT_EXPIRED"]) {
    const html = formMarkup([{ ...context.contracts[0], eligible: false, reasonCode }], draft, context);
    assert.match(html, /renewal-notice--blocked/); assert.match(html, /fieldset[^>]+disabled/); assert.match(html, /31\/03\/2027/);
    if (reasonCode === "CONTRACT_REQUEST_CONFLICT") assert.match(html, /gia hạn chờ xử lý hoặc đã duyệt/);
  }
});
test("KT10 history has pending approved rejected withdrawn dates reasons and no write actions", () => {
  assert.match(historyMarkup([]), /Chưa có yêu cầu trả phòng/);
  for (const [status, label] of [["CHO_XU_LY", "Chờ xử lý"], ["DA_PHE_DUYET", "Đã duyệt"], ["TU_CHOI", "Từ chối"], ["DA_RUT", "Đã rút duyệt"]]) {
    const html = historyMarkup([{ loai_yeu_cau: "TRA_PHONG", trang_thai: status, noi_dung: "<img src=x>", ly_do_xu_ly: "<script>reason</script>", moveOut: { requestedDate: "2026-11-28", approvedDate: "2026-11-29", earlyReturnReason: "<b>early</b>" } }]);
    assert.ok(html.includes(label)); assert.match(html, /28\/11\/2026/); assert.match(html, /29\/11\/2026/); assert.match(html, /&lt;script/); assert.match(html, /&lt;img/); assert.match(html, /&lt;b/); assert.doesNotMatch(html, /<script|<img|<b>|<button|<input/);
    if (status === "TU_CHOI") assert.match(html, /Lý do từ chối/);
  }
  const escaped = formMarkup([{ ...context.contracts[0], buildingName: '<img src="x">', roomName: '<script>x</script>' }], { ...draft, content: "</textarea><script>x</script>" }, context);
  assert.doesNotMatch(escaped, /<script|<img/); assert.match(escaped, /&lt;\/textarea&gt;/);
});
test("KT10 payload never invents minimum dates tenant identity or settlement actions", () => {
  assert.deepEqual(moveOutPayload(draft, context), { type: "TRA_PHONG", contractId: "own", expectedMoveOutDate: "2026-11-28", content: "Request", earlyReturnReason: "Ngoại lệ" });
  assert.throws(() => moveOutPayload({ ...draft, earlyReturnReason: " " }, context));
  const source = readFileSync(new URL("../src/modules/tenant/tenant-move-out.panel.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /setDate|setMonth|Date\.now|\/settle|deposit-refunds|tenantId|roomId/);
  const owner = readFileSync(new URL("../src/modules/residents-contracts/requests.tab.js", import.meta.url), "utf8");
  assert.match(owner, /request\.ly_do_xu_ly/); // Giao diện Chủ trọ gốc hiển thị ghi chú xử lý, không dùng presenter cũ của repo2.
});
class Element {
  constructor(html = "") { this._html = html; this.children = new Map(); this.value = ""; this.textContent = ""; this.attributes = {}; }
  set innerHTML(value) { this._html = value; this.children.clear(); }
  get innerHTML() { return this._html; }
  querySelector(key) {
    if (key === '[name="contractId"]' && !this._html.includes('name="contractId"')) return null;
    if (["[data-move-fields]", "[data-move-submit]"].includes(key) && !this._html.includes(key.slice(1, -1))) return null;
    if (!this.children.has(key)) this.children.set(key, new Element(this._html));
    return this.children.get(key);
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  focus() {}
}
function harness(api = {}) {
  const panel = new Element(), gets = [], posts = [];
  const controller = createMoveOutPanel(panel, {
    get: async (url) => { gets.push(url); return api.get ? api.get(url) : { data: url.endsWith("context") ? context : [] }; },
    post: async (url, body) => { posts.push({ url, body }); return api.post?.(url, body); },
  }, () => true);
  const form = () => panel.querySelector("[data-move-form-slot]").querySelector("[data-move-out]");
  return { panel, controller, gets, posts, form, fill() { const f = form(); for (const [key, value] of Object.entries(draft)) { const input = f.querySelector(`[name="${key}"]`); if (input) { input.value = value; input.oninput?.(); } } return f; } };
}
test("KT10 panel loads existing APIs and preserves entered content after submit network failure", async () => {
  const h = harness({ post: async () => { throw Error("Mất mạng"); } }); await h.controller.show();
  assert.deepEqual(h.gets, ["/v1/me/move-out-context", "/v1/requests"]);
  const form = h.fill(); await form.onsubmit({ preventDefault() {} });
  assert.equal(h.posts.length, 1); assert.equal(h.posts[0].body.expectedMoveOutDate, draft.expectedMoveOutDate);
  assert.equal(form.querySelector('[name="content"]').value, "Request"); assert.equal(h.panel.querySelector("[data-move-message]").textContent, "Mất mạng");
});
test("KT10 panel double submit is suppressed and reload cannot erase a form while sending", async () => {
  let release; const h = harness({ post: () => new Promise((r) => { release = r; }) }); await h.controller.show();
  const form = h.fill(), first = form.onsubmit({ preventDefault() {} });
  await form.onsubmit({ preventDefault() {} }); await h.panel.querySelector("[data-move-refresh]").onclick();
  assert.equal(h.posts.length, 1); assert.equal(h.gets.length, 2); release({ data: {} }); await first;
  assert.equal(h.gets.length, 4);
});
test("KT10 load error has retry and 401 remains under shared session handling", async () => {
  let failed = true;
  const h = harness({ get: async (url) => { if (failed) throw Error("Network error"); return { data: url.endsWith("context") ? context : [] }; } });
  await h.controller.show(); const slot = h.panel.querySelector("[data-move-form-slot]"); assert.match(slot.innerHTML, /role="alert"/);
  failed = false; await slot.querySelector("[data-retry]").onclick(); assert.match(slot.innerHTML, /data-move-out/);
  const expired = harness({ post: async () => { throw Object.assign(Error("Unauthorized"), { status: 401 }); } });
  await expired.controller.show(); await expired.fill().onsubmit({ preventDefault() {} });
  assert.notEqual(expired.panel.querySelector("[data-move-message]").textContent, "Unauthorized");
});
