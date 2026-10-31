import { wholeVnd } from "../../shared/format-money.mjs";

export const paymentStatus = {
  CHO_XAC_NHAN: { label: "Chờ xác nhận", tone: "pending", icon: "◷" },
  DA_XAC_NHAN: { label: "Đã xác nhận", tone: "success", icon: "✓" },
  DA_HUY: { label: "Đã hủy", tone: "cancelled", icon: "−" },
};

export const paymentBadge = (row) => paymentStatus[row.trang_thai_xac_nhan] || { label: "Không xác định", tone: "cancelled", icon: "−" };
export const canConfirm = (row) => row.trang_thai_xac_nhan === "CHO_XAC_NHAN" && row.nguon_thanh_toan !== "KHAU_TRU_COC" && Number.isFinite(Number(row.so_tien)) && Number(row.so_tien) > 0;
export const canCancel = (row) => row.trang_thai_xac_nhan === "DA_XAC_NHAN" && row.nguon_thanh_toan === "THU_TIEN";
export const defaultStatus = (pendingCount) => pendingCount > 0 ? "CHO_XAC_NHAN" : "ALL";
export const ellipsis = (value, length = 44) => String(value || "Không xác định").length > length ? `${String(value).slice(0, length - 1)}…` : String(value || "Không xác định");
export const paymentMoney = (value) => `${wholeVnd(value)} đ`;
export const paymentDate = (value) => {
  if (!value) return "Không xác định";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};
export const paymentQuery = ({ building = "ALL", status = "ALL", page = 1, limit = 20 }) => {
  const values = new URLSearchParams({ limit: String(limit), page: String(page), exclude_zero: "1" });
  if (building !== "ALL") values.set("ma_can", building);
  if (status !== "ALL") values.set("trang_thai_xac_nhan", status);
  return `/khoan-phai-thu/payment/list?${values}`;
};
