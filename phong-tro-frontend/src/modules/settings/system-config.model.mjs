export function validateSetting(row, raw) {
  if (row.type === "timezone") {
    if (!row.domain.options.includes(raw)) throw new Error("Múi giờ không hợp lệ.");
    return raw;
  }
  const text = String(raw).trim();
  if (!/^(0|[1-9]\d*)$/.test(text)) throw new Error("Vui lòng nhập số nguyên hợp lệ.");
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < row.domain.min || value > row.domain.max) {
    throw new Error(`Giá trị phải từ ${row.domain.min} đến ${row.domain.max}.`);
  }
  return value;
}

export function groupSettings(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.group)) grouped.set(row.group, []);
    grouped.get(row.group).push(row);
  }
  return grouped;
}
