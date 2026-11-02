import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readOnlyTab } from "../src/shared/components/tab-factory.js";
import { currentFirst, loadContracts, overviewMarkup, roomMembersMarkup, detailMarkup, historyMarkup, violationsMarkup } from "../src/modules/tenant/rental-contract.model.mjs";
import { defaultContractTerms } from "../src/modules/residents-contracts/contract-terms.js";
import { readableContractTerms } from "../src/modules/residents-contracts/contract-terms.js";

const own = {
  ma_hop_dong: "own-1", trang_thai: "DANG_HIEU_LUC", ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-10-01",
  gia_thue: 2400000, khachThue: { ho_ten: "Người đứng tên" }, phongTro: { ma_phong: "room-1", gia_thue: 9000000, so_phong: "A1", canTro: { ten_can: "Căn A" } },
};

test("KT-03 loads every JWT-scoped contract page without sending tenant ID and puts active contracts first", async () => {
  const calls = [];
  const rows = await loadContracts({ get: async (path) => {
    calls.push(path);
    return calls.length === 1
      ? { data: [{ ...own, ma_hop_dong: "old", trang_thai: "DA_THANH_LY" }], pagination: { hasNext: true, totalPages: 2 } }
      : { data: [own], pagination: { hasNext: false, totalPages: 2 } };
  } });
  assert.deepEqual(calls, ["/hop-dong?limit=100&page=1", "/hop-dong?limit=100&page=2"]);
  assert.deepEqual(rows.map((row) => row.ma_hop_dong), ["own-1", "old"]);
  assert.equal(currentFirst({ ...own, ngay_ket_thuc: "2020-01-01" }, { ...own, trang_thai: "DA_THANH_LY" }) < 0, true);
});

test("KT-03 empty state and overview show server status and contract rent, never listed room rent", () => {
  assert.match(overviewMarkup([]), /Chưa có hợp đồng thuê phòng/);
  const markup = overviewMarkup([{ ...own, ngay_ket_thuc: "2020-01-01" }]);
  assert.match(markup, /Hợp đồng hiện hành/);
  assert.match(markup, /Đang hiệu lực/);
  assert.match(markup, /2\.400\.000/);
  assert.doesNotMatch(markup, /9\.000\.000/);
  assert.match(markup, /Hợp đồng trước đây/);
});

test("KT-03 member button opens only for current contracts and room details stay scoped", () => {
  const markup = overviewMarkup([own, { ...own, ma_hop_dong: "old", trang_thai: "DA_THANH_LY" }]);
  assert.equal((markup.match(/data-room-members=/g) || []).length, 1);
  assert.match(markup, /Xem thành viên trong phòng/);
  assert.doesNotMatch(markup, /tenant-room-members__list/);
  const data = { contracts: [{ contractId: "own-1", roomId: "room-1", currentOccupants: 2 }], roomMembers: [
    { roomId: "room-1", contractId: "old", ho_ten: "An <script>", trang_thai_cu_tru: "DANG_O", ngay_vao: "2026-11-01", so_dien_thoai: "***1234", relationship: "Bạn" },
    { roomId: "room-1", ho_ten: "Đã rời", trang_thai_cu_tru: "DA_ROI" },
    { roomId: "room-1", ho_ten: "Người đứng tên", trang_thai_cu_tru: "DANG_O", isPrincipal: true },
    { roomId: "room-2", ho_ten: "Phòng khác", trang_thai_cu_tru: "DANG_O" },
  ] };
  const people = roomMembersMarkup(data, own);
  assert.match(people, /Khách đứng tên hợp đồng/);
  assert.match(people, /An &lt;script&gt;/);
  assert.equal((people.match(/Người đứng tên/g) || []).length, 1);
  assert.match(people, /Số điện thoại/);
  assert.match(people, /\*\*\*1234/);
  assert.doesNotMatch(people, /Đã rời|Phòng khác|<script>/);
  assert.doesNotMatch(people, /Danh sách mới có/);
  assert.match(roomMembersMarkup({ ...data, contracts: [{ ...data.contracts[0], currentOccupants: 3 }], roomMembers: undefined }, own), /1\/3 người đang ở/);
  assert.doesNotMatch(roomMembersMarkup({ ...data, contracts: [] }, own), /An &lt;script&gt;/);
});

