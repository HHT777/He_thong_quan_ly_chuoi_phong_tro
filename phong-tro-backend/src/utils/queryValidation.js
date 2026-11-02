function bad(message, code = "INVALID_QUERY_PARAMETER") {
  throw { status: 400, code, message };
}

function validateQuery(query, { strings = [], periods = [], positiveIntegers = [], dates = [], allowed = [] } = {}) {
  const accepted = new Set([...strings, ...periods, ...positiveIntegers, ...dates, ...allowed]);
  for (const [key, value] of Object.entries(query)) {
    if (!accepted.has(key)) bad(`Tham số ${key} không được hỗ trợ`);
    if (allowed.includes(key)) continue;
    if (typeof value !== "string" || !value.trim()) bad(`Tham số ${key} không hợp lệ`);
    if (positiveIntegers.includes(key) && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) bad(`Tham số ${key} phải là số nguyên dương`);
    if (periods.includes(key) && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) bad(`Kỳ ${key} không hợp lệ`);
    if (dates.includes(key)) {
      const date = new Date(`${value}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) bad(`Ngày ${key} không hợp lệ`);
    }
  }
  return query;
}

module.exports = { validateQuery };
