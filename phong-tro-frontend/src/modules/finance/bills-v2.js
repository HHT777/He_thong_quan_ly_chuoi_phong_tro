import "./bills-v2.css";
import { shellPage, escapeHtml, money, datePadded as date, confirmAction } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import { createRequestKeyStore, integerVnd, requiredText } from "../../core/idempotency.js";
import { billStatus, billPrimaryAction, billStatusTone, billMenuActions, billAdjustmentPreview, paymentStatusLabels } from "./billPresentation.js";
import { billLineLabels, renderBillInvoice } from "./billInvoice.js";
import { fetchBillPage } from "./billRequests.js";

const keys = createRequestKeyStore();
const currentPeriod = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
const periodOptions = (selected) => {
  const current = currentPeriod();
  const [year, month] = current.split("-").map(Number);
  const values = Array.from({ length: 49 }, (_, index) => {
    const day = new Date(Date.UTC(year, month - 1 + index - 36, 1));
    return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  if (!values.includes(selected)) values.push(selected);
  return values.reverse().map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>Tháng ${escapeHtml(value.slice(5))}/${escapeHtml(value.slice(0, 4))}</option>`).join("");
};
const periodLabel = (row) => `${String(row.thang).padStart(2, "0")}/${row.nam}`;
const status = billStatus;
const lineTypeLabels = billLineLabels;
const adjustmentTypeLabels = { PHI_PHAT_SINH: "Khoản tăng", GIAM_TRU: "Giảm trừ" };
const adjustmentModeLabels = { THEO_KY: "Theo kỳ", CO_DINH: "Cố định" };
const adjustmentStateLabels = { DANG_AP_DUNG: "Đang áp dụng", NGUNG_AP_DUNG: "Đã tắt", DA_HUY: "Đã hủy" };
const reason = { BILL_ALREADY_EXISTS: "Đã có phiếu kỳ này", MISSING_CONFIRMED_METER: "Thiếu chỉ số điện kỳ trước đã xác nhận", INITIAL_READING_REQUIRED: "Thiếu chỉ số đầu", NO_ACTIVE_CONTRACT: "Chưa có hợp đồng hiệu lực", RECIPIENT_UNAVAILABLE: "Chưa có tài khoản khách đang hoạt động", ALREADY_SENT: "Phiếu đã gửi", ALREADY_PROCESSED: "Yêu cầu đã được xử lý", SEND_FAILED: "Không gửi được", INVALID_ELECTRICITY_AMOUNT: "Số điện không hợp lệ" };
const runStatusLabels = { DANG_CHAY: "Đang chạy", HOAN_TAT: "Hoàn tất", LOI: "Lỗi" };
const nextRunLabel = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(value || "");
  return match ? `${match[3]}/${match[2]}/${match[1]} lúc ${match[4]} (giờ Việt Nam)` : value || "Đang tắt";
};
const query = (values) => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== "")).toString();

function dialog(title, body, onClose, confirmClose) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay bill-modal";
  overlay.innerHTML = `<div class="bill-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><header><h2>${escapeHtml(title)}</h2><button type="button" class="bill-icon-button" data-close aria-label="Đóng">×</button></header><div class="bill-dialog__body">${body}</div></div>`;
  const previous = document.activeElement;
  const close = () => { document.removeEventListener("keydown", keydown); overlay.remove(); previous?.focus?.(); onClose?.(); };
  const requestClose = async () => { if (!confirmClose || await confirmClose()) close(); };
  const keydown = (event) => {
    if ([...document.querySelectorAll(".modal-overlay")].at(-1) !== overlay) return;
    if (event.key === "Escape") requestClose();
    if (event.key !== "Tab") return;
    const focusable = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')];
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  overlay.querySelector("[data-close]").addEventListener("click", requestClose);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) requestClose(); });
  document.addEventListener("keydown", keydown);
  document.body.append(overlay);
  overlay.querySelector("[data-close]").focus();
  return { overlay, close, requestClose, body: overlay.querySelector(".bill-dialog__body") };
}

function askReason(title) {
  return new Promise((resolve) => {
    const modal = dialog(title, '<form class="bill-action-form"><label>Lý do<textarea name="reason" required></textarea></label><button class="btn btn--primary">Xác nhận</button></form>', () => resolve(null));
    modal.body.querySelector("form").onsubmit = (event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("reason")?.trim(); if (!value) return; resolve(value); modal.close(); };
  });
}

const rowName = (row) => `${escapeHtml(row.hopDong?.phongTro?.so_phong || "Phòng")}`;
const tenantName = (row) => escapeHtml(row.hopDong?.khachThue?.ho_ten || "Chưa rõ khách");

const compareBillsByRoom = (left, right) => {
  const leftRoom = String(left.hopDong?.phongTro?.so_phong || "");
  const rightRoom = String(right.hopDong?.phongTro?.so_phong || "");
  return leftRoom.localeCompare(rightRoom, "vi", { numeric: true, sensitivity: "base" })
    || String(left.hopDong?.phongTro?.canTro?.ten_can || "").localeCompare(String(right.hopDong?.phongTro?.canTro?.ten_can || ""), "vi", { sensitivity: "base" })
    || Number(right.nam) - Number(left.nam)
    || Number(right.thang) - Number(left.thang)
    || String(left.ma_thanh_toan || "").localeCompare(String(right.ma_thanh_toan || ""));
};

