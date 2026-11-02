function parsePeriod(period) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(period || ""));
  if (!match) throw Object.assign(new Error("Kỳ phải có định dạng YYYY-MM"), { status: 422, code: "INVALID_BILLING_PERIOD" });
  return { year: Number(match[1]), month: Number(match[2]), key: match[0] };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function firstPeriodRatio(contractStartDate, period) {
  const { year, month } = typeof period === "string" ? parsePeriod(period) : period;
  const start = String(contractStartDate || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  if (!match) throw Object.assign(new Error("Ngày bắt đầu hợp đồng không hợp lệ"), { status: 422, code: "INVALID_CONTRACT_START_DATE" });
  const startYear = Number(match[1]); const startMonth = Number(match[2]); const startDay = Number(match[3]);
  if (startYear !== year || startMonth !== month) return 1;
  const days = daysInMonth(year, month);
  return (days - startDay + 1) / days;
}

function prorateMonthlyAmount(amount, ratio) {
  return Math.round(Number(amount) * Number(ratio));
}

function elapsedMonthRatio(dateValue) {
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00Z`);
  const year = date.getUTCFullYear(); const month = date.getUTCMonth() + 1; const day = date.getUTCDate();
  const days = daysInMonth(year, month);
  return { year, month, day, days, ratio: day / days };
}

module.exports = { parsePeriod, daysInMonth, firstPeriodRatio, prorateMonthlyAmount, elapsedMonthRatio };
