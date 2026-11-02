import { datePadded, escapeHtml } from "../../shared/components/view.js";
import { statusLabel } from "../../shared/components/status-labels.mjs";

const shown = (value) => escapeHtml(value == null || value === "" ? "Chưa có dữ liệu" : value);
const amount = (value) => value == null ? "Chưa có dữ liệu" : `${Number(value).toLocaleString("vi-VN")} đ`;
const day = (value) => value ? datePadded(value) : "Chưa có dữ liệu";
const field = (label, value) => `<div><dt>${label}</dt><dd>${shown(value)}</dd></div>`;
const warningLabels = {
  RECEIPT_DATA_INCOMPLETE: "Thông tin trạng thái/ngày nhận cọc chưa đầy đủ hoặc chưa nhất quán.",
  REFUND_DETAILS_UNAVAILABLE: "Tổng đã hoàn có trên sổ nhưng chưa có chi tiết từng lần hoàn.",
  LEGACY_SETTLEMENT: "Hồ sơ quyết toán cũ có thể chưa có đầy đủ chi tiết.",
  SETTLEMENT_DATA_INCOMPLETE: "Một số thành phần quyết toán chưa có dữ liệu; số tiền hiển thị theo hồ sơ đã lưu.",
  RELATED_RECORDS_UNAVAILABLE: "Một số chi tiết chưa thể hiển thị do liên kết hồ sơ chưa nhất quán.",
};
const receivedStates = new Set(["DA_NHAN", "DA_HOAN", "DA_KHAU_TRU_MOT_PHAN", "DA_KHAU_TRU_TOAN_BO"]);

export function depositMarkup(payload) {
  if (!payload || !Object.hasOwn(payload, "deposit") || !Array.isArray(payload.deductions)
    || !Array.isArray(payload.refunds) || !Array.isArray(payload.dataWarnings)) throw new Error("Phản hồi tiền cọc không hợp lệ");
  const { deposit, settlement, deductions, refunds, dataWarnings } = payload;
  const receipt = deposit?.trang_thai === "CHUA_NHAN" && !deposit.ngay_nhan_coc ? "Chưa nhận"
    : receivedStates.has(deposit?.trang_thai) && deposit.ngay_nhan_coc ? "Đã ghi nhận nhận cọc" : "Chưa đủ dữ liệu xác nhận nhận cọc";
  const summary = deposit == null ? '<p class="empty-state">Chưa có cọc: hợp đồng này chưa có hồ sơ tiền cọc.</p>'
    : `<dl class="contract-detail-grid">${field("Phải cọc theo hồ sơ", amount(deposit.so_tien_coc))}
      ${field("Ghi nhận nhận cọc", receipt)}${field("Ngày nhận cọc", day(deposit.ngay_nhan_coc))}
      ${field("Trạng thái sổ cọc", statusLabel(deposit.trang_thai))}
      ${field("Đã khấu trừ từ cọc", amount(deposit.so_tien_da_khau_tru))}
      ${field("Tổng đã hoàn theo sổ", amount(deposit.so_tien_da_hoan))}</dl>`;
  const deductionList = deductions.length ? `<ol>${deductions.map((row) => `<li><strong>${shown(row.ly_do)}</strong>
    <p>Loại khoản: ${shown(statusLabel(row.loai_khau_tru))} · ${shown(amount(row.so_tien))}</p><p>Ghi chú: ${shown(row.ghi_chu)}</p></li>`).join("")}</ol>`
    : "<p>Chưa có chi tiết khoản khấu trừ trong quyết toán.</p>";
  const refundList = refunds.length ? `<ol>${refunds.map((row) => `<li>${shown(day(row.ngay_hoan))} · ${shown(amount(row.so_tien))}</li>`).join("")}</ol>`
    : "<p>Chưa có chi tiết từng lần hoàn.</p>";
  const settlementView = settlement == null ? "<p>Chưa có biên bản quyết toán.</p>"
    : `<dl class="contract-detail-grid">${field("Ngày quyết toán", day(settlement.ngay_quyet_toan))}
      ${field("Cọc ban đầu trong quyết toán", amount(settlement.tien_coc_ban_dau))}
      ${field("Tiền phòng trả trước được hoàn", amount(settlement.tien_phong_tra_truoc_duoc_hoan))}
      ${field("Tổng khoản khấu trừ trong quyết toán", amount(settlement.tong_khoan_khau_tru))}
      ${field("Giá trị quyết toán ròng", amount(settlement.gia_tri_quyet_toan_rong))}
      ${field("Số được hoàn theo quyết toán (có thể gồm tiền phòng trả trước)", amount(settlement.so_tien_coc_duoc_hoan))}
      ${field("Nợ sau thanh lý", amount(settlement.so_tien_no_sau_thanh_ly))}</dl>`;
  return `${summary}<h5>Các khoản trong quyết toán</h5>${deductionList}
    <h5>Các lần hoàn có chi tiết</h5>${refundList}<h5>Quyết toán đã lưu</h5>${settlementView}
    ${dataWarnings.length ? `<ul role="status">${dataWarnings.map((code) => `<li>${shown(warningLabels[code] || "Một phần dữ liệu chưa đầy đủ; vui lòng liên hệ Chủ trọ để đối chiếu.")}</li>`).join("")}</ul>` : ""}`;
}

export async function loadDepositSection(slot, api, contractId) {
  slot.innerHTML = '<p role="status">Đang tải tiền cọc...</p>';
  try {
    const result = await api.get(`/v1/me/contracts/${encodeURIComponent(contractId)}/deposit`);
    if (!slot.isConnected) return;
    slot.innerHTML = depositMarkup(result.data);
  } catch (error) {
    if (!slot.isConnected || error.status === 401) return;
    slot.innerHTML = '<p role="alert" data-deposit-error></p><button type="button" class="btn btn--secondary" data-deposit-retry>Thử lại</button>';
    slot.querySelector("[data-deposit-error]").textContent = error.message || "Không thể tải tiền cọc";
    slot.querySelector("[data-deposit-retry]").addEventListener("click", () => loadDepositSection(slot, api, contractId));
  }
}
