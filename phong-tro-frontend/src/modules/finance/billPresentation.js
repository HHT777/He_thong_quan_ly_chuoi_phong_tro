const paymentLabels = {
  CHUA_THANH_TOAN: "Chưa thanh toán",
  THANH_TOAN_MOT_PHAN: "Thanh toán một phần",
  DA_THANH_TOAN: "Đã thanh toán",
};

export function billStatus(row) {
  if (!row.da_gui && Number(row.tong_da_thanh_toan) === 0) return "Nháp";
  return paymentLabels[row.trang_thai] || "Trạng thái chưa xác định";
}

export function billPrimaryAction(row) {
  if (!row.da_gui) return "send";
  if (Number(row.so_tien_con_no) > 0) return "pay";
  return null;
}

export function billStatusTone(row) {
  if (!row.da_gui && Number(row.tong_da_thanh_toan) === 0) return "draft";
  if (row.trang_thai === "DA_THANH_TOAN") return "paid";
  if (row.trang_thai === "THANH_TOAN_MOT_PHAN") return "partial";
  return "neutral";
}

export function billMenuActions(row) {
  const actions = ["detail", "adjust"];
  if (row.da_gui) actions.push("resend");
  return actions;
}

export function billAdjustmentPreview(row, direction, rawAmount) {
  const amount = Number(rawAmount);
  const current = Number(row.tong_phai_tra) || 0;
  const paid = Number(row.tong_da_thanh_toan) || 0;
  const outstanding = Number(row.so_tien_con_no) || 0;
  const delta = direction === "decrease" ? -amount : amount;
  const total = current + delta;
  const remaining = total - paid;
  const error = !Number.isSafeInteger(amount) || amount <= 0
    ? "Nhập số tiền nguyên dương."
    : delta < 0 && amount > outstanding
      ? "Mức giảm vượt số còn nợ của phiếu."
      : total < paid || total < 0
        ? "Tổng mới không được thấp hơn số đã thu."
        : "";
  return { delta, total, paid, remaining, error };
}

export const paymentStatusLabels = {
  CHO_XAC_NHAN: "Chờ xác nhận",
  DA_XAC_NHAN: "Đã xác nhận",
  DA_HUY: "Đã hủy",
};
