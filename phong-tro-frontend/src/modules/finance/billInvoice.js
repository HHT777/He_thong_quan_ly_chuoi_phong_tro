import { escapeHtml, money } from "../../shared/components/view.js";

export const billLineLabels = { TIEN_PHONG: "Tiền phòng tháng này", TIEN_DIEN: "Tổng tiền điện", TIEN_NUOC: "Tổng tiền nước", PHI_DICH_VU: "Phí dịch vụ", PHI_PHAT_SINH: "Phí phát sinh", GIAM_TRU: "Giảm trừ", DIEU_CHINH_TANG: "Điều chỉnh tăng", DIEU_CHINH_GIAM: "Điều chỉnh giảm" };

export function renderBillInvoice(row, status, sentDate) {
  const contract = row.hopDong || {};
  const prices = [
    ["Tiền phòng theo hợp đồng", contract.gia_thue, "đ/tháng"],
    ["Đơn giá điện", contract.don_gia_dien, "đ/kWh"],
    ["Đơn giá nước", contract.don_gia_nuoc, "đ/người"],
    ["Phí dịch vụ theo hợp đồng", contract.phi_dich_vu, "đ/tháng"],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)));
  const lines = Array.isArray(row.chiTiets) ? row.chiTiets : [];
  const period = `${String(row.thang).padStart(2, "0")}/${row.nam}`;
  const hasFraction = !Number.isInteger(Number(row.tong_phai_tra));
  return `<article class="bill-invoice">
    <div class="bill-invoice__heading"><div><span>PHIẾU THU THÁNG ${escapeHtml(period)}</span><h3>Phòng ${escapeHtml(contract.phongTro?.so_phong || "—")}</h3><p>${escapeHtml(contract.khachThue?.ho_ten || "Khách thuê")}</p></div><div class="bill-invoice__state"><strong>${escapeHtml(status)}</strong><small>${row.da_gui ? `Đã gửi ${escapeHtml(sentDate)}` : "Chưa gửi khách"}</small></div></div>
    ${prices.length ? `<section class="bill-invoice__section"><h4>Đơn giá trên hợp đồng hiện tại</h4><div class="bill-invoice__prices">${prices.map(([label, value, unit]) => `<div><span>${escapeHtml(label)}</span><strong>${Number(value).toLocaleString("vi-VN")} ${escapeHtml(unit)}</strong></div>`).join("")}</div></section>` : ""}
    <section class="bill-invoice__section"><h4>Các khoản của kỳ</h4><div class="bill-invoice__lines">${lines.map((line) => { const label = billLineLabels[line.loai_khoan] || "Khoản khác"; const detail = String(line.dien_giai || "").trim(); return `<div><span><strong>${escapeHtml(label)}</strong>${detail && detail.toLocaleLowerCase("vi-VN") !== label.toLocaleLowerCase("vi-VN") ? `<small>${escapeHtml(detail)}</small>` : ""}</span><strong>${money(line.so_tien)}</strong></div>`; }).join("") || "<p>Chưa có dòng chi tiết.</p>"}</div></section>
    <div class="bill-invoice__totals"><div><span>Tổng phải trả</span><strong>${money(row.tong_phai_tra)}</strong></div><div><span>Đã thu</span><strong>${money(row.tong_da_thanh_toan)}</strong></div><div class="bill-invoice__remaining"><span>Còn phải thanh toán</span><strong>${money(row.so_tien_con_no)}</strong></div></div>
    ${hasFraction ? '<p class="bill-hint bill-hint--warning">Tổng phiếu này còn số lẻ theo cách tính cũ. Số tiền đang hiển thị là số thực đã lưu.</p>' : ""}
  </article>`;
}
