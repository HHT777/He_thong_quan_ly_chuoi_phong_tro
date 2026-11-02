import { shellPage } from "../../shared/components/view.js";
import { summaryMarkup, postDebtMarkup, billsMarkup, billDetailMarkup, paymentsMarkup, billListPath, paymentListPath, requestLoader } from "./tenant-billing.model.mjs";
import "../residents-contracts/contracts.css";
import "../../shared/components/content-card.css";
import "./tenant-finance.css";

let activeDetail;
function sectionLoader(slot, api, render, bind = () => {}) {
  return requestLoader(api, {
    active: () => slot.isConnected,
    loading: () => { slot.innerHTML = '<p role="status">Đang tải dữ liệu...</p>'; },
    ready: (response) => { slot.innerHTML = render(response); bind(slot, response); },
    error: (error, retry) => {
      slot.innerHTML = '<p role="alert" data-error></p><button type="button" class="btn btn--secondary" data-retry>Thử lại</button>';
      slot.querySelector("[data-error]").textContent = error.message || "Không thể tải dữ liệu";
      slot.querySelector("[data-retry]").addEventListener("click", retry);
    },
  });
}
function bindDetails(slot, context) {
  slot.querySelectorAll("[data-bill-detail]").forEach((button) => button.addEventListener("click", () => {
    if (!button.disabled) openBill(context, button.dataset.billDetail, button);
  }));
}
function openBill(context, id, trigger) {
  if (activeDetail?.id === id) return;
  activeDetail?.close(); trigger.disabled = true;
  const overlay = document.createElement("div"); overlay.className = "modal-overlay";
  overlay.innerHTML = '<div class="modal-dialog contract-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="tenant-bill-title"><div class="modal-header"><h3 id="tenant-bill-title">Chi tiết phiếu và lịch sử thanh toán</h3><button type="button" class="modal-close-btn" data-close aria-label="Đóng">×</button></div><div class="modal-body contract-detail-body"><section data-bill-info></section><section><h4>Lịch sử giao dịch</h4><div data-payments></div></section></div><div class="modal-footer"><button type="button" class="btn btn--secondary" data-close>Đóng</button></div></div>';
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("hashchange", close); window.removeEventListener("isk19:session-expired", close);
    overlay.remove(); trigger.disabled = false;
    if (activeDetail?.overlay === overlay) activeDetail = null;
    if (trigger.isConnected) trigger.focus();
  };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("hashchange", close, { once: true }); window.addEventListener("isk19:session-expired", close, { once: true });
  overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-close]")) close(); });
  document.body.appendChild(overlay); activeDetail = { id, overlay, close }; overlay.querySelector("[data-close]").focus();
  sectionLoader(overlay.querySelector("[data-bill-info]"), context.api, (result) => billDetailMarkup(result.data))(`/khoan-phai-thu/${encodeURIComponent(id)}`);
  const loadPayments = sectionLoader(overlay.querySelector("[data-payments]"), context.api, (result) => paymentsMarkup(result.data, result.pagination), (slot, response) => {
    slot.querySelector("[data-payment-prev]")?.addEventListener("click", () => loadPayments(paymentListPath(id, response.pagination.page - 1)));
    slot.querySelector("[data-payment-next]")?.addEventListener("click", () => loadPayments(paymentListPath(id, response.pagination.page + 1)));
  });
  loadPayments(paymentListPath(id));
}

export default {
  id: "tenant-finance", route: "/tenant/finance", title: "Tài chính", tabLabel: "Khoản phải trả", group: "tenant-finance", order: 20, roles: ["KHACH_THUE"],
  async render(context) {
    activeDetail?.close();
    context.main.innerHTML = shellPage("Khoản phải trả", "");
    const content = context.main.querySelector("[data-content]");
    const refreshButton = document.createElement("button");
    refreshButton.type = "button"; refreshButton.className = "btn btn--secondary content-card-action";
    refreshButton.textContent = "Cập nhật số liệu";
    content.before(refreshButton);
    content.innerHTML = '<div class="content-card-stack"><section class="panel panel--padded" data-summary></section><section class="panel panel--padded"><h2>Lịch sử phiếu</h2><form class="tenant-finance-period-form" data-period-form><label>Kỳ xem lịch sử <input class="form-control" type="month" name="period" aria-label="Kỳ xem lịch sử"></label><div class="tenant-finance-period-form__actions"><button type="submit" class="btn btn--primary">Xem kỳ</button><button type="button" class="btn btn--secondary" data-all-periods>Tất cả kỳ</button></div></form><div class="content-card-stack" data-bills></div></section><section class="panel panel--padded" data-post-debt></section></div>';
    const summarySlot = content.querySelector("[data-summary]"); const postSlot = content.querySelector("[data-post-debt]");
    const loadSummary = sectionLoader(summarySlot, context.api, (result) => summaryMarkup(result.data), (_slot, result) => {
      postSlot.innerHTML = postDebtMarkup(result.data.postLiquidationDebt); bindDetails(postSlot, context);
    });
    const form = content.querySelector("[data-period-form]"); let period = ""; let page = 1;
    const loadBills = sectionLoader(content.querySelector("[data-bills]"), context.api, (result) => billsMarkup(result.data, result.pagination), (slot, result) => {
      bindDetails(slot, context);
      page = result.pagination?.page || 1;
      slot.querySelector("[data-bill-prev]")?.addEventListener("click", () => { page = result.pagination.page - 1; loadBills(billListPath(period, page)); });
      slot.querySelector("[data-bill-next]")?.addEventListener("click", () => { page = result.pagination.page + 1; loadBills(billListPath(period, page)); });
    });
    form.addEventListener("submit", (event) => { event.preventDefault(); period = form.elements.namedItem("period").value; page = 1; loadBills(billListPath(period, page)); });
    content.querySelector("[data-all-periods]").addEventListener("click", () => { period = ""; page = 1; form.reset(); loadBills(billListPath(period, page)); });
    const refresh = async () => {
      if (refreshButton.disabled) return;
      refreshButton.disabled = true; refreshButton.textContent = "Đang cập nhật...";
      refreshButton.setAttribute("aria-busy", "true");
      try { await Promise.all([loadSummary("/v1/me/billing-summary"), loadBills(billListPath(period, page))]); }
      finally {
        refreshButton.disabled = false; refreshButton.textContent = "Cập nhật số liệu";
        refreshButton.removeAttribute("aria-busy");
      }
    };
    refreshButton.addEventListener("click", refresh);
    await refresh();
  },
};
