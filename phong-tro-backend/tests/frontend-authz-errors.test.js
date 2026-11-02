const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../phong-tro-frontend");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const denied = { status: 404, ok: false, json: async () => ({ success: false, code: "RESOURCE_NOT_FOUND", message: "Không tìm thấy tài nguyên yêu cầu" }) };
const unrelated = { status: 404, ok: false, json: async () => ({ success: false, code: "OTHER_NOT_FOUND", message: "Lỗi 404 khác" }) };
const localStorage = { getItem: () => null, removeItem: () => {} };

test("authz frontend API client distinguishes opaque ownership 404 from other 404", async () => {
  const shared = read("src/core/api.js");
  const request = new Function("window", "localStorage", "fetch", "FormData",
    `${shared.slice(0, shared.indexOf("export const api ="))}\nreturn request;`)(
    {}, localStorage, async () => denied, FormData);
  await assert.rejects(request("/v1/move-outs/example/context"), (error) =>
    error.status === 404 && error.code === "RESOURCE_NOT_FOUND"
    && error.message === "Không tìm thấy hoặc bạn không có quyền với đối tượng này");
  const other = new Function("window", "localStorage", "fetch", "FormData",
    `${shared.slice(0, shared.indexOf("export const api ="))}\nreturn request;`)(
    {}, localStorage, async () => unrelated, FormData);
  await assert.rejects(other("/v1/other"), (error) => error.message === "Lỗi 404 khác");

});
