import { escapeHtml, money, datePadded } from "../../shared/components/view.js";
import { statusLabel } from "../../shared/components/status-labels.mjs";

const shown = (value) => escapeHtml(value == null || value === "" ? "—" : value);
const amount = (value) => value == null ? "Chưa có số tiền" : money(value);
const day = (value) => value ? datePadded(value) : "—";
const field = (label, value) => `<div><dt>${label}</dt><dd>${shown(value)}</dd></div>`;
const lineLabels = { TIEN_PHONG: "Tiền phòng", TIEN_DIEN: "Tiền điện", TIEN_NUOC: "Tiền nước", PHI_DICH_VU: "Phí dịch vụ", PHI_PHAT_SINH: "Phát sinh", GIAM_TRU: "Giảm trừ", DIEU_CHINH_TANG: "Điều chỉnh tăng", DIEU_CHINH_GIAM: "Điều chỉnh giảm", NO_SAU_THANH_LY: "Nợ sau thanh lý", SUA_CHUA: "Sửa chữa" };
const paymentLabels = { CHO_XAC_NHAN: "Chờ xác nhận", DA_XAC_NHAN: "Đã xác nhận", DA_HUY: "Đã hủy", TU_CHOI: "Từ chối (hồ sơ cũ)" };
const sourceLabels = { THU_TIEN: "Tiền Chủ trọ ghi nhận", KHAU_TRU_COC: "Bù từ cọc" };

