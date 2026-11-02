import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateImage, contextMarkup, captureMarkup, loadErrorMarkup, imagePolicyLabel, previewMarkup, openImagePreview, unavailable } from "../src/modules/tenant/tenant-meter.model.mjs";
test("KT-07 context exposes one server period or empty state, escapes room names and invents no deadline", () => {
  const html = contextMarkup({ room: { code: '<img src=x onerror="x">', buildingName: "A" }, submissionWindowOpen: true, periodLabel: "2026-08 (kỳ gửi muộn)", previousReading: { value: 120 } });
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img|type="number"|deadline/); assert.match(html, /kỳ gửi muộn/);
  assert.match(contextMarkup({ room: {}, submissionWindowOpen: false }), /Chưa có kỳ nào cần gửi/);
});
test("KT-07 preview never offers manual fallback for unavailable OCR or a below-previous reading", () => {
  assert.ok(previewMarkup({ ocrStatus: "MANUAL_REQUIRED" }).includes(unavailable));
  assert.doesNotMatch(previewMarkup({ ocrStatus: "MANUAL_REQUIRED" }), /<input|nhập tay/);
  assert.match(previewMarkup({ ocrStatus: "RECOGNIZED", ocrValue: '<script>x</script>', canSubmit: false }), /&lt;script/);
  assert.match(previewMarkup({ ocrStatus: "RECOGNIZED", ocrValue: "100", canSubmit: false }), /nhỏ hơn kỳ trước/);
});
test("KT-07 image validation follows server MIME and byte policy", () => {
  const policy = { mimeTypes: ["image/jpeg", "image/png"], maxBytes: 1024 };
  assert.doesNotThrow(() => validateImage({ type: "image/png", size: 1024 }, policy));
  for (const file of [null, { type: "image/gif", size: 10 }, { type: "image/png", size: 1025 }, { type: "image/png", size: 0 }]) assert.throws(() => validateImage(file, policy));
});
test("KT-07 tab submits only image token and server period, uses shared API and guards concurrent clicks", () => {
  const source = readFileSync(new URL("../src/modules/tenant/tenant-meter.tab.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /readingValue|type="number"|name="period"|renderFormPage|\bfetch\(/);
  assert.match(source, /postForm\("\/v1\/me\/meter-reading-ocr-previews"/);
  assert.match(source, /uploadToken: preview.uploadToken/); assert.match(source, /if \(busy \|\| !preview\?\.canSubmit\) return/);
  assert.match(source, /error.status !== 401/); assert.match(source, /URL.revokeObjectURL/);
});

const tabUrl = new URL("../src/modules/tenant/tenant-meter.tab.js", import.meta.url);
const tabSource = readFileSync(tabUrl, "utf8");
const executable = tabSource.replace(/import "[^"\n]+\.css";/g, "")
  .replace(/from "([^"]+)"/g, (_match, path) => `from ${JSON.stringify(new URL(path, tabUrl).href)}`);
const tab = (await import(`data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`)).default;
const policy = { mimeTypes: ["image/jpeg", "image/png"], maxBytes: 10485760 };
const initial = () => ({ room: { code: "101", buildingName: "Căn A" }, period: "2026-10", submissionWindowOpen: true, previousReading: { value: 0 }, imagePolicy: policy });
const recognized = () => ({ data: { ocrStatus: "RECOGNIZED", ocrValue: "150", canSubmit: true, uploadToken: "signed-preview" } });
class Element {
  constructor() { this.innerHTML = ""; this.textContent = ""; this.isConnected = true; this.disabled = false; this.hidden = false; this.style = {}; this.children = new Map(); this.files = []; }
  querySelector(selector) { if (!this.children.has(selector)) this.children.set(selector, new Element()); return this.children.get(selector); }
  setAttribute(key, value) { this[key] = value; }
  removeAttribute(key) { delete this[key]; }
  click() { if (!this.disabled) return this.onclick?.(); }
}
function harness(t, api = {}) {
  const events = new Map(), main = new Element(), root = main.querySelector("[data-content]");
  const workspace = root.querySelector("[data-workspace]"); const revoked = []; let sequence = 0;
  t.mock.method(URL, "createObjectURL", () => `blob:meter-${++sequence}`);
  t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
  const original = globalThis.window;
  globalThis.window = { addEventListener: (event, fn) => events.set(event, fn), removeEventListener: (event) => events.delete(event) };
  t.after(() => { globalThis.window = original; });
  const calls = { preview: [], submit: [] };
  const transport = {
    get: async () => ({ data: initial() }),
    postForm: async (...args) => { calls.preview.push(args); return recognized(); },
    post: async (...args) => { calls.submit.push(args); return { data: { status: "CHO_XAC_NHAN" } }; }, ...api,
  };
  return { main, root, workspace, revoked, events, calls, api: transport,
    element: (key) => workspace.querySelector(`[data-${key}]`),
    reload: () => root.querySelector("[data-reload]"), render: () => tab.render({ main, api: transport }),
    choose(name = "meter.png") { const input = workspace.querySelector("[data-image]"); input.files = [new File(["image"], name, { type: "image/png" })]; input.onchange(); },
  };
}

test("KT-07 UI uses owner cards and responsive upload layout, policy from server and accessible read-only steps", () => {
  const html = captureMarkup(initial());
  assert.match(tabSource, /import "\.\.\/operations\/meter-readings.css"/);
  for (const value of ["meter-capture", "meter-capture__body", "meter-upload", "meter-image", "btn--primary", "btn--secondary", 'for="tenant-meter-image"', 'aria-live="polite"', "1. Chọn ảnh", "2. Xem trước", "3. Kết quả", "4. Gửi", "Gửi chỉ số từ ảnh"]) assert.ok(html.includes(value), value);
  assert.match(html, /JPEG \/ PNG · Tối đa 10 MB/);
  assert.match(imagePolicyLabel({ mimeTypes: ["image/png"], maxBytes: 1572864 }), /PNG · Tối đa 1,5 MB/);
  assert.doesNotMatch(html + tabSource, /type="number"|type="text"|Gửi chi số|localStorage|sessionStorage/);
  assert.match(html, /data-image hidden/);
  const css = readFileSync(new URL("../src/modules/operations/meter-readings.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 640px\)/); assert.match(css, /object-fit: contain/);
});

test("KT-07 UI distinguishes unsent pending confirmed locked and no-period states without guessing a new period", () => {
  assert.match(contextMarkup(initial()), /Chưa gửi/);
  assert.match(contextMarkup({ ...initial(), current: { status: "CHO_XAC_NHAN" } }), /Chờ xác nhận/);
  const confirmed = { ...initial(), current: { status: "DA_XAC_NHAN" } };
  assert.match(contextMarkup(confirmed), /Đã xác nhận/); assert.equal(captureMarkup(confirmed), "");
  const closed = { ...initial(), period: null, submissionWindowOpen: false };
  assert.match(contextMarkup(closed), /Chưa có kỳ nào cần gửi chỉ số/); assert.equal(captureMarkup(closed), "");
  assert.match(contextMarkup(initial()), /<dd>0<\/dd>/);
  assert.match(loadErrorMarkup({ status: 404 }), /Chưa có hợp đồng thuê phòng khả dụng/);
  assert.doesNotMatch(loadErrorMarkup({ status: 500, message: '<img onerror="bad">' }), /<img/);
  assert.match(previewMarkup(recognized().data), /<output>150<\/output>/);
});

test("KT-07 UI previews immediately, rejects invalid images and revokes URLs on replacement refresh route and 401", async (t) => {
  const h = harness(t); await h.render();
  h.choose('<img src=x>.png'); assert.equal(h.element("photo").src, "blob:meter-1"); assert.equal(h.element("photo").hidden, false);
  assert.equal(h.element("file-name").title, '<img src=x>.png'); assert.equal(h.element("enlarge").disabled, false);
  assert.equal(h.element("file-name").textContent, '<img src=x>.png'); assert.match(h.element("message").textContent, /Đã chọn ảnh/);
  h.choose(); assert.deepEqual(h.revoked, ["blob:meter-1"]);
  const input = h.element("image"); input.files = [new File(["bad"], "bad.gif", { type: "image/gif" })]; input.onchange();
  assert.equal(h.element("photo").hidden, true); assert.equal(h.element("preview").disabled, true); assert.match(h.element("message").textContent, /JPEG hoặc PNG/);
  h.choose(); await h.reload().click(); assert.ok(h.revoked.includes("blob:meter-3"));
  h.choose(); h.events.get("hashchange")(); assert.ok(h.revoked.includes("blob:meter-4")); assert.equal(h.events.size, 0);
  await h.render(); h.choose(); h.events.get("isk19:session-expired")(); assert.ok(h.revoked.includes("blob:meter-5")); assert.equal(h.events.size, 0);
});

test("KT-07 preview fills both frame dimensions with contain, ellipsizes filename and stays below controls on mobile", () => {
  const css = readFileSync(new URL("../src/modules/tenant/tenant-meter.css", import.meta.url), "utf8");
  const photo = css.match(/\.tenant-meter \.tenant-meter-preview img\s*\{([^}]+)\}/)[1];
  for (const rule of ["width: 100%", "height: 100%", "max-height: none", "object-fit: contain", "object-position: center"]) assert.ok(photo.includes(rule), rule);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
  assert.match(css, /background: var\(--bg-subtle\)/); assert.match(css, /border-radius: var\(--radius-md\)/);
  assert.match(css, /text-overflow: ellipsis/); assert.match(css, /white-space: nowrap/); assert.match(css, /margin: var\(--space-3\)/);
  assert.match(css, /@media \(max-width: 640px\)/); assert.match(css, /height: clamp\(280px, 60vh, 480px\)/);
  const html = captureMarkup(initial()); assert.ok(html.indexOf("meter-capture__controls") < html.indexOf("tenant-meter-preview"));
  assert.doesNotMatch(html, /type="number"/); assert.match(html, /data-enlarge.*Phóng to ảnh công tơ/);
});

test("KT-07 enlarged preview reuses modal, closes by button or Escape, traps focus and is removed before URL revoke", async (t) => {
  const original = globalThis.document; const handlers = new Map(); const overlays = [];
  class ModalElement extends Element {
    addEventListener(event, handler) { this[event] = handler; }
    focus() { document.activeElement = this; }
    remove() { this.removed = true; }
    querySelector(selector) { if (!this.children.has(selector)) this.children.set(selector, new ModalElement()); return this.children.get(selector); }
  }
  globalThis.document = { createElement: () => new ModalElement(), addEventListener: (event, fn) => handlers.set(event, fn), removeEventListener: (event) => handlers.delete(event), body: { appendChild: (node) => overlays.push(node) } };
  t.after(() => { globalThis.document = original; });
  const trigger = new ModalElement();
  openImagePreview("blob:example", trigger); let modal = overlays.at(-1), close = modal.querySelector("[data-close]");
  assert.match(modal.className, /modal-overlay/); assert.match(modal.innerHTML, /aria-modal="true"/); assert.equal(modal.querySelector("[data-enlarged-photo]").src, "blob:example");
  assert.equal(document.activeElement, close); let prevented = false;
  handlers.get("keydown")({ key: "Tab", preventDefault() { prevented = true; } }); assert.equal(prevented, true);
  handlers.get("keydown")({ key: "Escape", preventDefault() {} }); assert.equal(modal.removed, true); assert.equal(document.activeElement, trigger); assert.equal(handlers.size, 0);
  openImagePreview("blob:example2", trigger); modal = overlays.at(-1);
  modal.click({ target: { closest: () => true } }); assert.equal(modal.removed, true); assert.equal(document.activeElement, trigger);
  const h = harness(t); await h.render(); h.choose(); h.element("enlarge").focus = () => {};
  h.element("enlarge").click(); const active = overlays.at(-1); assert.equal(active.removed, undefined);
  h.choose(); assert.equal(active.removed, true); assert.deepEqual(h.revoked, ["blob:meter-1"]);
  h.element("enlarge").click(); h.events.get("isk19:session-expired")(); assert.equal(overlays.at(-1).removed, true); assert.equal(handlers.size, 0);
});

test("KT-07 UI recognizes and submits signed preview once, shows pending badge and permits choosing a replacement", async (t) => {
  const h = harness(t); await h.render(); h.choose();
  let release; h.api.postForm = async (...args) => { h.calls.preview.push(args); return new Promise((resolve) => { release = resolve; }); };
  const pending = h.element("preview").click(); await h.element("preview").click();
  assert.equal(h.calls.preview.length, 1); assert.equal(h.element("choose").disabled, true); assert.equal(h.element("preview")["aria-busy"], "true");
  assert.match(h.element("preview-result").textContent, /Đang nhận dạng/); release(recognized()); await pending;
  assert.match(h.element("preview-result").innerHTML, /Nhận dạng thành công/); assert.equal(h.element("submit").disabled, false);
  let finish; h.api.post = async (...args) => { h.calls.submit.push(args); return new Promise((resolve) => { finish = resolve; }); };
  const sending = h.element("submit").click(); await h.element("submit").click();
  assert.equal(h.calls.submit.length, 1); assert.equal(h.element("submit")["aria-busy"], "true");
  assert.deepEqual(h.calls.submit[0][1], { period: "2026-10", uploadToken: "signed-preview" });
  finish({ data: { status: "CHO_XAC_NHAN" } }); await sending;
  assert.match(h.element("context").innerHTML, /Chờ xác nhận/); assert.match(h.element("message").textContent, /Đã gửi chỉ số/);
  assert.equal(h.element("submit").disabled, true); assert.equal(h.element("choose").disabled, false); assert.deepEqual(h.revoked, ["blob:meter-1"]);
  h.choose(); assert.equal(h.element("preview").disabled, false);
});

test("KT-07 UI unavailable OCR and network retry never enable manual input or leave stale success enabled", async (t) => {
  const h = harness(t); await h.render(); h.choose();
  h.api.postForm = async () => ({ data: { ocrStatus: "MANUAL_REQUIRED", canSubmit: false, uploadToken: null } });
  await h.element("preview").click(); assert.equal(h.element("message").textContent, unavailable); assert.equal(h.element("submit").disabled, true);
  h.api.postForm = async () => { throw new Error('<img onerror="x"> network'); };
  await h.element("preview").click(); assert.match(h.element("message").textContent, /network/); assert.equal(h.element("preview").disabled, false);
  h.api.postForm = async () => recognized(); await h.element("preview").click(); assert.equal(h.element("submit").disabled, false);
  h.api.post = async () => { throw new Error("Mất mạng khi gửi"); }; await h.element("submit").click();
  assert.match(h.element("message").textContent, /Mất mạng/); assert.equal(h.element("submit").disabled, false);
});

test("KT-07 UI refresh has busy state and retry; 401 and late OCR never repaint a disposed screen", async (t) => {
  const h = harness(t); let release;
  h.api.get = () => new Promise((resolve) => { release = resolve; }); const loading = h.render();
  assert.equal(h.reload().disabled, true); assert.equal(h.reload()["aria-busy"], "true"); assert.match(h.workspace.innerHTML, /Đang tải/);
  release({ data: initial() }); await loading; assert.equal(h.reload().disabled, false);
  h.api.get = async () => { throw new Error("Không có mạng"); }; await h.reload().click(); assert.match(h.workspace.innerHTML, /Không có mạng|Thử lại/);
  h.api.get = async () => ({ data: initial() }); await h.element("retry").click(); h.choose();
  h.api.postForm = () => new Promise((resolve) => { release = resolve; }); const request = h.element("preview").click(); const before = h.element("preview-result").innerHTML;
  h.events.get("isk19:session-expired")(); release(recognized()); await request;
  assert.equal(h.element("preview-result").innerHTML, before); assert.equal(h.events.size, 0);
});
