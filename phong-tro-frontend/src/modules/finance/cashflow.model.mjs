export function expensePayload(raw, categories) {
  const amount = Number(raw.so_tien);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Số tiền phải là số nguyên dương.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.ngay_phat_sinh) || Number.isNaN(Date.parse(raw.ngay_phat_sinh))) throw new Error("Ngày phát sinh không hợp lệ.");
  if (!categories.includes(raw.loai_khoan_chi)) throw new Error("Loại khoản chi không hợp lệ.");
  if (!["CAN_TRO", "TOAN_CHUOI"].includes(raw.pham_vi)) throw new Error("Phạm vi khoản chi không hợp lệ.");
  if (raw.pham_vi === "CAN_TRO" && !raw.ma_can) throw new Error("Cần chọn căn trọ.");
  return { loai_khoan_chi: raw.loai_khoan_chi, so_tien: amount, ngay_phat_sinh: raw.ngay_phat_sinh,
    pham_vi: raw.pham_vi, ma_can: raw.pham_vi === "CAN_TRO" ? raw.ma_can : null, ghi_chu: String(raw.ghi_chu || "").trim() };
}

export function filterExpenses(rows, { buildingId = "", fromDate = "", toDate = "" } = {}) {
  return rows.filter((row) => (!buildingId || row.ma_can === buildingId)
    && (!fromDate || String(row.ngay_phat_sinh).slice(0, 10) >= fromDate)
    && (!toDate || String(row.ngay_phat_sinh).slice(0, 10) <= toDate));
}
