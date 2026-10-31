import { confirmAction, escapeHtml, openFormModal, shellPage } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import { createRequestKeyStore, integerVnd } from "../../core/idempotency.js";
import { canCancel, canConfirm, ellipsis, paymentBadge, paymentDate, paymentMoney, paymentQuery, paymentStatus } from "./payments.model.mjs";
import "./payments.css";

const keys = createRequestKeyStore();
const paymentPath = (row) => `/khoan-phai-thu/payment/${encodeURIComponent(row.ma_giao_dich)}/confirm`;
const tenantName = (row) => row.thanhToan?.hopDong?.khachThue?.ho_ten || "Không xác định";
const roomOf = (row) => row.thanhToan?.hopDong?.phongTro;
const buildingOf = (row) => roomOf(row)?.canTro;
const labelOf = (row) => `${tenantName(row)} · Phòng ${roomOf(row)?.so_phong || "không xác định"}`;
const noteOf = (row) => row.khoanThu?.ghi_chu || row.ly_do_huy || "Không có ghi chú";
const currentDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

async function allPages(api, base) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const response = await api.get(`${base}${base.includes("?") ? "&" : "?"}limit=100&page=${page}`);
    rows.push(...(response.data || []));
    if (!response.pagination?.hasNext) return rows;
  }
}

function openPaymentDrawer(row, { confirm, cancel }) {
  const previous = document.activeElement;
  const overlay = document.createElement("div");
  const badge = paymentBadge(row);
  const bill = row.thanhToan;
  const period = bill?.thang && bill?.nam ? `${String(bill.thang).padStart(2, "0")}/${bill.nam}` : "Không xác định";
  overlay.className = "payment-drawer-overlay";
  overlay.innerHTML = `<aside class="payment-drawer" role="dialog" aria-modal="true" aria-labelledby="payment-drawer-title">
    <header><h2 id="payment-drawer-title">Chi tiết thanh toán</h2><button type="button" data-close aria-label="Đóng chi tiết">×</button></header>
    <div class="payment-drawer__body">
      <h3>${escapeHtml(tenantName(row))}</h3><p>${escapeHtml(`Phòng ${roomOf(row)?.so_phong || "không xác định"} · ${buildingOf(row)?.ten_can || "Không xác định"}`)}</p>
      <dl><div><dt>Số tiền</dt><dd>${escapeHtml(paymentMoney(row.so_tien))}</dd></div><div><dt>Thời điểm</dt><dd>${escapeHtml(paymentDate(row.thoi_diem_ghi_nhan))}</dd></div>
      <div><dt>Trạng thái</dt><dd><span class="payment-badge payment-badge--${badge.tone}">${badge.icon} ${badge.label}</span></dd></div>
      <div><dt>Nguồn</dt><dd>${row.nguon_thanh_toan === "KHAU_TRU_COC" ? "Khấu trừ cọc" : "Thu tiền"}</dd></div>
      <div><dt>Kỳ phiếu</dt><dd>${escapeHtml(period)}</dd></div><div><dt>Ghi chú</dt><dd>${escapeHtml(noteOf(row))}</dd></div>
      <div><dt>Minh chứng</dt><dd>${row.minh_chung_url ? "Có minh chứng; chưa có đường tải an toàn" : "Chưa có minh chứng"}</dd></div></dl>
    </div><footer>${canConfirm(row) ? '<button class="btn btn--primary" data-confirm>Xác nhận minh chứng</button>' : ""}${canCancel(row) ? '<button class="btn btn--secondary" data-cancel>Hủy giao dịch…</button>' : ""}</footer>
  </aside>`;
  const close = () => { document.removeEventListener("keydown", onKeydown); overlay.remove(); previous?.focus?.(); };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
    if (event.key !== "Tab") return;
    const focusable = [...overlay.querySelectorAll("button:not([disabled])")];
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-close]")) close(); });
  overlay.querySelector("[data-confirm]")?.addEventListener("click", () => confirm(row, close));
  overlay.querySelector("[data-cancel]")?.addEventListener("click", () => cancel(row, close));
  document.addEventListener("keydown", onKeydown);
  document.body.append(overlay);
  overlay.querySelector("[data-close]").focus();
}

