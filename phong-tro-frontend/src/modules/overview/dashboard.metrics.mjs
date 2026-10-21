import { STATUS_LABELS } from "../../shared/components/status-labels.mjs";

export const ROOM_STATES = ["DANG_THUE", "TRONG", "DA_GIU", "DANG_XU_LY_TRA_PHONG", "NGUNG_SU_DUNG", "KHAC"];
export const ROOM_LABELS = Object.fromEntries(ROOM_STATES.map((status) => [status, STATUS_LABELS[status]]));
export const INCIDENT_LABELS = Object.fromEntries(["CHO_TIEP_NHAN", "DANG_XU_LY", "DA_XU_LY", "KHAC"].map((status) => [status, STATUS_LABELS[status]]));

function count(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`Invalid count: ${field}`);
  return value;
}

export function readSummary(response) {
  const data = response?.data;
  if (!data?.rooms?.byStatus || !data?.bills || !/^\d{4}-\d{2}$/.test(data.period || "")) throw new TypeError("Invalid dashboard summary");
  const rooms = { total: count(data.rooms.total, "rooms.total"), byStatus: {} };
  for (const state of ROOM_STATES) rooms.byStatus[state] = count(data.rooms.byStatus[state], `rooms.${state}`);
  if (Object.values(rooms.byStatus).reduce((sum, value) => sum + value, 0) !== rooms.total) throw new TypeError("Room partition mismatch");
  const bills = Object.fromEntries(["total", "daThu", "conNo", "quaHan"].map((key) => [key, count(data.bills[key], `bills.${key}`)]));
  if (bills.daThu + bills.conNo + bills.quaHan !== bills.total) throw new TypeError("Bill partition mismatch");
  return {
    period: data.period, rooms, bills,
    occupancyPercent: rooms.total ? Math.round(rooms.byStatus.DANG_THUE * 100 / rooms.total) : 0,
  };
}

export function readCashflow(response) {
  const value = response?.data?.totalRevenue;
  if (!Number.isSafeInteger(value)) throw new TypeError("Invalid cashflow totalRevenue (VND)");
  return { totalRevenue: value };
}

export function readExpiring(response) {
  if (!Array.isArray(response?.data)) throw new TypeError("Invalid expiring contracts");
  return response.data.map((row) => ({
    id: String(row.ma_hop_dong || ""), room: row.phongTro?.so_phong || "—", endDate: row.ngay_ket_thuc || "",
  }));
}

export function readIncidents(response) {
  if (!Array.isArray(response?.data)) throw new TypeError("Invalid incidents");
  const byStatus = Object.fromEntries(Object.keys(INCIDENT_LABELS).map((key) => [key, 0]));
  const rows = response.data.map((row) => {
    const status = Object.hasOwn(INCIDENT_LABELS, row.trang_thai) ? row.trang_thai : "KHAC";
    byStatus[status] += 1;
    return { id: String(row.ma_su_co || ""), text: String(row.mo_ta || ""), room: String(row.phongTro?.so_phong || ""), date: String(row.ngay_gui || ""), status };
  });
  return { total: rows.length, byStatus, recent: rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3) };
}

export function dashboardError(error) {
  if (error?.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử lại.";
  if (error?.status === 403) return "Bạn không có quyền xem dữ liệu này.";
  if (error?.status === 404) return "Không tìm thấy dữ liệu cần xem hoặc bạn không có quyền với đối tượng này.";
  if (error?.status === 503 && error?.code === "DB_SCHEMA_OUTDATED") return "Hệ thống đang cần cập nhật dữ liệu. Vui lòng liên hệ quản trị.";
  if (error?.status >= 500) return "Hệ thống tạm thời không thể tải dữ liệu.";
  if (!error?.status) return "Mất kết nối. Vui lòng kiểm tra mạng rồi thử lại.";
  return "Không thể tải dữ liệu. Vui lòng thử lại.";
}
