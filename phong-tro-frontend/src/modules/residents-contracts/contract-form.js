export const DEPOSIT_WARNING_MULTIPLIER = 3;
export const SHORT_CONTRACT_DAYS = 30;
export const CONTRACT_MONEY_FIELDS = ["gia_thue", "tien_coc", "don_gia_dien", "don_gia_nuoc"];

export function formatVnd(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseVnd(value, field, { positive = false } = {}) {
  const text = String(value ?? "").trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) {
    const error = new Error("Chỉ nhập số nguyên đồng không âm.");
    error.field = field;
    throw error;
  }
  const amount = Number(text.replaceAll(".", ""));
  if (!Number.isSafeInteger(amount) || (positive && amount === 0)) {
    const error = new Error(positive && amount === 0 ? "Số tiền phải lớn hơn 0." : "Số tiền vượt phạm vi cho phép.");
    error.field = field;
    throw error;
  }
  return amount;
}

export function contractDraftFeedback(raw) {
  const errors = {};
  const warnings = [];
  const amounts = {};
  for (const field of CONTRACT_MONEY_FIELDS) {
    try { amounts[field] = parseVnd(raw[field], field, { positive: field === "gia_thue" }); }
    catch (error) { errors[field] = error.message; }
  }
  const start = Date.parse(`${raw.ngay_bat_dau}T00:00:00Z`);
  const end = Date.parse(`${raw.ngay_ket_thuc}T00:00:00Z`);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    const days = Math.round((end - start) / 86400000);
    if (days <= 0) errors.ngay_ket_thuc = "Ngày kết thúc phải sau ngày bắt đầu.";
    else if (days < SHORT_CONTRACT_DAYS) warnings.push(`Hợp đồng chỉ kéo dài ${days} ngày.`);
  }
  if (!errors.gia_thue && !errors.tien_coc && BigInt(amounts.tien_coc) > BigInt(amounts.gia_thue) * BigInt(DEPOSIT_WARNING_MULTIPLIER)) {
    warnings.push("Tiền cọc cao bất thường, bạn đã kiểm tra chưa?");
  }
  return { errors, warnings };
}

export function contractServerErrors(error) {
  const labels = { ma_phong: "Phòng", ngay_bat_dau: "Ngày bắt đầu", ngay_ket_thuc: "Ngày kết thúc", gia_thue: "Giá thuê", tien_coc: "Tiền cọc", don_gia_dien: "Đơn giá điện", chi_so_dien_ban_dau: "Chỉ số điện ban đầu", don_gia_nuoc: "Đơn giá nước", dieu_khoan: "Điều khoản", da_co_ban_giay_ky: "Bản giấy đã ký" };
  const result = {};
  if (error.field && labels[error.field]) result[error.field] = error.message;
  for (const detail of Array.isArray(error.details) ? error.details : []) {
    if (labels[detail.field]) result[detail.field] = `${labels[detail.field]} không hợp lệ.`;
    if (detail.field === "ma_khach_thue") result.form = "Chưa chọn khách thuê hợp lệ.";
  }
  if (/Phòng này đã có hợp đồng/.test(error.message)) result.ma_phong = error.message;
  if (/Thời gian hợp đồng/.test(error.message)) result.ngay_ket_thuc = error.message;
  if (/Số tiền cọc/.test(error.message)) result.tien_coc = error.message;
  if (!Object.keys(result).length) result.form = error.message;
  return result;
}
