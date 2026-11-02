import { escapeHtml, datePadded } from "../../shared/components/view.js";
const reasons = { CONTRACT_NOT_ACTIVE: "Hợp đồng không còn hiệu lực.", CONTRACT_EXPIRED: "Hợp đồng đã hết hạn.", CONTRACT_NOT_EXPIRING: "Chưa đến thời gian gửi yêu cầu gia hạn.", RENEWAL_ALREADY_PENDING: "Đã có yêu cầu gia hạn chờ xử lý.", RENEWAL_PACKAGES_UNAVAILABLE: "Chưa có gói hợp lệ, vui lòng liên hệ Chủ trọ.", CONTRACT_END_DATE_MISSING: "Chưa có ngày hết hạn." };
reasons.CONTRACT_REQUEST_CONFLICT = "Hợp đồng có yêu cầu trả phòng chờ xử lý hoặc đã duyệt. Vui lòng liên hệ Chủ trọ.";
export function contractMarkup(c, months) {
  const p = c.allowedPackages.find((v) => v.months === Number(months));
  return `<dl class="contract-detail-grid"><div><dt>Căn / Phòng</dt><dd>${escapeHtml(c.buildingName)} / ${escapeHtml(c.roomName)}</dd></div><div><dt>Ngày hết hạn hiện tại</dt><dd>${escapeHtml(datePadded(c.currentEndDate))}</dd></div><div><dt>Ngày dự kiến theo gói</dt><dd>${escapeHtml(p ? datePadded(p.expectedEndDate) : "—")}</dd></div></dl>
    <div id="renewal-eligibility" class="renewal-notice${c.eligible ? "" : " renewal-notice--blocked"}" role="status" aria-live="polite"><strong>${c.eligible ? "Hợp đồng đủ điều kiện gia hạn" : "Chưa thể gửi yêu cầu gia hạn"}</strong>${c.eligible ? "" : `<p>${escapeHtml(reasons[c.reasonCode] || "Chưa đủ điều kiện gia hạn.")}</p>`}</div>`;
}
export function historyMarkup(rows) {
  const labels = { CHO_XU_LY: "Chờ xử lý", DA_PHE_DUYET: "Đã duyệt", TU_CHOI: "Từ chối", DA_RUT: "Đã rút" };
  const badges = { CHO_XU_LY: "warning", DA_PHE_DUYET: "success", TU_CHOI: "danger" };
  const items = rows.filter((r) => r.loai_yeu_cau === "GIA_HAN");
  return items.length ? items.map((r) => `<article class="panel renewal-card"><div class="renewal-card__heading"><h3>Gia hạn ${escapeHtml(r.renewal?.packageMonths == null ? "(yêu cầu cũ thiếu gói)" : `${r.renewal.packageMonths} tháng`)}</h3><span class="badge badge--${badges[r.trang_thai] || "neutral"}">${escapeHtml(labels[r.trang_thai] || r.trang_thai)}</span></div><p class="renewal-content">${escapeHtml(r.noi_dung)}</p><dl class="contract-detail-grid"><div><dt>Ngày gửi</dt><dd>${escapeHtml(datePadded(r.ngay_gui))}</dd></div><div><dt>Ngày dự kiến lúc gửi</dt><dd>${escapeHtml(datePadded(r.renewal?.expectedEndDate))}</dd></div></dl>${r.ly_do_xu_ly ? `<div class="renewal-notice"><strong>${r.trang_thai === "TU_CHOI" ? "Lý do từ chối" : "Lý do xử lý"}</strong><p>${escapeHtml(r.ly_do_xu_ly)}</p></div>` : ""}</article>`).join("") : '<div class="empty-state" role="status">Chưa có yêu cầu gia hạn</div>';
}
export const moveOutMarkup = () => '<div class="empty-state" role="status">Chọn tab Trả phòng để tải điều kiện từ hệ thống.</div>';
export function formMarkup(contracts, draft) {
  if (!contracts.length) return '<section class="panel renewal-card empty-state" role="status">Chưa có hợp đồng để gửi yêu cầu gia hạn.</section>';
  const c = contracts.find((v) => v.contractId === draft.contractId) || contracts[0];
  const select = contracts.length > 1
    ? `<label for="renewal-contract">Hợp đồng</label><select class="form-control" id="renewal-contract" name="contractId">${contracts.map((v) => `<option value="${escapeHtml(v.contractId)}" ${v.contractId === c.contractId ? "selected" : ""}>${escapeHtml(v.buildingName)} / ${escapeHtml(v.roomName)}</option>`).join("")}</select>`
    : `<span class="renewal-label">Hợp đồng đang chọn</span><p class="renewal-selected">${escapeHtml(c.buildingName)} / ${escapeHtml(c.roomName)}</p>`;
  return `<section class="panel renewal-card" aria-labelledby="renewal-info-title"><div class="renewal-card__heading"><h2 id="renewal-info-title">Thông tin gia hạn</h2></div><form data-renewal><fieldset class="renewal-fields" data-fields><div class="renewal-field">${select}</div><div data-info>${contractMarkup(c, draft.packageMonths)}</div><div class="renewal-field"><label for="renewal-package">Gói gia hạn</label><select class="form-control" id="renewal-package" name="packageMonths" aria-describedby="renewal-eligibility" required ${c.eligible ? "" : "disabled"}><option value="">Chọn gói</option>${c.allowedPackages.map((p) => `<option value="${escapeHtml(p.months)}" ${String(p.months) === draft.packageMonths ? "selected" : ""}>${escapeHtml(p.months)} tháng</option>`).join("")}</select></div><div class="renewal-field"><label for="renewal-content">Nội dung đề nghị</label><textarea class="form-control" id="renewal-content" name="content" aria-describedby="renewal-eligibility" required maxlength="1000" rows="4" ${c.eligible ? "" : "disabled"}>${escapeHtml(draft.content)}</textarea></div><div class="renewal-actions"><button type="submit" class="btn btn--primary" data-submit ${c.eligible ? "" : "disabled"}>Gửi yêu cầu gia hạn</button></div></fieldset></form></section>`;
}
export function renewalPayload(contractId, packageMonths, content) {
  const months = Number(packageMonths);
  if (!contractId || ![6, 12].includes(months) || !String(content).trim() || String(content).trim().length > 1000) throw new Error("Vui lòng chọn hợp đồng, gói và nhập nội dung tối đa 1000 ký tự.");
  return { type: "GIA_HAN", contractId, packageMonths: months, content: String(content).trim() };
}
export function submitGate() {
  let busy = false;
  return async (work) => { if (busy) return false; busy = true; try { await work(); return true; } finally { busy = false; } };
}