export function summaryMarkup(dto) {
  if (!dto?.current || !dto.oldDebt || !dto.postLiquidationDebt || !dto.currentPeriod) throw new Error("Phản hồi tổng quan không hợp lệ");
  const current = dto.current;
  return `<h2>Kỳ hiện tại: ${shown(dto.currentPeriod)}</h2>${dto.isOverdue ? '<p role="status">Có khoản đang quá hạn.</p>' : ""}
    <dl class="contract-detail-grid">${field("Tổng phải thu kỳ hiện tại", amount(current.totalDue))}
      ${field("Đã thu (tiền thực nhận)", amount(current.cashReceived))}${field("Đã bù từ cọc", amount(current.depositOffset))}
      ${field("Đã thanh toán", amount(current.settledAmount))}${field("Còn thiếu kỳ hiện tại", amount(current.remainingAmount))}
      ${field("Nợ cũ còn thiếu", amount(dto.oldDebt.remainingAmount))}${field("Tổng còn cần thanh toán", amount(dto.totalRemainingDue))}
      ${field("Hồ sơ chờ xác nhận kỳ hiện tại", current.pendingCount)}</dl>`;
}
export function pagerMarkup(pagination, prefix) {
  if (!pagination || pagination.totalPages <= 1) return "";
  return `<div class="mgmt-toolbar"><button type="button" class="btn btn--secondary" data-${prefix}-prev ${pagination.hasPrev ? "" : "disabled"}>Trang trước</button>
    <span>Trang ${shown(pagination.page)} / ${shown(pagination.totalPages)}</span><button type="button" class="btn btn--secondary" data-${prefix}-next ${pagination.hasNext ? "" : "disabled"}>Trang sau</button></div>`;
}
export function billsMarkup(rows, pagination, prefix = "bill") {
  if (!Array.isArray(rows)) throw new Error("Phản hồi danh sách phiếu không hợp lệ");
  if (!rows.length) return '<p class="empty-state">Chưa có phiếu trong phạm vi đang xem.</p>';
  return `<div class="table-wrap"><table class="tenant-bills-table"><thead><tr><th>Kỳ</th><th>Phòng theo hợp đồng</th><th>Phải thu</th><th>Đã thanh toán</th><th>Còn thiếu theo phiếu</th><th>Trạng thái</th><th>Chi tiết</th></tr></thead><tbody>
    ${rows.map((row) => `<tr><td>${shown(`${row.thang}/${row.nam}`)}</td><td>${shown(row.hopDong?.phongTro?.so_phong)}</td>
      <td>${shown(amount(row.tong_phai_tra))}</td><td>${shown(amount(row.tong_da_thanh_toan))}</td><td>${shown(amount(row.so_tien_con_no))}</td>
      <td>${shown(statusLabel(row.trang_thai))}${row.isOverdue ? " · Quá hạn" : ""}</td>
      <td><button type="button" class="btn btn--secondary" data-bill-detail="${shown(row.ma_thanh_toan)}">Xem phiếu</button></td></tr>`).join("")}</tbody></table></div>${pagerMarkup(pagination, prefix)}`;
}
export function postDebtMarkup(group) {
  if (!group || !Array.isArray(group.bills)) throw new Error("Phản hồi nợ sau thanh lý không hợp lệ");
  return `<h2>Nợ sau thanh lý</h2><p>Số còn thiếu: <strong>${shown(amount(group.remainingAmount))}</strong></p>
    ${group.bills.length ? billsMarkup(group.bills) : "<p>Không có nợ sau thanh lý.</p>"}`;
}
export function billDetailMarkup(bill) {
  if (!bill?.ma_thanh_toan || !Array.isArray(bill.chiTiets)) throw new Error("Phản hồi chi tiết phiếu không hợp lệ");
  return `<p>Kỳ ${shown(`${bill.thang}/${bill.nam}`)} · ${shown(bill.hopDong?.phongTro?.so_phong)} · ${shown(bill.loai_thanh_toan === "SAU_THANH_LY" ? "Nợ sau thanh lý" : "Phiếu định kỳ")}</p>
    <dl class="contract-detail-grid">${field("Tổng phải thu", amount(bill.tong_phai_tra))}${field("Đã thanh toán", amount(bill.tong_da_thanh_toan))}
      ${field("Còn thiếu", amount(bill.so_tien_con_no))}${field("Trạng thái", statusLabel(bill.trang_thai))}${field("Quá hạn hiện tại", bill.isOverdue ? "Có" : "Không")}</dl>
    <h4>Các khoản trên phiếu</h4>
    ${bill.chiTiets.length ? `<div class="table-wrap"><table><thead><tr><th>Khoản</th><th>Diễn giải</th><th>Số tiền</th></tr></thead><tbody>${bill.chiTiets.map((line) => `<tr><td>${shown(lineLabels[line.loai_khoan] || line.loai_khoan)}</td><td>${shown(line.dien_giai)}</td><td>${shown(amount(line.so_tien))}</td></tr>`).join("")}</tbody></table></div>` : "<p>Chưa có chi tiết các khoản trong hồ sơ.</p>"}`;
}
export function paymentsMarkup(rows, pagination) {
  if (!Array.isArray(rows)) throw new Error("Phản hồi lịch sử thanh toán không hợp lệ");
  if (!rows.length) return "<p>Chưa có giao dịch thanh toán.</p>";
  return `<div class="table-wrap"><table><thead><tr><th>Ngày ghi nhận</th><th>Số tiền</th><th>Nguồn</th><th>Trạng thái</th></tr></thead><tbody>${rows.map((row) => `<tr>
      <td>${shown(day(row.thoi_diem_ghi_nhan))}</td><td>${shown(amount(row.so_tien))}</td><td>${shown(sourceLabels[row.nguon_thanh_toan] || row.nguon_thanh_toan)}</td>
      <td>${shown(paymentLabels[row.trang_thai_xac_nhan] || row.trang_thai_xac_nhan)}</td></tr>`).join("")}</tbody></table></div>${pagerMarkup(pagination, "payment")}`;
}
export const billListPath = (period = "", page = 1) => `/khoan-phai-thu?${new URLSearchParams({ ...(period ? { ky: period } : {}), page: String(page), limit: "20" })}`;
export const paymentListPath = (id, page = 1) => `/khoan-phai-thu/payment/list?${new URLSearchParams({ ma_thanh_toan: id, page: String(page), limit: "20" })}`;

// Dedupe repeated clicks and discard older responses when selection changes.
export function requestLoader(api, hooks) {
  let version = 0; let pendingPath; let pending;
  const load = (path) => {
    if (pending && pendingPath === path) return pending;
    pendingPath = path; const current = ++version;
    hooks.loading();
    const active = () => current === version && hooks.active();
    pending = (async () => {
      try { const response = await api.get(path); if (active()) hooks.ready(response); }
      catch (error) { if (active() && error.status !== 401) hooks.error(error, () => { pending = null; return load(path); }); }
      finally { if (current === version) pending = null; }
    })();
    return pending;
  };
  return load;
}
