const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/finance/billPresentation.js")).href;

test("FR-144 draft, partial and paid bills expose only valid actions", async () => {
  const { billStatus, billPrimaryAction, billStatusTone, billMenuActions, paymentStatusLabels } = await import(moduleUrl);
  const draft = { da_gui: false, tong_da_thanh_toan: 0, so_tien_con_no: 3000000, trang_thai: "CHUA_THANH_TOAN" };
  assert.equal(billStatus(draft), "Nháp");
  assert.equal(billPrimaryAction(draft), "send");
  assert.equal(billStatusTone(draft), "draft");
  assert.deepEqual(billMenuActions(draft), ["detail", "adjust"]);

  const partial = { da_gui: true, tong_da_thanh_toan: 1000000, so_tien_con_no: 2000000, trang_thai: "THANH_TOAN_MOT_PHAN" };
  assert.equal(billStatus(partial), "Thanh toán một phần");
  assert.equal(billPrimaryAction(partial), "pay");
  assert.equal(billStatusTone(partial), "partial");
  assert.deepEqual(billMenuActions(partial), ["detail", "adjust", "resend"]);

  const paid = { da_gui: true, tong_da_thanh_toan: 3000000, so_tien_con_no: 0, trang_thai: "DA_THANH_TOAN" };
  assert.equal(billStatus(paid), "Đã thanh toán");
  assert.equal(billPrimaryAction(paid), null);
  assert.equal(billStatusTone(paid), "paid");
  assert.equal(billStatus({ ...paid, trang_thai: "FUTURE_STATE" }), "Trạng thái chưa xác định");
  assert.equal(paymentStatusLabels.CHO_XAC_NHAN, "Chờ xác nhận");
});
