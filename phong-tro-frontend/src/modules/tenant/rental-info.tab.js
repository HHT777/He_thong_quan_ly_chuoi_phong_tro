import { readOnlyTab } from "../../shared/components/tab-factory.js";
import { detailMarkup, historyMarkup, loadContracts, overviewMarkup, roomMembersMarkup, violationsMarkup } from "./rental-contract.model.mjs";
import { loadDepositSection } from "./rental-deposit.model.mjs";
import "../residents-contracts/contracts.css";
import "../../shared/components/content-card.css";

let activeDetail = null;

function openContractDetail(context, contractId, trigger) {
  activeDetail?.close();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal-dialog contract-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="tenant-contract-title">
    <div class="modal-header"><h3 class="modal-title" id="tenant-contract-title">Chi tiết hợp đồng</h3><button type="button" class="modal-close-btn" data-close aria-label="Đóng">×</button></div>
    <div class="modal-body contract-detail-body">
      <section><h4>Thông tin hợp đồng</h4><div data-contract-info></div></section>
      <section class="contract-detail-deposit"><h4>Tiền cọc</h4><div data-contract-deposit></div></section>
      <section><h4>Lịch sử thay đổi</h4><div data-contract-history></div></section>
      <section><h4>Vi phạm hợp đồng</h4><div data-contract-violations></div></section>
    </div><div class="modal-footer"><button type="button" class="btn btn--secondary" data-close>Đóng</button></div>
  </div>`;
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("hashchange", close);
    window.removeEventListener("isk19:session-expired", close);
    overlay.remove();
    if (activeDetail?.overlay === overlay) activeDetail = null;
    if (trigger?.isConnected) trigger.focus();
  };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("hashchange", close, { once: true });
  window.addEventListener("isk19:session-expired", close, { once: true });
  document.body.appendChild(overlay);
  activeDetail = { overlay, close };
  overlay.querySelector("[data-close]").focus();

  const loadSection = async (selector, path, render) => {
    const slot = overlay.querySelector(selector);
    slot.innerHTML = '<p role="status">Đang tải...</p>';
    try {
      const result = await context.api.get(path);
      if (!overlay.isConnected) return;
      slot.innerHTML = render(result.data);
    } catch (error) {
      if (!overlay.isConnected || error.status === 401) return;
      slot.innerHTML = '<p role="alert" data-error></p><button type="button" class="btn btn--secondary" data-retry>Thử lại</button>';
      slot.querySelector("[data-error]").textContent = error.message || "Không thể tải dữ liệu";
      slot.querySelector("[data-retry]").addEventListener("click", () => loadSection(selector, path, render));
    }
  };
  const id = encodeURIComponent(contractId);
  loadDepositSection(overlay.querySelector("[data-contract-deposit]"), context.api, contractId);
  loadSection("[data-contract-info]", `/hop-dong/${id}`, detailMarkup);
  loadSection("[data-contract-history]", `/hop-dong/${id}/history`, historyMarkup);
  loadSection("[data-contract-violations]", `/v1/contracts/${id}/violations`, violationsMarkup);
}

function openRoomMembers(context, contract, trigger) {
  activeDetail?.close();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal-dialog contract-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="tenant-room-members-title">
    <div class="modal-header"><h3 class="modal-title" id="tenant-room-members-title">Thành viên trong phòng</h3><button type="button" class="modal-close-btn" data-close aria-label="Đóng">×</button></div>
    <div class="modal-body contract-detail-body"><div data-members-content role="status">Đang tải thành viên...</div></div>
    <div class="modal-footer"><button type="button" class="btn btn--secondary" data-close>Đóng</button></div>
  </div>`;
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("hashchange", close);
    window.removeEventListener("isk19:session-expired", close);
    overlay.remove();
    if (activeDetail?.overlay === overlay) activeDetail = null;
    if (trigger?.isConnected) trigger.focus();
  };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("hashchange", close, { once: true });
  window.addEventListener("isk19:session-expired", close, { once: true });
  document.body.appendChild(overlay);
  activeDetail = { overlay, close };
  overlay.querySelector("[data-close]").focus();
  const slot = overlay.querySelector("[data-members-content]");
  const loadMembers = async () => {
    slot.textContent = "Đang tải thành viên...";
    try {
      const result = await context.api.get("/v1/me/co-tenant-context");
      if (!overlay.isConnected) return;
      slot.removeAttribute("role");
      slot.innerHTML = roomMembersMarkup(result.data, contract);
    } catch (error) {
      if (!overlay.isConnected || error.status === 401) return;
      slot.innerHTML = '<p role="alert" data-error></p><button type="button" class="btn btn--secondary" data-retry>Thử lại</button>';
      slot.querySelector("[data-error]").textContent = error.message || "Không thể tải thành viên trong phòng";
      slot.querySelector("[data-retry]").addEventListener("click", loadMembers);
    }
  };
  loadMembers();
}

export default readOnlyTab({
  id: "tenant-rental-info", route: "/tenant/rental-info", title: "Phòng thuê và hợp đồng", tabLabel: "Phòng thuê", group: "tenant-info", order: 10, roles: ["KHACH_THUE"],
}, {
  title: "Phòng thuê và hợp đồng",
  description: "",
  load: loadContracts,
  view: overviewMarkup,
  bind: (content, context, contracts) => {
    const renewalLink = document.createElement("a");
    renewalLink.className = "btn btn--secondary content-card-action"; renewalLink.href = "#/tenant/requests";
    renewalLink.textContent = "Yêu cầu gia hạn hợp đồng"; content.prepend(renewalLink);
    content.querySelectorAll("[data-contract-detail]").forEach((button) => {
      button.addEventListener("click", () => openContractDetail(context, button.dataset.contractDetail, button));
    });
    content.querySelectorAll("[data-room-members]").forEach((button) => {
      button.addEventListener("click", () => {
        const contract = contracts.find((row) => String(row.ma_hop_dong) === button.dataset.roomMembers);
        if (contract) openRoomMembers(context, contract, button);
      });
    });
  },
});
