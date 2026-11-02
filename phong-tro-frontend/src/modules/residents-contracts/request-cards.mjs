import { escapeHtml, datePadded } from "../../shared/components/view.js";

// The request type is authoritative; free-text content is not a type discriminator.
export function moveOutCardsMarkup(rows) {
  const moveOutRows = rows.filter((item) => item.loai_yeu_cau === "TRA_PHONG" && item.moveOut);
  if (!moveOutRows.length) return "";
  return `<section class="panel panel--padded"><h2>Ngày trả phòng và ngoại lệ</h2><div class="content-card-stack">${moveOutRows.map((item) => `<article class="panel panel--padded"><h3>Đề nghị trả phòng</h3><p>${escapeHtml(item.noi_dung)}</p><dl class="contract-detail-grid"><div><dt>Ngày đề nghị</dt><dd>${escapeHtml(datePadded(item.moveOut.requestedDate))}</dd></div><div><dt>Mốc thông thường</dt><dd>${escapeHtml(datePadded(item.moveOut.minimumNormalMoveOutDate))}</dd></div><div><dt>Ngày được duyệt</dt><dd>${escapeHtml(datePadded(item.moveOut.approvedDate))}</dd></div></dl><p>Lý do ngoại lệ: ${escapeHtml(item.moveOut.earlyReturnReason || "Không có")}</p></article>`).join("")}</div></section>`;
}