test("KT-03 detail handles nulls and escapes room, terms, history and violation text", () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const detail = detailMarkup({ ...own, khachThue: { ho_ten: hostile }, phongTro: { so_phong: hostile, gia_thue: 9000000 }, dieu_khoan: hostile });
  assert.doesNotMatch(detail, /<img/);
  assert.match(detail, /&lt;img/);
  assert.doesNotMatch(detail, /9\.000\.000/);
  assert.match(detail, /2\.400\.000/);
  assert.match(detail, /Khách thuê<\/dt><dd>&lt;img/);
  assert.match(detail, /Điều khoản bổ sung riêng<\/dt><dd>&lt;img/);
  assert.match(detail, /Đơn giá điện<\/dt><dd>—/);
  assert.equal((detail.match(/<li>/g) || []).length, defaultContractTerms.length);
  for (const term of defaultContractTerms) assert.match(detail, new RegExp(term.title));

  const history = historyMarkup([{ type: "CHANGE", occurredAt: "2026-10-02", data: {
    truoc_json: { gia_thue: 2400000 }, sau_json: { action: "UPDATED", contract: { gia_thue: 2700000 } }, ly_do: hostile,
  } }, { type: "RENEWAL", occurredAt: "2026-10-03", data: { ngay_ket_thuc_cu: "2027-10-01", ngay_ket_thuc_moi: "2028-04-01", so_thang: 6 } },
  { type: "ROOM_TRANSFER", occurredAt: "2026-10-04", data: { ngay_chuyen: "2026-10-04", gia_thue_cu: 2400000, gia_thue_moi: 2700000 } }]);
  assert.match(history, /2\.400\.000.*2\.700\.000/);
  assert.match(history, /Gia hạn hợp đồng/);
  assert.match(history, /Chuyển phòng/);
  assert.doesNotMatch(history, /<img/);

  const violations = violationsMarkup([{ noi_dung: hostile, dieu_khoan_lien_quan: hostile, ngay_ghi_nhan: "2026-10-05", muc_phat: null }]);
  assert.doesNotMatch(violations, /<img/);
  assert.match(violations, /&lt;img/);
  assert.doesNotMatch(violations, /Mức phạt ghi nhận/);
  assert.match(violationsMarkup([]), /Không có vi phạm/);
});

test("KT-03 hides a trailing seed marker but preserves readable contract clauses", () => {
  const terms = "Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng";
  assert.equal(readableContractTerms(`${terms} | SEED_LIST_2026`), terms);
  assert.equal(readableContractTerms("Điện | nước theo thỏa thuận"), "Điện | nước theo thỏa thuận");
  const detail = detailMarkup({ ...own, dieu_khoan: `${terms} | SEED_LIST_2026` });
  assert.match(detail, /Thu nước theo người/);
  assert.doesNotMatch(detail, /SEED_LIST_2026/);
});

test("KT-03 read-only tab has loading, safe error and retry without write controls", async () => {
  let retry;
  let attempts = 0;
  const errorNode = { textContent: "" };
  const content = {
    isConnected: true, innerHTML: "",
    querySelector: (selector) => selector === "[data-read-error]" ? errorNode : { addEventListener: (_type, handler) => { retry = handler; } },
  };
  const main = { innerHTML: "", querySelector: () => content };
  const tab = readOnlyTab({ id: "test", roles: ["KHACH_THUE"] }, {
    title: "Phòng thuê", load: async () => { attempts += 1; if (attempts === 1) throw new Error("<script>lỗi</script>"); return [own]; },
    view: overviewMarkup,
  });
  await tab.render({ main, api: {} });
  assert.match(content.innerHTML, /data-read-retry/);
  assert.equal(errorNode.textContent, "<script>lỗi</script>");
  assert.equal(typeof retry, "function");
  await retry();
  assert.match(content.innerHTML, /Xem chi tiết/);
  assert.doesNotMatch(content.innerHTML, /data-create|data-submit/);
});

test("KT-03 tenant tab uses only read endpoints and server-owned status", () => {
  const source = readFileSync(new URL("../src/modules/tenant/rental-info.tab.js", import.meta.url), "utf8");
  assert.match(source, /\/hop-dong\/\$\{id\}/);
  assert.match(source, /\/hop-dong\/\$\{id\}\/history/);
  assert.match(source, /\/v1\/contracts\/\$\{id\}\/violations/);
  assert.match(source, /isk19:session-expired/);
  assert.doesNotMatch(source, /\/hop-dong\/expiring|\.post\(|\.patch\(|\.put\(|\.del\(/);
});