function openRecordForm(api, refresh, buildings) {
  return allPages(api, "/khoan-phai-thu?issuance=SENT").then((all) => {
    const bills = all.filter((bill) => bill.da_gui && Number(bill.so_tien_con_no) > 0);
    if (!bills.length) { showToast("Không có phiếu đã gửi còn nợ.", "error"); return; }
    const buildingId = buildings[0]?.ma_can;
    const roomId = bills.find((bill) => bill.hopDong?.phongTro?.ma_can === buildingId)?.hopDong?.phongTro?.ma_phong;
    const first = bills.find((bill) => bill.hopDong?.phongTro?.ma_phong === roomId);
    openFormModal({ title: "Ghi nhận thanh toán", fieldErrors: true, submitLabel: "Ghi nhận", fields: [
      { name: "buildingId", label: "Căn", options: buildings.map((b) => ({ value: b.ma_can, label: b.ten_can })), required: true },
      { name: "roomId", label: "Phòng", options: [{ value: "", label: "Chọn phòng" }], required: true },
      { name: "ma_khoan_phai_thu", label: "Phiếu", options: [{ value: "", label: "Chọn phiếu" }], required: true },
      { name: "ngay_thanh_toan", label: "Ngày nhận tiền", type: "date", required: true },
      { name: "so_tien", label: "Số tiền nhận (đ)", required: true },
      { name: "phuong_thuc", label: "Phương thức", options: [{ value: "Tiền mặt", label: "Tiền mặt" }, { value: "Chuyển khoản", label: "Chuyển khoản" }], required: true },
      { name: "ghi_chu", label: "Ghi chú" },
    ], initial: { buildingId, roomId, ma_khoan_phai_thu: first?.ma_thanh_toan, ngay_thanh_toan: currentDate(), so_tien: first ? Math.round(Number(first.so_tien_con_no)).toLocaleString("vi-VN") : "", phuong_thuc: "Tiền mặt" },
    onOpen: ({ form }) => {
      const building = form.elements.namedItem("buildingId"); const room = form.elements.namedItem("roomId"); const bill = form.elements.namedItem("ma_khoan_phai_thu"); const amount = form.elements.namedItem("so_tien");
      const updateBills = () => {
        const options = bills.filter((item) => item.hopDong?.phongTro?.ma_phong === room.value);
        bill.replaceChildren(new Option("Chọn phiếu", ""), ...options.map((item) => new Option(`Kỳ ${String(item.thang).padStart(2, "0")}/${item.nam} · còn nợ ${paymentMoney(item.so_tien_con_no)}`, item.ma_thanh_toan)));
        bill.value = options.some((item) => item.ma_thanh_toan === bill.value) ? bill.value : options[0]?.ma_thanh_toan || "";
        amount.value = options[0] ? Math.round(Number(options[0].so_tien_con_no)).toLocaleString("vi-VN") : "";
      };
      const updateRooms = () => {
        const options = [...new Map(bills.filter((item) => item.hopDong?.phongTro?.ma_can === building.value).map((item) => [item.hopDong.phongTro.ma_phong, item.hopDong.phongTro])).values()];
        room.replaceChildren(new Option("Chọn phòng", ""), ...options.map((item) => new Option(`Phòng ${item.so_phong}`, item.ma_phong)));
        room.value = options.some((item) => item.ma_phong === room.value) ? room.value : options[0]?.ma_phong || "";
        updateBills();
      };
      building.addEventListener("change", updateRooms); room.addEventListener("change", updateBills);
      bill.addEventListener("change", () => { const chosen = bills.find((item) => item.ma_thanh_toan === bill.value); if (chosen) amount.value = Math.round(Number(chosen.so_tien_con_no)).toLocaleString("vi-VN"); });
      amount.setAttribute("inputmode", "numeric");
      amount.addEventListener("input", () => { const digits = amount.value.replace(/\D/g, ""); amount.value = digits ? Number(digits).toLocaleString("vi-VN") : ""; });
      updateRooms();
    },
    validate: (raw) => {
      const errors = {};
      const selected = bills.find((bill) => bill.ma_thanh_toan === raw.ma_khoan_phai_thu);
      if (!selected || selected.hopDong?.phongTro?.ma_can !== raw.buildingId || selected.hopDong?.phongTro?.ma_phong !== raw.roomId) errors.ma_khoan_phai_thu = "Chọn phiếu hợp lệ.";
      try { const amount = integerVnd(raw.so_tien.replace(/\./g, ""), "Số tiền", { positive: true }); if (selected && amount > Number(selected.so_tien_con_no)) errors.so_tien = "Số tiền vượt số còn nợ."; }
      catch (error) { errors.so_tien = error.message; }
      return { errors };
    },
    onError: (error) => error.status === 409 ? { so_tien: error.message } : { form: error.message },
    submit: async (raw) => {
      const note = raw.ghi_chu?.trim();
      const payload = { ma_khoan_phai_thu: raw.ma_khoan_phai_thu, ngay_thanh_toan: raw.ngay_thanh_toan, so_tien: integerVnd(raw.so_tien.replace(/\./g, ""), "Số tiền", { positive: true }), phuong_thuc: raw.phuong_thuc, ghi_chu: note ? `${raw.phuong_thuc} · ${note}` : undefined };
      const scope = `payment:create:${raw.ma_khoan_phai_thu}`;
      await api.post("/khoan-phai-thu/payment/create", payload, { "Idempotency-Key": keys.keyFor(scope, payload) });
      keys.complete(scope); await refresh();
    } });
  });
}