export async function renderBillsV2(context) {
  context.main.innerHTML = shellPage("Phiếu thu", "");
  const root = context.main.querySelector("[data-content]");
  root.classList.add("bill-page");
  root.innerHTML = `<section class="bill-hero"><div><span class="bill-eyebrow">TÀI CHÍNH / PHIẾU THU</span><h2>Quản lý phiếu thu</h2></div><div class="bill-hero__actions"><button class="btn btn--secondary" data-schedule>Thiết lập tự động</button><button class="btn btn--secondary" data-send>Gửi phiếu thu</button><button class="btn btn--primary" data-create>Lập phiếu thu</button></div></section>
    <form class="bill-filters" data-filter><label>Kỳ thu<select name="period">${periodOptions(currentPeriod())}</select></label><label>Căn<select name="building"><option value="">Tất cả căn</option></select></label><label>Trạng thái<select name="issuance"><option value="">Tất cả</option><option value="DRAFT">Nháp</option><option value="SENT">Đã gửi</option></select></label><label>Tìm phòng hoặc khách<input name="search" type="search" placeholder="Nhập để tìm"></label><button class="btn btn--primary">Áp dụng</button></form>
    <div class="bill-stats" data-stats aria-live="polite"></div><section class="panel"><div class="bill-section-head"><h3>Danh sách phiếu thu</h3><span data-count></span></div><div data-list aria-live="polite">Đang tải...</div><nav class="bill-pagination" data-pagination aria-label="Phân trang phiếu thu"></nav></section>
    <details class="panel bill-disclosure"><summary>Khoản điều chỉnh định kỳ</summary><div data-definitions></div></details>
    <details class="panel bill-disclosure"><summary>Lịch sử ghi nhận thu</summary><div data-payments></div></details>`;
  let buildings = []; let bills = []; let page = 1; let pagination = {};
  const selected = new Set();
  root.querySelector("[data-pagination]").insertAdjacentHTML("beforebegin", '<div class="bill-selection" data-selection hidden><strong data-selected-count></strong><button type="button" class="btn btn--primary" data-send-selected>Gửi phiếu thu</button><button type="button" class="btn btn--secondary" data-clear-selected>Bỏ chọn</button></div>');
  const updateSelection = () => {
    const bar = root.querySelector("[data-selection]");
    bar.hidden = selected.size === 0;
    bar.querySelector("[data-selected-count]").textContent = `Đã chọn ${selected.size} phiếu`;
  };
  root.querySelector("[data-send-selected]").onclick = () => sendDialog([...selected]);
  root.querySelector("[data-clear-selected]").onclick = () => { selected.clear(); root.querySelectorAll("[data-select], [data-all]").forEach((input) => { input.checked = false; }); updateSelection(); };
  const closeMenus = (event) => {
    if (!root.isConnected) { document.removeEventListener("click", closeMenus); document.removeEventListener("keydown", closeMenus); return; }
    if (event.type === "keydown" && event.key !== "Escape") return;
    if (event.type === "click" && event.target.closest(".bill-menu")) return;
    root.querySelectorAll(".bill-menu[open]").forEach((menu) => { menu.open = false; });
  };
  document.addEventListener("click", closeMenus);
  document.addEventListener("keydown", closeMenus);
  const state = () => { const form = root.querySelector("[data-filter]"); const field = (name) => form.elements.namedItem(name).value; return { period: field("period"), building: field("building"), issuance: field("issuance"), search: field("search").trim() }; };
  const loading = (target, label = "Đang tải...") => { target.innerHTML = `<div class="bill-loading" role="status"><span class="bill-loading__pulse" aria-hidden="true"></span>${escapeHtml(label)}</div>`; };
  try {
    const response = await context.api.get("/management/can-tro?limit=100");
    buildings = response.data || [];
    root.querySelector('[name="building"]').insertAdjacentHTML("beforeend", buildings.map((row) => `<option value="${escapeHtml(row.ma_can)}">${escapeHtml(row.ten_can)}</option>`).join(""));
  } catch (error) { root.querySelector("[data-list]").textContent = `Không tải được căn: ${error.message}`; }
  const options = (selectedIds = []) => { const selectedValues = new Set(Array.isArray(selectedIds) ? selectedIds : [selectedIds]); return buildings.map((row) => `<option value="${escapeHtml(row.ma_can)}" ${selectedValues.has(row.ma_can) ? "selected" : ""}>${escapeHtml(row.ten_can)}</option>`).join(""); };

  async function refresh() {
    const f = state(); const list = root.querySelector("[data-list]");
    loading(list); selected.clear(); updateSelection();
    try {
      const { billResponse, summaryResult } = await fetchBillPage(context.api,
        `/khoan-phai-thu?${query({ ky: f.period, ma_can: f.building, issuance: f.issuance, search: f.search, page, limit: 20 })}`,
        `/v1/bills/summary?${query({ ky: f.period, ma_can: f.building, issuance: f.issuance, search: f.search })}`);
      bills = (billResponse.data || []).slice().sort(compareBillsByRoom); pagination = billResponse.pagination || {};
      const summary = summaryResult.value?.data;
      root.querySelector("[data-stats]").innerHTML = summary ? [
        ["Tổng phải thu", money(summary.totalDue)], ["Đã thu", money(summary.totalPaid)],
        ["Còn nợ", money(summary.totalDebt)],
      ].map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")
        + `<button type="button" class="bill-stat-unsent" data-show-unsent><span>Chưa gửi</span><strong>${Number(summary.unsent || 0).toLocaleString("vi-VN")} phiếu</strong></button>` : `<p role="status">Không tải được thống kê: ${escapeHtml(summaryResult.error.message)}</p>`;
      root.querySelector("[data-show-unsent]")?.addEventListener("click", () => { root.querySelector('[name="issuance"]').value = "DRAFT"; page = 1; refresh(); });
      root.querySelector("[data-count]").textContent = `${pagination.total || 0} phiếu`;
      const actionLabels = { detail: "Chi tiết", adjust: "Điều chỉnh", resend: "Gửi lại" };
      const rows = bills.map((row, index) => {
        const primary = billPrimaryAction(row);
        const actions = billMenuActions(row);
        const sentAt = row.ngay_gui ? new Date(row.ngay_gui).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "";
        return `<tr><td><input type="checkbox" data-select="${index}" aria-label="Chọn phiếu phòng ${rowName(row)}"></td><td><strong>${rowName(row)}</strong><small>${tenantName(row)}</small></td><td>${escapeHtml(periodLabel(row))}</td><td>${money(row.tong_phai_tra)}</td><td>${money(row.so_tien_con_no)}</td><td><span class="bill-status bill-status--${billStatusTone(row)}">${escapeHtml(status(row))}</span></td><td><span class="bill-status ${row.da_gui ? "bill-status--sent" : "bill-status--draft"}" title="${escapeHtml(sentAt)}">${row.da_gui ? `Đã gửi ${date(row.ngay_gui)}` : "Chưa gửi"}</span></td><td>${primary ? `<button class="btn btn--secondary" data-action="primary" data-index="${index}">${primary === "send" ? "Gửi" : "Ghi nhận thu"}</button>` : ""}<details class="bill-menu"><summary aria-label="Thao tác khác">⋯</summary><div class="bill-menu__content">${actions.map((action) => `<button data-action="${action}" data-index="${index}">${actionLabels[action]}</button>`).join("")}</div></details></td></tr>`;
      }).join("");
      list.innerHTML = bills.length
        ? `<div class="table-wrap"><table class="bill-table"><thead><tr><th><input type="checkbox" data-all aria-label="Chọn tất cả phiếu trên trang"></th><th>Phòng / Khách</th><th>Kỳ</th><th>Phải trả</th><th>Còn lại</th><th>Trạng thái</th><th>Gửi khách</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : '<div class="bill-empty">Chưa có phiếu thu phù hợp với bộ lọc. <button class="btn btn--primary" data-empty-create>Lập phiếu</button></div>';
      const nav = root.querySelector("[data-pagination]");
      const start = pagination.total ? (Number(pagination.page || page) - 1) * 20 + 1 : 0;
      const end = Math.min(Number(pagination.total || 0), start + bills.length - 1);
      nav.innerHTML = `<span>Hiển thị ${start}–${Math.max(0, end)} trên ${pagination.total || 0} phiếu</span><button class="btn btn--secondary" data-prev ${pagination.hasPrev ? "" : "disabled"}>Trước</button><span>Trang ${pagination.page || 1} / ${pagination.totalPages || 1}</span><button class="btn btn--secondary" data-next ${pagination.hasNext ? "" : "disabled"}>Sau</button>`;
      nav.querySelector("[data-prev]").onclick = () => { page -= 1; refresh(); };
      nav.querySelector("[data-next]").onclick = () => { page += 1; refresh(); };
      list.querySelector("[data-all]")?.addEventListener("change", (event) => { list.querySelectorAll("[data-select]").forEach((input) => { input.checked = event.target.checked; const id = bills[Number(input.dataset.select)].ma_thanh_toan; if (input.checked) selected.add(id); else selected.delete(id); }); updateSelection(); });
      list.querySelectorAll("[data-select]").forEach((input) => input.addEventListener("change", () => { const id = bills[Number(input.dataset.select)].ma_thanh_toan; if (input.checked) selected.add(id); else selected.delete(id); updateSelection(); }));
      list.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => billAction(bills[Number(button.dataset.index)], button.dataset.action)));
      list.querySelectorAll(".bill-menu").forEach((menu) => menu.addEventListener("toggle", () => { if (menu.open) list.querySelectorAll(".bill-menu").forEach((other) => { if (other !== menu) other.open = false; }); }));
      list.querySelector("[data-empty-create]")?.addEventListener("click", createDialog);
    } catch (error) { list.innerHTML = `<div class="bill-empty">Không tải được phiếu thu: ${escapeHtml(error.message)} <button class="btn btn--secondary" data-retry>Thử lại</button></div>`; list.querySelector("[data-retry]").onclick = refresh; }
  }

  function createDialog() {
    const f = state();
    let rows = [];
    let previewRequest = 0;
    const checked = new Set();
    const modal = dialog(
      "Lập phiếu thu",
      `<p class="bill-hint">Phiếu mới được lưu ở dạng Nháp. Bạn xem lại rồi mới gửi cho khách.</p><div class="bill-dialog-filters"><label>Kỳ<select data-period>${periodOptions(f.period)}</select></label><label>Căn<select data-building><option value="">Tất cả căn</option>${options(f.building)}</select></label><label>Tìm phòng, khách<input type="search" data-search placeholder="Tìm phòng, khách"></label></div><label class="bill-select-all"><input type="checkbox" data-all-rooms> Chọn tất cả (<span data-eligible-count>0</span> phòng đủ điều kiện)</label><p class="bill-hint">Kỳ T thu tiền phòng, nước và dịch vụ của T; tiền điện của T−1.</p><div data-preview>Đang kiểm tra điều kiện...</div><footer><span data-total>0 phòng được chọn</span><div class="bill-footer-actions"><button class="btn btn--secondary" type="button" data-cancel>Hủy</button><button class="btn btn--primary" type="button" data-submit disabled>Lập phiếu</button></div></footer><p data-result role="status"></p>`,
      undefined,
      () => checked.size === 0 || confirmAction("Bỏ các phòng đã chọn và đóng hộp thoại?"),
    );
    modal.body.querySelector("[data-cancel]").onclick = modal.requestClose;
    async function load() {
      const requestId = ++previewRequest;
      const period = modal.body.querySelector("[data-period]").value; const building = modal.body.querySelector("[data-building]").value;
      const target = modal.body.querySelector("[data-preview]"); loading(target, "Đang kiểm tra điều kiện...");
      rows = [];
      checked.clear();
      modal.body.querySelector("[data-submit]").disabled = true;
      modal.body.querySelector("[data-total]").textContent = "0 phòng được chọn";
      try {
        const response = await context.api.post("/v1/bills/preview", { period, buildingIds: building ? [building] : [] });
        if (requestId !== previewRequest || !modal.overlay.isConnected) return;
        const previews = new Map((response.data?.previews || []).map((item) => [item.contractId, item]));
        rows = (response.data?.rooms || []).map((room) => ({ ...room, preview: previews.get(room.contractId) }));
        draw();
      } catch (error) { if (requestId === previewRequest && modal.overlay.isConnected) target.textContent = error.message; }
    }
    function draw() {
      const term = modal.body.querySelector("[data-search]").value.trim().toLocaleLowerCase("vi-VN");
      const visible = rows.filter((row) => !term || [row.roomName, row.tenantName, row.buildingName].some((value) => value?.toLocaleLowerCase("vi-VN").includes(term)));
      modal.body.querySelector("[data-eligible-count]").textContent = String(visible.filter((row) => row.eligible).length);
      modal.body.querySelector("[data-preview]").innerHTML = `<div class="bill-room-list">${visible.map((row) => `<label class="${row.eligible ? "" : "is-disabled"}"><input type="checkbox" data-room="${escapeHtml(row.roomId)}" ${row.eligible ? "" : "disabled"} ${checked.has(row.contractId) ? "checked" : ""}><span><strong>${escapeHtml(row.roomName)}</strong><small>${escapeHtml(row.buildingName)} · ${escapeHtml(row.tenantName || "Chưa có khách")}</small></span><span>${row.eligible ? money(row.estimatedTotal) : escapeHtml(reason[row.reasonCode] || "Không đủ điều kiện")}${row.preview ? `<small class="bill-preview-lines">${row.preview.lines.map((line) => `${escapeHtml(lineTypeLabels[line.type] || line.type)} ${money(line.amount)}`).join(" · ")}</small>` : ""}</span></label>`).join("") || "<p>Không có phòng phù hợp.</p>"}</div>`;
      modal.body.querySelectorAll("[data-room]").forEach((input) => input.onchange = () => { const row = rows.find((item) => item.roomId === input.dataset.room); if (input.checked) checked.add(row.contractId); else checked.delete(row.contractId); updateTotal(); });
      updateTotal();
    }
     function updateTotal() { const picked = rows.filter((row) => checked.has(row.contractId) && row.eligible); modal.body.querySelector("[data-total]").textContent = `${picked.length} phòng · Tạm tính ${money(picked.reduce((sum, row) => sum + Number(row.estimatedTotal), 0))}`; modal.body.querySelector("[data-submit]").disabled = !picked.length; const visibleInputs = [...modal.body.querySelectorAll("[data-room]:not([disabled])")]; modal.body.querySelector("[data-all-rooms]").checked = visibleInputs.length > 0 && visibleInputs.every((input) => input.checked); }
     modal.body.querySelector("[data-all-rooms]").onchange = (event) => { modal.body.querySelectorAll("[data-room]:not([disabled])").forEach((input) => { input.checked = event.target.checked; const row = rows.find((item) => item.roomId === input.dataset.room); if (input.checked) checked.add(row.contractId); else checked.delete(row.contractId); }); updateTotal(); };
    modal.body.querySelector("[data-period]").onchange = load;
    modal.body.querySelector("[data-building]").onchange = load;
    modal.body.querySelector("[data-search]").oninput = draw;
    modal.body.querySelector("[data-submit]").onclick = async (event) => {
      const button = event.currentTarget; button.disabled = true;
      try { const period = modal.body.querySelector("[data-period]").value; const response = await context.api.post("/v1/bills/generate", { period, contractIds: [...checked] }); const result = response.data || {}; const skipped = (result.skipped || []).map((item) => { const room = rows.find((row) => row.roomId === item.roomId); return `${room?.roomName || "Phòng"}: ${reason[item.reason] || "Không lập được"}`; }); modal.close(); showToast(`Đã lập ${result.created?.length || 0} phiếu Nháp.${skipped.length ? ` Bỏ qua ${skipped.join("; ")}.` : ""}`, "success"); if (result.created?.length) { root.querySelector('[name="period"]').value = period; root.querySelector('[name="issuance"]').value = "DRAFT"; root.querySelector('[name="building"]').value = ""; root.querySelector('[name="search"]').value = ""; page = 1; } await refresh(); }
      catch (error) { modal.body.querySelector("[data-result]").textContent = error.message; }
      finally { button.disabled = false; }
    };
    load();
  }

  async function scheduleDialog() {
    const modal = dialog("Thiết lập phiếu thu tự động", '<p>Đang tải lịch và nhật ký...</p>');
    try {
      const result = await context.api.get("/v1/bills/schedule");
      const schedule = result.data;
      const latest = schedule.latestRun;
      const runTime = latest?.bat_dau ? new Date(latest.bat_dau).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "";
      const outcomes = (latest?.chiTiets || []).map((item) => `<li>${escapeHtml(item.phongTro?.so_phong || "Phòng")} · ${item.ket_qua === "DA_LAP" ? "Đã lập" : item.ket_qua === "BO_QUA" ? "Bỏ qua" : "Lỗi"} · ${escapeHtml(reason[item.ma_ly_do] || "Không đủ điều kiện")}</li>`).join("");
      const scoped = Boolean(schedule.buildingIds?.length);
      modal.body.innerHTML = `<p class="bill-hint">Lịch này chỉ tạo phiếu Nháp. Bạn xem số tiền và gửi phiếu cho khách sau khi lập.</p>
        <form data-schedule-form class="bill-schedule-form">
          <label class="bill-schedule-toggle"><input type="checkbox" name="enabled" role="switch" aria-checked="${Boolean(schedule.enabled)}" ${schedule.enabled ? "checked" : ""}><span class="bill-schedule-toggle__track" aria-hidden="true"></span><span class="bill-schedule-toggle__copy"><strong>Tự động lập phiếu hằng tháng</strong><small data-enabled-state>${schedule.enabled ? "Đang bật" : "Đang tắt"}</small></span></label>
          <div class="bill-schedule-time"><label>Ngày trong tháng <input name="day" type="number" min="1" max="28" required value="${escapeHtml(schedule.day)}"><small>Chọn từ ngày 1 đến 28</small></label><label>Giờ chạy (giờ Việt Nam) <input name="hour" type="number" min="0" max="23" required value="${escapeHtml(schedule.hour)}"><small>0–23 giờ</small></label></div>
          <fieldset class="bill-schedule-scope"><legend>Áp dụng cho căn</legend><label><input type="radio" name="scope" value="all" ${scoped ? "" : "checked"}> Tất cả căn</label><label><input type="radio" name="scope" value="selected" ${scoped ? "checked" : ""}> Chỉ các căn được chọn</label><div class="bill-schedule-buildings" data-buildings>${buildings.map((row) => `<label><input type="checkbox" name="building" value="${escapeHtml(row.ma_can)}" ${(schedule.buildingIds || []).includes(row.ma_can) ? "checked" : ""}> ${escapeHtml(row.ten_can)}</label>`).join("") || "Chưa có căn nào."}</div></fieldset>
          <p class="bill-hint">Phòng cần có hợp đồng hiệu lực, chỉ số điện kỳ trước đã xác nhận (kỳ đầu tính 0 đ) và chưa có phiếu của kỳ. Lịch đã lỡ được bỏ qua.</p>
          <p class="bill-schedule-next">Lần chạy tiếp theo: <strong data-next-run>${escapeHtml(nextRunLabel(schedule.nextRun))}</strong></p>
          <footer><span data-message role="status"></span><div class="bill-footer-actions"><button class="btn btn--secondary" type="button" data-cancel>Hủy</button><button class="btn btn--primary" type="submit" data-save disabled>Lưu thiết lập</button></div></footer>
        </form>
        <section class="bill-run-log"><h3>Lần chạy gần nhất</h3>${latest ? `<p>${escapeHtml(runTime)} · ${escapeHtml(runStatusLabels[latest.trang_thai] || "Trạng thái chưa xác định")} · Lập ${Number(latest.so_phieu_lap)} phiếu, bỏ qua ${Number(latest.so_phong_bo_qua)} phòng, lỗi ${Number(latest.so_phong_loi)} phòng</p><details><summary>Xem chi tiết</summary><ul>${outcomes || "<li>Không có chi tiết.</li>"}</ul></details>` : "<p>Chưa có lần chạy.</p>"}</section>`;
      const form = modal.body.querySelector("form");
      const values = () => ({
        enabled: form.elements.namedItem("enabled").checked,
        day: Number(form.elements.namedItem("day").value),
        hour: Number(form.elements.namedItem("hour").value),
         buildingIds: form.elements.namedItem("scope").value === "all" ? [] : [...form.querySelectorAll('[name="building"]:checked')].map((input) => input.value),
      });
      let saved = JSON.stringify(values());
       const updateSave = () => {
         const selectedScope = form.elements.namedItem("scope").value === "selected";
         const enabled = form.elements.namedItem("enabled");
         const pending = enabled.checked !== JSON.parse(saved).enabled;
         const state = form.querySelector("[data-enabled-state]");
         state.textContent = pending ? `Chưa lưu · sẽ ${enabled.checked ? "bật" : "tắt"}` : `Đang ${enabled.checked ? "bật" : "tắt"}`;
         state.dataset.pending = String(pending);
         enabled.setAttribute("aria-checked", String(enabled.checked));
         form.querySelector("[data-buildings]").hidden = !selectedScope;
         form.querySelector("[data-save]").disabled = JSON.stringify(values()) === saved || (selectedScope && values().buildingIds.length === 0);
       };
      form.addEventListener("input", updateSave);
      form.addEventListener("change", updateSave);
       updateSave();
      form.querySelector("[data-cancel]").onclick = modal.requestClose;
      form.onsubmit = async (event) => {
        event.preventDefault();
        const button = form.querySelector("[data-save]");
        button.disabled = true;
        try {
          const response = await context.api.put("/v1/bills/schedule", values());
           form.querySelector("[data-message]").textContent = `Đã lưu. Lần kế tiếp: ${nextRunLabel(response.data.nextRun)}`;
           modal.body.querySelector("[data-next-run]").textContent = nextRunLabel(response.data.nextRun);
          saved = JSON.stringify(values());
           updateSave();
          showToast("Đã lưu lịch lập phiếu.", "success");
        } catch (error) { form.querySelector("[data-message]").textContent = error.message; updateSave(); }
      };
    } catch (error) { modal.body.textContent = error.message; }
  }
  async function sendDialog(initialIds = [], resend = false) {
    const f = state();
    let scopeMode = initialIds.length || resend ? "selected" : "unsent";
    const modal = dialog(resend ? "Gửi lại phiếu thu" : "Gửi phiếu thu", `<p class="bill-hint">Phiếu được gửi vào tài khoản khách thuê tương ứng trong ứng dụng.</p><div class="bill-segments" role="group" aria-label="Phạm vi gửi"><button type="button" data-scope-selected aria-pressed="${scopeMode === "selected"}">Phiếu đã chọn (${initialIds.length})</button>${resend ? "" : `<button type="button" data-scope-unsent aria-pressed="${scopeMode === "unsent"}">Tất cả phiếu chưa gửi kỳ ${escapeHtml(f.period)}</button>`}</div><div data-send-list>Đang kiểm tra người nhận...</div><p class="bill-hint bill-hint--warning">Phiếu đã gửi trước đó cần xác nhận khi gửi lại.</p><footer><span data-count></span><div class="bill-footer-actions"><button class="btn btn--secondary" type="button" data-cancel>Hủy</button><button class="btn btn--primary" type="button" data-submit>${resend ? "Xác nhận gửi lại" : "Gửi trong ứng dụng"}</button></div></footer><p data-result role="status"></p>`);
    modal.body.querySelector("[data-cancel]").onclick = modal.requestClose;
    let candidates = []; const chosen = new Set();
    async function load() {
      const target = modal.body.querySelector("[data-send-list]"); loading(target);
      try {
        let ids = initialIds;
         if (scopeMode === "unsent") {
          const response = await context.api.get(`/khoan-phai-thu?${query({ ky: f.period, ma_can: f.building, issuance: "DRAFT", limit: 500 })}`);
           const total = Number(response.pagination?.total || 0);
           modal.body.querySelector("[data-scope-unsent]").textContent = `Tất cả phiếu chưa gửi kỳ ${f.period} (${total})`;
           if (total > 500) throw new Error("Có hơn 500 phiếu chưa gửi. Hãy chọn một căn hoặc gửi theo từng nhóm.");
           ids = (response.data || []).map((row) => row.ma_thanh_toan);
        }
         if (!ids.length) { target.textContent = "Không có phiếu trong phạm vi đã chọn."; candidates = []; chosen.clear(); update(); return; }
        const response = await context.api.post("/v1/bills/send-preview", { billIds: ids }); candidates = response.data.rows || []; chosen.clear();
         target.innerHTML = `<div class="bill-room-list">${candidates.map((row) => `<label class="${row.recipientAvailable && (resend || !row.alreadySent) ? "" : "is-disabled"}"><input data-bill="${escapeHtml(row.billId)}" type="checkbox" ${row.recipientAvailable ? (!row.alreadySent ? "checked" : "") : "disabled"} ${row.alreadySent && !resend ? "disabled" : ""}><span><strong>${escapeHtml(row.roomName || "Phòng")}</strong><small>${escapeHtml(row.tenantName || "Khách thuê")}</small></span><span>${money(row.total)} · <span class="bill-status ${row.recipientAvailable ? "bill-status--sent" : "bill-status--draft"}" ${row.recipientAvailable ? "" : 'title="Chưa thể gửi vì khách chưa có tài khoản hoạt động" tabindex="0"'}>${row.recipientAvailable ? "Có tài khoản" : "Chưa có tài khoản ⓘ"}</span>${row.alreadySent ? " · Đã gửi" : ""}</span></label>`).join("")}</div>`;
         candidates.filter((row) => row.recipientAvailable && !row.alreadySent).forEach((row) => chosen.add(row.billId));
        target.querySelectorAll("[data-bill]").forEach((input) => input.onchange = () => { if (input.checked) chosen.add(input.dataset.bill); else chosen.delete(input.dataset.bill); update(); }); update();
      } catch (error) { target.textContent = error.message; }
    }
    function update() { modal.body.querySelector("[data-count]").textContent = `Sẽ gửi ${chosen.size} phiếu`; const button = modal.body.querySelector("[data-submit]"); button.disabled = !chosen.size; button.textContent = resend ? `Gửi lại ${chosen.size} phiếu` : `Gửi ${chosen.size} phiếu`; }
    modal.body.querySelectorAll("[data-scope-selected], [data-scope-unsent]").forEach((button) => { button.onclick = () => { scopeMode = button.hasAttribute("data-scope-unsent") ? "unsent" : "selected"; modal.body.querySelectorAll("[data-scope-selected], [data-scope-unsent]").forEach((item) => item.setAttribute("aria-pressed", String(item === button))); load(); }; });
     modal.body.querySelector("[data-submit]").onclick = async (event) => {
      if (resend && !await confirmAction("Gửi lại thông báo phiếu thu cho khách đã nhận?")) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const scope = `resend:${[...chosen].sort().join(":")}`;
        const payload = { billIds: [...chosen], resend };
        const response = await context.api.post("/v1/bills/send", payload, resend ? { "Idempotency-Key": keys.keyFor(scope, payload) } : undefined);
        const results = response.data?.results || [];
        if (resend && results.every((row) => row.sent || row.reason === "ALREADY_PROCESSED")) keys.complete(scope);
        const failures = results.filter((row) => !row.sent && row.reason !== "ALREADY_PROCESSED").map((row) => {
          const bill = candidates.find((item) => item.billId === row.billId);
          return `${bill?.roomName || "Phòng"}: ${reason[row.reason] || "Không gửi được"}`;
        });
        modal.body.querySelector("[data-result]").textContent = `Đã gửi ${response.data.sent}/${payload.billIds.length} phiếu.${failures.length ? ` Lỗi: ${failures.join("; ")}.` : ""}`;
        await refresh();
        if (!resend) await load();
      } catch (error) { modal.body.querySelector("[data-result]").textContent = error.message; }
      finally { button.disabled = false; }
    };
    load();
  }

  async function billAction(row, action) {
    if (action === "primary") action = billPrimaryAction(row);
    if (action === "send") return sendDialog([row.ma_thanh_toan]);
    if (action === "resend") return sendDialog([row.ma_thanh_toan], true);
    if (action === "detail") { dialog("Chi tiết phiếu thu", renderBillInvoice(row, status(row), date(row.ngay_gui))); return; }
    if (action === "paid") { if (!await confirmAction("Ghi nhận toàn bộ số tiền còn lại đã được khách đóng?")) return; const scope = `paid:${row.ma_thanh_toan}`; try { await context.api.post(`/v1/bills/${row.ma_thanh_toan}/mark-paid`, {}, { "Idempotency-Key": keys.keyFor(scope, { billId: row.ma_thanh_toan }) }); keys.complete(scope); showToast("Đã ghi nhận thu.", "success"); refresh(); } catch (error) { showToast(error.message, "error"); } return; }
    if (action === "adjust") {
      const modal = dialog("Điều chỉnh phiếu", `<form class="bill-action-form"><p>Phòng ${rowName(row)} · ${tenantName(row)} · kỳ ${escapeHtml(periodLabel(row))}</p><label>Loại điều chỉnh<select name="direction"><option value="decrease">Giảm trừ</option><option value="increase">Khoản tăng</option></select></label><label>Số tiền (VND)<input name="amount" type="number" min="1" step="1" inputmode="numeric" required></label><label>Lý do<textarea name="reason" rows="3" required></textarea></label><div class="bill-adjustment-preview" data-preview aria-live="polite"></div><button class="btn btn--primary" type="submit" disabled>Ghi nhận điều chỉnh</button><span data-message role="status"></span></form>`);
      const form = modal.body.querySelector("form");
      const updatePreview = () => {
        const result = billAdjustmentPreview(row, form.elements.namedItem("direction").value, form.elements.namedItem("amount").value);
        const preview = form.querySelector("[data-preview]");
        preview.innerHTML = `<div><span>Phải thu hiện tại</span><strong>${escapeHtml(money(row.tong_phai_tra))}</strong></div><div><span>Đã thu</span><strong>${escapeHtml(money(result.paid))}</strong></div><div><span>Còn nợ hiện tại</span><strong>${escapeHtml(money(row.so_tien_con_no))}</strong></div><div><span>Sau điều chỉnh</span><strong>${result.error ? "—" : `${escapeHtml(money(result.total))} phải thu · ${escapeHtml(money(result.remaining))} còn nợ`}</strong></div><p data-preview-error></p>`;
        preview.querySelector("[data-preview-error]").textContent = result.error;
        form.querySelector('[type="submit"]').disabled = Boolean(result.error) || !form.elements.namedItem("reason").value.trim();
      };
      form.addEventListener("input", updatePreview);
      form.addEventListener("change", updatePreview);
      form.onsubmit = async (event) => {
        event.preventDefault();
        const button = form.querySelector('[type="submit"]'); button.disabled = true;
        try {
          const amount = integerVnd(form.elements.namedItem("amount").value, "Số tiền", { positive: true });
          const result = billAdjustmentPreview(row, form.elements.namedItem("direction").value, amount);
          if (result.error) return updatePreview();
          await context.api.post(`/v1/bills/${encodeURIComponent(row.ma_thanh_toan)}/adjustments`, { delta: result.delta, reason: requiredText(form.elements.namedItem("reason").value, "Lý do") });
          modal.close(); showToast("Đã ghi nhận điều chỉnh.", "success"); refresh();
        } catch (error) { form.querySelector("[data-message]").textContent = error.message; updatePreview(); }
      };
      updatePreview();
      return;
    }
    if (action === "pay") {
      const modal = dialog("Ghi nhận thu", `<form class="bill-action-form"><p>${rowName(row)} · kỳ ${escapeHtml(periodLabel(row))}</p><label>Ngày thu<input name="day" type="date" required></label><label>Số tiền<input name="amount" type="number" min="1" step="1" required></label><label>Phương thức<select name="method" required><option value="" disabled selected>Chọn phương thức</option><option value="Tiền mặt">Tiền mặt</option><option value="Chuyển khoản">Chuyển khoản</option></select></label><label>Ghi chú<textarea name="note"></textarea></label><button class="btn btn--primary">Lưu</button><span data-message role="status"></span></form>`);
      modal.body.querySelector("form").onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; const raw = Object.fromEntries(new FormData(form)); const button = form.querySelector("button"); button.disabled = true; try { const scope = `pay:${row.ma_thanh_toan}`; const payload = { ma_khoan_phai_thu: row.ma_thanh_toan, ngay_thanh_toan: requiredText(raw.day, "Ngày thu"), so_tien: integerVnd(raw.amount, "Số tiền", { positive: true }), phuong_thuc: requiredText(raw.method, "Phương thức"), ghi_chu: raw.note?.trim() || undefined }; await context.api.post("/khoan-phai-thu/payment/create", payload, { "Idempotency-Key": keys.keyFor(scope, payload) }); keys.complete(scope); modal.close(); showToast("Đã lưu.", "success"); refresh(); } catch (error) { form.querySelector("[data-message]").textContent = error.message; button.disabled = false; } };
    }
  }

  async function loadDefinitions() {
    const target = root.querySelector("[data-definitions]"); loading(target);
    try { const response = await context.api.get("/v1/billing-adjustments"); const rows = response.data || [];
      target.innerHTML = `<button class="btn btn--secondary" data-new>Tạo khoản điều chỉnh</button><div class="bill-room-list">${rows.map((row, i) => `<div><span><strong>${escapeHtml(row.ten_ly_do)}</strong><small>${escapeHtml(adjustmentTypeLabels[row.loai_khoan] || "Khoản khác")} · ${escapeHtml(adjustmentModeLabels[row.che_do] || "Chế độ khác")} · ${escapeHtml(adjustmentStateLabels[row.trang_thai] || "Trạng thái chưa xác định")}</small></span><span>${money(row.so_tien)} <button data-edit="${i}">Sửa</button> <button data-toggle="${i}">${row.trang_thai === "DANG_AP_DUNG" ? "Tắt" : "Bật"}</button></span></div>`).join("") || "<p>Chưa có khoản điều chỉnh.</p>"}</div>`;
      const edit = async (row = {}) => {
        let contracts = [];
        if (!row.ma_khoan_dieu_chinh) {
          try {
            const result = await context.api.get("/hop-dong?limit=100");
            contracts = (result.data || []).filter((item) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(item.trang_thai));
          } catch (error) { showToast(error.message, "error"); return; }
        }
        const contractOptions = row.ma_khoan_dieu_chinh
          ? `<option value="${escapeHtml(row.ma_hop_dong)}">Phòng ${escapeHtml(row.hopDong?.phongTro?.so_phong || "hiện tại")}</option>`
          : contracts.map((item) => `<option value="${escapeHtml(item.ma_hop_dong)}">${escapeHtml(item.phongTro?.so_phong || "Phòng")} · ${escapeHtml(item.khachThue?.ho_ten || "Khách thuê")}</option>`).join("");
        const modal = dialog(
          row.ma_khoan_dieu_chinh ? "Sửa khoản điều chỉnh" : "Tạo khoản điều chỉnh",
          `<form class="bill-action-form"><label>Hợp đồng<select name="contractId" required ${row.ma_khoan_dieu_chinh ? "disabled" : ""}><option value="">Chọn phòng / khách</option>${contractOptions}</select></label><label>Loại<select name="type"><option value="PHI_PHAT_SINH" ${row.loai_khoan === "PHI_PHAT_SINH" ? "selected" : ""}>Khoản tăng</option><option value="GIAM_TRU" ${row.loai_khoan === "GIAM_TRU" ? "selected" : ""}>Giảm trừ</option></select></label><label>Tên<input name="name" value="${escapeHtml(row.ten_ly_do || "")}" required></label><label>Số tiền<input name="amount" type="number" min="1" value="${escapeHtml(row.so_tien || "")}" required></label><label>Chế độ<select name="mode"><option value="THEO_KY">Theo kỳ</option><option value="CO_DINH" ${row.che_do === "CO_DINH" ? "selected" : ""}>Cố định</option></select></label><label>Kỳ<input name="period" type="month" value="${escapeHtml(row.nam_ap_dung ? `${row.nam_ap_dung}-${String(row.thang_ap_dung).padStart(2, "0")}` : state().period)}"></label><label>Ngày bắt đầu<input name="startDate" type="date" value="${escapeHtml(row.ngay_bat_dau || "")}"></label><button class="btn btn--primary">Lưu</button><span data-message role="status"></span></form>`,
        );
        const form = modal.body.querySelector("form");
        form.onsubmit = async (event) => {
          event.preventDefault();
          const raw = Object.fromEntries(new FormData(form));
          const body = {
            contractId: row.ma_hop_dong || requiredText(raw.contractId, "Hợp đồng"),
            type: raw.type,
            name: requiredText(raw.name, "Tên"),
            amount: integerVnd(raw.amount, "Số tiền", { positive: true }),
            mode: raw.mode,
            period: raw.mode === "THEO_KY" ? raw.period : undefined,
            startDate: raw.mode === "CO_DINH" ? raw.startDate : undefined,
          };
          const button = form.querySelector("button");
          button.disabled = true;
          try {
            if (row.ma_khoan_dieu_chinh) await context.api.patch(`/v1/billing-adjustments/${row.ma_khoan_dieu_chinh}`, body);
            else await context.api.post("/v1/billing-adjustments", body);
            modal.close();
            await loadDefinitions();
          } catch (error) { form.querySelector("[data-message]").textContent = error.message; }
          finally { button.disabled = false; }
        };
      };
      target.querySelector("[data-new]").onclick = () => edit();
      target.querySelectorAll("[data-edit]").forEach((button) => button.onclick = () => edit(rows[Number(button.dataset.edit)]));
      target.querySelectorAll("[data-toggle]").forEach((button) => button.onclick = async () => { const row = rows[Number(button.dataset.toggle)]; const enabled = row.trang_thai !== "DANG_AP_DUNG"; const reasonText = enabled ? undefined : await askReason("Lý do tắt khoản điều chỉnh"); if (!enabled && !reasonText) return; try { await context.api.post(`/v1/billing-adjustments/${row.ma_khoan_dieu_chinh}/toggle`, { enabled, reason: reasonText }); loadDefinitions(); } catch (error) { showToast(error.message, "error"); } });
    } catch (error) { target.textContent = error.message; }
  }

  async function loadPayments() {
    const target = root.querySelector("[data-payments]");
    const previous = target.querySelector("[data-payment-filters]")
      ? Object.fromEntries(new FormData(target.querySelector("[data-payment-filters]")))
      : {};
    loading(target);
    try {
      const rows = [];
      let pageNo = 1;
      let hasNext = true;
      while (hasNext) {
        const response = await context.api.get(`/khoan-phai-thu/payment/list?limit=100&page=${pageNo}`);
        rows.push(...(response.data || []).filter((row) => Number(row.so_tien) > 0));
        hasNext = Boolean(response.pagination?.hasNext);
        pageNo += 1;
      }
      target.innerHTML = `<form class="bill-payment-filters" data-payment-filters>
        <label>Từ ngày<input type="date" name="from" value="${escapeHtml(previous.from || "")}"></label>
        <label>Đến ngày<input type="date" name="to" value="${escapeHtml(previous.to || "")}"></label>
        <label>Căn<select name="building"><option value="">Tất cả căn</option>${buildings.map((building) => `<option value="${escapeHtml(building.ma_can)}" ${previous.building === String(building.ma_can) ? "selected" : ""}>${escapeHtml(building.ten_can)}</option>`).join("")}</select></label>
        <button class="btn btn--primary" type="submit">Lọc</button>
        <button class="btn btn--secondary" type="reset">Xóa lọc</button>
      </form><div data-payment-list></div>`;
      const form = target.querySelector("[data-payment-filters]");
      const list = target.querySelector("[data-payment-list]");
      const render = () => {
        const filters = Object.fromEntries(new FormData(form));
        const filtered = rows.filter((row) => {
          const paymentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.thoi_diem_ghi_nhan));
          const buildingId = row.thanhToan?.hopDong?.phongTro?.ma_can;
          return (!filters.from || paymentDate >= filters.from)
            && (!filters.to || paymentDate <= filters.to)
            && (!filters.building || String(buildingId) === filters.building);
        });
        list.innerHTML = `<div class="bill-room-list">${filtered.map((row, i) => `<div><span><strong>${escapeHtml(row.thanhToan?.hopDong?.phongTro?.so_phong || "Phòng")} · ${escapeHtml(row.thanhToan?.hopDong?.khachThue?.ho_ten || "Khách thuê")}</strong><small>${date(row.thoi_diem_ghi_nhan)} · ${escapeHtml(paymentStatusLabels[row.trang_thai_xac_nhan] || "Trạng thái chưa xác định")}</small></span><span>${money(row.so_tien)} ${row.trang_thai_xac_nhan === "DA_XAC_NHAN" && row.nguon_thanh_toan !== "KHAU_TRU_COC" ? `<button class="btn btn--secondary" data-cancel="${i}">Hủy lần thu</button>` : ""}</span></div>`).join("") || "<p>Không có lần thu phù hợp.</p>"}</div>`;
        list.querySelectorAll("[data-cancel]").forEach((button) => button.onclick = async () => { const row = filtered[Number(button.dataset.cancel)]; const reasonText = await askReason("Lý do hủy lần thu"); if (!reasonText || !await confirmAction("Xác nhận hủy lần thu này?")) return; try { const scope = `cancel:${row.ma_giao_dich}`; const payload = { reason: reasonText }; await context.api.post(`/v1/payments/${row.ma_giao_dich}/cancel`, payload, { "Idempotency-Key": keys.keyFor(scope, payload) }); keys.complete(scope); await loadPayments(); refresh(); } catch (error) { showToast(error.message, "error"); } });
      };
      form.onsubmit = (event) => { event.preventDefault(); render(); };
      form.onreset = () => setTimeout(render, 0);
      render();
    } catch (error) { target.textContent = error.message; }
  }

  root.querySelector("[data-filter]").onsubmit = (event) => { event.preventDefault(); page = 1; refresh(); };
  root.querySelectorAll('[data-filter] select').forEach((input) => { input.onchange = () => { page = 1; refresh(); }; });
  let searchTimer;
  root.querySelector('[data-filter] [name="search"]').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page = 1; refresh(); }, 350); };
  root.querySelector("[data-create]").onclick = createDialog;
  root.querySelector("[data-schedule]").onclick = scheduleDialog;
  root.querySelector("[data-send]").onclick = () => sendDialog([...selected]);
  root.querySelectorAll(".bill-disclosure").forEach((details) => details.addEventListener("toggle", () => { if (details.open) (details.querySelector("[data-definitions]") ? loadDefinitions : loadPayments)(); }));
  await refresh();
}
