import { listTab } from "../../shared/components/tab-factory.js";
import { datePadded as date, money } from "../../shared/components/view.js";
import { billStatus } from "../finance/billPresentation.js";
import { renderBillInvoice } from "../finance/billInvoice.js";
import "../finance/bills-v2.css";

function openInvoice(_context, row) {
  const overlay = document.createElement("div");
  const previous = document.activeElement;
  overlay.className = "modal-overlay bill-modal";
  overlay.innerHTML = `<div class="bill-dialog" role="dialog" aria-modal="true" aria-label="Chi tiết phiếu thu"><header><h2>Chi tiết phiếu thu</h2><button type="button" class="bill-icon-button" data-close aria-label="Đóng">×</button></header><div class="bill-dialog__body">${renderBillInvoice(row, billStatus(row), date(row.ngay_gui))}</div></div>`;
  const close = () => { document.removeEventListener("keydown", onKeydown); overlay.remove(); previous?.focus?.(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  overlay.querySelector("[data-close]").addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  document.addEventListener("keydown", onKeydown);
  document.body.append(overlay);
  overlay.querySelector("[data-close]").focus();
}

export default listTab({ id: "tenant-finance", route: "/tenant/finance", title: "Tài chính", tabLabel: "Khoản phải trả", group: "tenant-finance", order: 20, roles: ["KHACH_THUE"] }, { title: "Khoản phải trả", description: "Hóa đơn và số tiền còn nợ thuộc hợp đồng của bạn.", endpoint: "/khoan-phai-thu?limit=100", columns: [{ label: "Kỳ", format: (row) => `${row.thang}/${row.nam}` }, { label: "Phải trả", format: (row) => money(row.tong_phai_tra) }, { label: "Đã trả", format: (row) => money(row.tong_da_thanh_toan) }, { label: "Còn nợ", format: (row) => money(row.so_tien_con_no) }, { label: "Trạng thái", key: "trang_thai" }], rowActions: [{ id: "invoice", label: "Xem hóa đơn", openDetail: true }], openDetail: openInvoice });