export default {
  id: "payments", route: "/finance/payments", title: "Thanh toán", tabLabel: "Thanh toán", group: "finance", order: 41, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Thanh toán", "");
    const root = context.main.querySelector("[data-content]");
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const state = { building: params.get("building") || "ALL", status: Object.hasOwn(paymentStatus, params.get("status")) ? params.get("status") : "ALL", page: Math.max(1, Number(params.get("page")) || 1), rows: [], total: 0, selected: new Set(), buildings: [], sequence: 0, controller: null };
    const saveUrl = () => { const url = new URL(window.location.href); const query = new URLSearchParams(); if (state.building !== "ALL") query.set("building", state.building); if (state.status !== "ALL") query.set("status", state.status); if (state.page > 1) query.set("page", String(state.page)); url.hash = `/finance/payments${query.size ? `?${query}` : ""}`; history.replaceState(null, "", url); };
    const cancel = (row, close) => openFormModal({ title: "Hủy giao dịch", fieldErrors: true, submitLabel: "Hủy giao dịch", fields: [{ name: "reason", label: "Lý do (công nợ và khoản thu sẽ cập nhật lại)", type: "textarea", required: true }], validate: ({ reason }) => ({ errors: reason.trim() ? {} : { reason: "Nhập lý do hủy." } }), submit: async ({ reason }) => { await context.api.post(`/v1/payments/${encodeURIComponent(row.ma_giao_dich)}/cancel`, { reason: reason.trim() }); close?.(); showToast(`Đã hủy giao dịch của ${tenantName(row)}.`, "success"); await refresh(); } });
    const confirm = async (row, close) => { if (!await confirmAction(`Xác nhận minh chứng của ${tenantName(row)}? Số tiền sẽ được ghi nhận và công nợ cập nhật.`)) return; try { await context.api.post(paymentPath(row), {}); state.selected.delete(row.ma_giao_dich); close?.(); showToast(`Đã xác nhận minh chứng của ${tenantName(row)}.`, "success"); await refresh(); } catch (error) { showToast(error.message, "error"); } };
    const selectionBar = () => { const target = root.querySelector("[data-selection]"); if (!target) return; target.innerHTML = state.selected.size ? `<span>Đã chọn ${state.selected.size} giao dịch</span><button class="btn btn--primary" data-confirm-selected>Xác nhận đã chọn</button><button class="btn btn--secondary" data-clear-selected>Bỏ chọn</button>` : ""; target.hidden = !state.selected.size; target.querySelector("[data-clear-selected]")?.addEventListener("click", () => { state.selected.clear(); render(); }); target.querySelector("[data-confirm-selected]")?.addEventListener("click", async (event) => { const ids = state.rows.filter((row) => state.selected.has(row.ma_giao_dich) && canConfirm(row)); if (!ids.length) return; if (!await confirmAction(`Xác nhận ${ids.length} minh chứng? Số tiền được ghi nhận và công nợ của từng phiếu sẽ cập nhật.`)) return; event.currentTarget.disabled = true; let success = 0; const failures = []; for (const row of ids) { try { await context.api.post(paymentPath(row), {}); state.selected.delete(row.ma_giao_dich); success += 1; } catch (error) { failures.push(`${labelOf(row)}: ${error.message}`); } } showToast(`Đã xác nhận ${success}/${ids.length}; thất bại ${failures.length}.${failures.length ? ` ${failures.join("; ")}` : ""}`, failures.length ? "error" : "success"); await refresh(); }); };
    const render = () => {
      const start = state.total ? (state.page - 1) * 20 + 1 : 0; const end = Math.min(state.page * 20, state.total);
      const rows = state.rows.map((row) => { const badge = paymentBadge(row); const name = tenantName(row); const location = `Phòng ${roomOf(row)?.so_phong || "không xác định"} · ${buildingOf(row)?.ten_can || "Không xác định"}`; const note = noteOf(row); const id = escapeHtml(row.ma_giao_dich); const select = canConfirm(row) ? `<input type="checkbox" data-select="${id}" aria-label="Chọn giao dịch của ${escapeHtml(name)}" ${state.selected.has(row.ma_giao_dich) ? "checked" : ""}>` : ""; const status = `<span class="payment-badge payment-badge--${badge.tone}">${badge.icon} ${badge.label}</span>${row.nguon_thanh_toan === "KHAU_TRU_COC" ? '<small class="payment-source">Khấu trừ cọc</small>' : ""}`; return `<tr class="${canConfirm(row) ? "payment-row--pending" : ""}" data-row="${id}" tabindex="0"><td>${select}</td><td><strong title="${escapeHtml(name)}">${escapeHtml(ellipsis(name, 38))}</strong><small title="${escapeHtml(location)}">${escapeHtml(ellipsis(location, 44))}</small></td><td class="payment-amount">${escapeHtml(paymentMoney(row.so_tien))}</td><td>${escapeHtml(paymentDate(row.thoi_diem_ghi_nhan))}</td><td>${status}</td><td class="payment-note" title="${escapeHtml(note)}">${escapeHtml(ellipsis(note, 36))}</td><td>${canConfirm(row) ? `<button class="btn btn--secondary" data-open="${id}">Xác nhận</button>` : `<details class="payment-menu"><summary aria-label="Thao tác với giao dịch của ${escapeHtml(name)}">⋯</summary><button data-open="${id}">Xem chi tiết</button>${canCancel(row) ? `<button data-cancel="${id}">Hủy giao dịch…</button>` : ""}</details>`}</td></tr>`; }).join("");
      root.innerHTML = `<div class="payment-page"><header class="payment-heading"><div><h2>Quản lý thanh toán</h2><p>Quản lý các lần thu tiền của khách</p></div><button class="btn btn--primary" data-create>+ Ghi nhận thanh toán</button></header><section class="panel payment-list-panel"><div class="payment-toolbar"><label>Căn <select data-building><option value="ALL">Tất cả căn</option>${state.buildings.map((b) => `<option value="${escapeHtml(b.ma_can)}" ${state.building === b.ma_can ? "selected" : ""}>${escapeHtml(b.ten_can)}</option>`).join("")}</select></label><label>Trạng thái <select data-status><option value="ALL">Tất cả</option>${Object.entries(paymentStatus).map(([value, item]) => `<option value="${value}" ${state.status === value ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label><span>${state.total} giao dịch</span>${state.building !== "ALL" || state.status !== "ALL" ? '<button class="btn btn--secondary" data-clear-filter>Xóa lọc</button>' : ""}</div><div class="payment-table-wrap"><table class="payment-table"><caption class="payment-sr-only">Danh sách giao dịch thanh toán</caption><thead><tr><th><input type="checkbox" data-select-all aria-label="Chọn tất cả giao dịch chờ xác nhận đang hiển thị" ${state.rows.some(canConfirm) ? "" : "disabled"} ${state.rows.filter(canConfirm).length && state.rows.filter(canConfirm).every((row) => state.selected.has(row.ma_giao_dich)) ? "checked" : ""}></th><th>Khách thuê</th><th>Số tiền</th><th>Thời điểm</th><th>Trạng thái</th><th>Ghi chú</th><th>Thao tác</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="payment-empty">Không có giao dịch thanh toán trong phạm vi này.</td></tr>`}</tbody></table></div><div class="payment-cards">${state.rows.map((row) => { const badge = paymentBadge(row); return `<article class="payment-card"><strong>${escapeHtml(tenantName(row))}</strong><b>${escapeHtml(paymentMoney(row.so_tien))}</b><span class="payment-badge payment-badge--${badge.tone}">${badge.icon} ${badge.label}</span>${canConfirm(row) ? `<input type="checkbox" data-select="${escapeHtml(row.ma_giao_dich)}" aria-label="Chọn giao dịch của ${escapeHtml(tenantName(row))}" ${state.selected.has(row.ma_giao_dich) ? "checked" : ""}>` : ""}<button data-open="${escapeHtml(row.ma_giao_dich)}">Xem chi tiết</button></article>`; }).join("")}</div><nav class="payment-pagination"><span>${start}–${end} / ${state.total}</span><button class="btn btn--secondary" data-prev ${state.page <= 1 ? "disabled" : ""}>Trước</button><button class="btn btn--secondary" data-next ${end >= state.total ? "disabled" : ""}>Sau</button></nav></section><div class="payment-selection" data-selection hidden></div></div>`;
      selectionBar();
      root.querySelector("[data-building]").onchange = (event) => { state.building = event.target.value; state.page = 1; state.selected.clear(); showToast("Đã bỏ chọn khi đổi bộ lọc.", "info"); saveUrl(); void refresh(); };
      root.querySelector("[data-status]").onchange = (event) => { state.status = event.target.value; state.page = 1; state.selected.clear(); saveUrl(); void refresh(); };
      root.querySelector("[data-clear-filter]")?.addEventListener("click", () => { state.building = "ALL"; state.status = "ALL"; state.page = 1; state.selected.clear(); saveUrl(); void refresh(); });
      root.querySelector("[data-prev]").onclick = () => { state.page -= 1; state.selected.clear(); saveUrl(); void refresh(); };
      root.querySelector("[data-next]").onclick = () => { state.page += 1; state.selected.clear(); saveUrl(); void refresh(); };
      root.querySelector("[data-create]").onclick = () => void openRecordForm(context.api, refresh, state.buildings).catch((error) => showToast(error.message, "error"));
      root.querySelector("[data-select-all]").onchange = (event) => { state.rows.filter(canConfirm).forEach((row) => event.target.checked ? state.selected.add(row.ma_giao_dich) : state.selected.delete(row.ma_giao_dich)); render(); };
      root.querySelectorAll("[data-select]").forEach((input) => { input.onchange = () => { if (input.checked) state.selected.add(input.dataset.select); else state.selected.delete(input.dataset.select); selectionBar(); }; });
      const find = (id) => state.rows.find((row) => row.ma_giao_dich === id);
      root.querySelectorAll("[data-open]").forEach((button) => { button.onclick = (event) => { event.stopPropagation(); const row = find(button.dataset.open); if (row) openPaymentDrawer(row, { confirm, cancel }); }; });
      root.querySelectorAll("[data-cancel]").forEach((button) => { button.onclick = (event) => { event.stopPropagation(); const row = find(button.dataset.cancel); if (row && canCancel(row)) cancel(row); }; });
      root.querySelectorAll("[data-row]").forEach((tr) => { tr.onclick = (event) => { if (event.target.closest("button,input,details,summary")) return; const row = find(tr.dataset.row); if (row) openPaymentDrawer(row, { confirm, cancel }); }; tr.onkeydown = (event) => { if (event.target === tr && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); tr.click(); } }; });
    };
    const refresh = async () => {
      state.controller?.abort(); const controller = new AbortController(); state.controller = controller; const sequence = ++state.sequence;
      root.querySelector(".payment-list-panel")?.classList.add("payment-is-loading");
      try {
        const response = await context.api.request(paymentQuery(state), { signal: controller.signal });
        if (sequence !== state.sequence) return;
        state.rows = Array.isArray(response.data) ? response.data : []; state.total = Number(response.pagination?.total ?? response.total ?? state.rows.length);
        state.selected = new Set([...state.selected].filter((id) => state.rows.some((row) => row.ma_giao_dich === id && canConfirm(row)))); render();
      } catch (error) { if (controller.signal.aborted || sequence !== state.sequence) return; root.innerHTML = '<div class="empty-state empty-state--error"><h4>Không tải được thanh toán</h4><p>Không thể tải danh sách. Vui lòng thử lại.</p><button class="btn btn--secondary" data-retry>Thử lại</button></div>'; root.querySelector("[data-retry]").onclick = refresh; }
    };
    root.innerHTML = '<div class="panel payment-list-panel"><div class="payment-skeleton" aria-label="Đang tải giao dịch"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>';
    try { state.buildings = await allPages(context.api, "/management/can-tro"); await refresh(); }
    catch (error) { root.innerHTML = '<div class="empty-state empty-state--error"><h4>Không tải được thanh toán</h4><p>Không thể tải danh sách. Vui lòng thử lại.</p><button class="btn btn--secondary" data-retry>Thử lại</button></div>'; root.querySelector("[data-retry]").onclick = () => void this.render(context); }
  },
};
