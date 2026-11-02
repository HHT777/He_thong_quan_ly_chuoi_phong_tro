const { ALLOWED_BILL_LINE_TYPES, NEGATIVE_BILL_LINE_TYPES } = require("../domain/billing.constants");

const roundedMoney = (value) => Math.round(Number(value) * 100) / 100;

function validateBillLine(line) {
  const type = line?.loai_khoan ?? line?.type;
  const amount = roundedMoney(line?.so_tien ?? line?.amount);
  if (!ALLOWED_BILL_LINE_TYPES.has(type)) {
    throw Object.assign(new Error("Loại dòng chi tiết không thuộc miền dữ liệu"), { status: 409, code: "INVALID_BILL_LINE_TYPE", details: { type } });
  }
  const shouldBeNegative = NEGATIVE_BILL_LINE_TYPES.has(type);
  if (!Number.isFinite(amount) || amount === 0 || (shouldBeNegative ? amount >= 0 : amount <= 0)) {
    throw Object.assign(new Error("Dấu số tiền không phù hợp loại dòng chi tiết"), { status: 422, code: "INVALID_BILL_LINE_SIGN", details: { type, amount } });
  }
  return amount;
}

function sumSignedLineAmounts(lines) {
  return roundedMoney((lines || []).reduce((sum, line) => sum + validateBillLine(line), 0));
}

function assertBillDetailTotal(lines, expectedTotal) {
  const detailTotal = sumSignedLineAmounts(lines);
  const billTotal = roundedMoney(expectedTotal);
  if (!Number.isFinite(billTotal) || detailTotal !== billTotal) {
    throw Object.assign(new Error("Tổng đại số chi tiết không khớp tổng phải trả"), {
      status: 409, code: "BILL_DETAIL_TOTAL_MISMATCH", details: { detailTotal, billTotal },
    });
  }
  return detailTotal;
}

module.exports = { roundedMoney, validateBillLine, sumSignedLineAmounts, assertBillDetailTotal };
