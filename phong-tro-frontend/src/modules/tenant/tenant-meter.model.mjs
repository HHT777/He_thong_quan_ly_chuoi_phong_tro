import { escapeHtml } from "../../shared/components/view.js";
import { icons } from "../../shared/components/icons.js";
export const unavailable = "Hiện chưa gửi được chỉ số, vui lòng liên hệ Chủ trọ";
export function validateImage(file, policy) {
  if (!file) throw new Error("Vui lòng chọn ảnh công tơ");
  if (!policy?.mimeTypes?.includes(file.type)) throw new Error("Chỉ nhận ảnh JPEG hoặc PNG");
  if (!file.size || file.size > policy.maxBytes) throw new Error("Dung lượng ảnh không hợp lệ hoặc vượt giới hạn");
}
export function contextMarkup(context) {
  const confirmed = context.current?.status === "DA_XAC_NHAN";
  const label = confirmed ? "Đã xác nhận" : !context.submissionWindowOpen ? "Chưa có kỳ cần gửi" : context.current ? "Chờ xác nhận" : "Chưa gửi";
  const variant = confirmed ? "da_xac_nhan" : context.current && context.submissionWindowOpen ? "cho_xac_nhan" : "neutral";
  const field = (label, value) => `<div><dt>${label}</dt><dd>${escapeHtml(value ?? "—")}</dd></div>`;
  return `<div class="meter-capture__heading"><h2 id="tenant-meter-context-title">Thông tin kỳ gửi</h2></div>
    <dl class="contract-detail-grid">${field("Căn", context.room?.buildingName)}${field("Phòng", context.room?.code)}
    ${field("Kỳ gửi", context.periodLabel || context.period)}${field("Chỉ số trước (kWh)", context.previousReading?.value)}
    <div class="contract-detail-grid__wide"><dt>Trạng thái</dt><dd><span class="meter-status meter-status--${variant}">${label}</span></dd></div></dl>
    ${confirmed || !context.submissionWindowOpen ? `<p class="meter-message">${confirmed ? "Chỉ số đã được xác nhận, không thể gửi lại." : "Chưa có kỳ nào cần gửi chỉ số."}</p>` : ""}`;
}
export function previewMarkup(preview) {
  if (preview.ocrStatus !== "RECOGNIZED") return `<p><span class="meter-status meter-status--tu_choi">Chưa đọc được chỉ số</span></p><p>${unavailable}</p>`;
  return `<p><span class="meter-status meter-status--${preview.canSubmit ? "da_xac_nhan" : "tu_choi"}">${preview.canSubmit ? "Nhận dạng thành công" : "Chỉ số chưa hợp lệ"}</span></p>
    <dl class="contract-detail-grid"><div><dt>Chỉ số đọc từ ảnh (kWh)</dt><dd><output>${escapeHtml(preview.ocrValue)}</output></dd></div></dl>
    ${preview.canSubmit ? "" : "<p>Chỉ số nhỏ hơn kỳ trước. Vui lòng tải ảnh khác hoặc liên hệ Chủ trọ.</p>"}`;
}
export function imagePolicyLabel(policy) {
  const formats = (policy?.mimeTypes || []).map((type) => ({ "image/jpeg": "JPEG", "image/png": "PNG" })[type] || type).join(" / ");
  const bytes = Number(policy?.maxBytes);
  const size = Number.isFinite(bytes) && bytes > 0 ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(bytes / 1048576)} MB` : "theo giới hạn của hệ thống";
  return `${formats || "Theo định dạng hệ thống cho phép"} · Tối đa ${size}`;
}
export function captureMarkup(context) {
  if (!context.submissionWindowOpen || context.current?.status === "DA_XAC_NHAN") return "";
  return `<section class="panel meter-capture" aria-labelledby="tenant-meter-upload-title">
    <div class="meter-capture__heading"><h2 id="tenant-meter-upload-title">Gửi chỉ số bằng ảnh</h2></div>
    <div class="meter-capture__body"><div class="meter-capture__controls">
      <div class="meter-upload"><label for="tenant-meter-image">1. Chọn ảnh công tơ</label>
        <input id="tenant-meter-image" type="file" accept="${escapeHtml((context.imagePolicy?.mimeTypes || []).join(","))}" aria-describedby="tenant-meter-image-policy" data-image hidden>
        <p id="tenant-meter-image-policy">${escapeHtml(imagePolicyLabel(context.imagePolicy))}</p>
        <button type="button" class="btn btn--secondary" data-choose aria-controls="tenant-meter-image">${icons.plus()} Chọn ảnh công tơ</button>
        <p data-file-name class="meter-message">Chưa chọn ảnh</p></div>
      <div><h3>2. Xem trước và nhận dạng</h3></div>
      <button type="button" class="btn btn--secondary" data-preview disabled>Nhận dạng ảnh</button>
      <div><h3>3. Kết quả đọc từ ảnh</h3><div data-preview-result aria-live="polite" aria-atomic="true"><p class="meter-message">Chưa nhận dạng ảnh.</p></div></div>
      <div><h3>4. Gửi để xác nhận</h3></div>
      <button type="button" class="btn btn--primary" data-submit disabled>Gửi chỉ số từ ảnh</button>
      <p data-message class="meter-message" role="status" aria-live="polite" aria-atomic="true"></p>
    </div><div class="meter-image tenant-meter-preview" aria-label="Xem trước ảnh công tơ">
      <div class="meter-image__empty" data-photo-empty>Chưa có ảnh</div>
      <button type="button" data-enlarge aria-label="Phóng to ảnh công tơ" disabled hidden><img data-photo alt="Ảnh công tơ đã chọn, chưa gửi" style="display:none" hidden></button>
    </div></div></section>`;
}
export function openImagePreview(src, trigger) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay tenant-meter-lightbox";
  overlay.innerHTML = `<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="tenant-meter-photo-title">
    <div class="modal-header"><h3 class="modal-title" id="tenant-meter-photo-title">Ảnh công tơ</h3><button type="button" class="modal-close-btn" data-close aria-label="Đóng ảnh phóng to">×</button></div>
    <div class="modal-body"><img data-enlarged-photo alt="Ảnh công tơ phóng to"></div></div>`;
  overlay.querySelector("[data-enlarged-photo]").src = src;
  const button = overlay.querySelector("[data-close]");
  const close = () => { document.removeEventListener("keydown", onKeydown); overlay.remove(); if (trigger?.isConnected) trigger.focus(); };
  const onKeydown = (event) => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key === "Tab") { event.preventDefault(); button.focus(); }
  };
  overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKeydown);
  document.body.appendChild(overlay); button.focus();
  return close;
}
export function loadErrorMarkup(error) {
  const missing = error.status === 404;
  return `<section class="panel meter-capture empty-state${missing ? "" : " empty-state--error"}" role="alert">
    <h2>${missing ? "Chưa có hợp đồng thuê phòng khả dụng" : "Không tải được trạng thái chỉ số"}</h2>
    <p>${missing ? "Vui lòng liên hệ Chủ trọ để kiểm tra hợp đồng và thông tin phòng." : escapeHtml(error.message || "Vui lòng kiểm tra kết nối và thử lại.")}</p>
    <button type="button" class="btn btn--secondary" data-retry>${icons.refresh()} Thử lại</button></section>`;
}
