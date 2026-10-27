import { date, escapeHtml, money, openFormModal, shellPage } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import "./payments.css";

const listEndpoint = "/khoan-phai-thu/payment/list?limit=100";
const paymentPath = (row) => `/khoan-phai-thu/payment/${encodeURIComponent(row.ma_giao_dich)}/confirm`;
const roomOf = (row) => row.thanhToan?.hopDong?.phongTro;
const buildingOf = (row) => roomOf(row)?.canTro;
const statusText = (status) => ({ CHO_XAC_NHAN: "Chờ xác nhận", DA_XAC_NHAN: "Đã xác nhận", DA_HUY: "Đã hủy", TU_CHOI: "Từ chối" }[status] || status || "—");

async function loadRows(context) {
  const response = await context.api.get(`${listEndpoint}&page=1`);
  const rows = Array.isArray(response.data) ? [...response.data] : [];
  for (let page = 2; response.pagination?.hasNext; page += 1) {
    const next = await context.api.get(`${listEndpoint}&page=${page}`);
    rows.push(...(next.data || []));
    response.pagination = next.pagination;
  }
  return rows;
}

async function loadPayableBills(context) {
  const endpoint = "/khoan-phai-thu?issuance=SENT&limit=100";
  const first = await context.api.get(`${endpoint}&page=1`);
  const bills = Array.isArray(first.data) ? [...first.data] : [];
  let pagination = first.pagination;
  for (let page = 2; pagination?.hasNext; page += 1) {
    const next = await context.api.get(`${endpoint}&page=${page}`);
    bills.push(...(next.data || []));
    pagination = next.pagination;
  }
  return bills.filter((bill) => bill.da_gui && Number(bill.so_tien_con_no) > 0);
}

function paymentBillLabel(bill) {
  const room = bill.hopDong?.phongTro?.so_phong || "Chưa rõ phòng";
  const tenant = bill.hopDong?.khachThue?.ho_ten || "Chưa rõ khách";
  const period = `${String(bill.thang).padStart(2, "0")}/${bill.nam}`;
  return `Phòng ${room} · ${tenant} · Kỳ ${period} · Còn ${money(bill.so_tien_con_no)}`;
}

function todayLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function renderRows(rows, selected, buildingId) {
  const filtered = buildingId === "ALL" ? rows : rows.filter((row) => buildingOf(row)?.ma_can === buildingId);
  const pending = filtered.filter((row) => row.trang_thai_xac_nhan === "CHO_XAC_NHAN");
  const allPendingSelected = pending.length > 0 && pending.every((row) => selected.has(row.ma_giao_dich));
  const body = filtered.map((row) => {
    const room = roomOf(row);
    const building = buildingOf(row);
    const note = row.khoanThu?.ghi_chu || row.ly_do_huy || "—";
    const checked = selected.has(row.ma_giao_dich) ? "checked" : "";
    const pendingCheckbox = row.trang_thai_xac_nhan === "CHO_XAC_NHAN"
      ? `<input type="checkbox" aria-label="Chọn giao dịch ${escapeHtml(row.ma_giao_dich)}" data-select-payment="${escapeHtml(row.ma_giao_dich)}" ${checked}>`
      : "";
    const action = row.trang_thai_xac_nhan === "CHO_XAC_NHAN"
      ? `<button class="btn btn--secondary" data-confirm-payment="${escapeHtml(row.ma_giao_dich)}">Xác nhận</button>`
      : row.trang_thai_xac_nhan === "DA_XAC_NHAN" && row.nguon_thanh_toan === "THU_TIEN"
        ? `<button class="btn btn--secondary" data-cancel-payment="${escapeHtml(row.ma_giao_dich)}">Hủy xác nhận</button>`
        : "—";
    return `<tr>
      <td>${pendingCheckbox}</td>
      <td>${escapeHtml(building?.ten_can || "—")}</td>
      <td>${escapeHtml(room?.so_phong ? `Phòng ${room.so_phong}` : "—")}</td>
      <td>${escapeHtml(row.thanhToan?.hopDong?.khachThue?.ho_ten || "—")}</td>
      <td>${money(row.so_tien)}</td>
      <td>${escapeHtml(date(row.thoi_diem_ghi_nhan))}</td>
      <td><span class="badge badge--neutral">${escapeHtml(statusText(row.trang_thai_xac_nhan))}</span></td>
      <td class="payment-note" title="${escapeHtml(note)}">${escapeHtml(note)}</td>
      <td><div class="table-actions">${action}</div></td>
    </tr>`;
  }).join("");
  return { filtered, pending, allPendingSelected, body };
}

export default {
  id: "payments", route: "/finance/payments", title: "Thanh toán", tabLabel: "Thanh toán", group: "finance", order: 41, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Thanh toán", "Quản lý thanh toán và xác nhận minh chứng.");
    const content = context.main.querySelector("[data-content]");
    const selected = new Set();

    const refresh = async (keepBuilding = true) => {
      try {
        const rows = await loadRows(context);
        const buildings = [...new Map(rows.map((row) => buildingOf(row)).filter((building) => building?.ma_can).map((building) => [building.ma_can, building])).values()]
          .sort((a, b) => String(a.ten_can).localeCompare(String(b.ten_can), "vi"));
        const currentBuilding = keepBuilding ? content.querySelector("[data-building-filter]")?.value || "ALL" : "ALL";
        const safeBuilding = buildings.some((building) => building.ma_can === currentBuilding) ? currentBuilding : "ALL";
        const rendered = renderRows(rows, selected, safeBuilding);
        content.innerHTML = `
          <div class="panel payment-list-panel">
            <div class="mgmt-toolbar">
              <div class="mgmt-toolbar-left">
                <label class="payment-filter-label" for="paymentBuildingFilter">Căn</label>
                <select class="mgmt-filter-select" id="paymentBuildingFilter" data-building-filter>
                  <option value="ALL">Tất cả căn</option>
                  ${buildings.map((building) => `<option value="${escapeHtml(building.ma_can)}" ${safeBuilding === building.ma_can ? "selected" : ""}>${escapeHtml(building.ten_can)}</option>`).join("")}
                </select>
                <span class="payment-count">${rendered.filtered.length} giao dịch · ${rendered.pending.length} chờ xác nhận</span>
              </div>
              <div class="mgmt-toolbar-right payment-toolbar-actions">
                <button class="btn btn--primary" type="button" data-confirm-selected ${rendered.pending.length ? "" : "disabled"}>Xác nhận thanh toán</button>
                <button class="btn btn--secondary" type="button" data-create-payment>Ghi nhận thanh toán</button>
              </div>
            </div>
            <div class="table-wrap">
              <table class="payment-table">
                <thead><tr>
                  <th><input type="checkbox" aria-label="Chọn tất cả giao dịch chờ xác nhận" data-select-all ${rendered.allPendingSelected ? "checked" : ""} ${rendered.pending.length ? "" : "disabled"}></th>
                  <th>Căn</th><th>Phòng</th><th>Khách thuê</th><th>Số tiền</th><th>Thời điểm</th><th>Trạng thái</th><th>Ghi chú</th><th>Thao tác</th>
                </tr></thead>
                <tbody>${rendered.body || `<tr><td colspan="9" class="payment-empty">Chưa có giao dịch thanh toán.</td></tr>`}</tbody>
              </table>
            </div>
          </div>`;

        content.querySelector("[data-building-filter]")?.addEventListener("change", () => {
          selected.clear();
          void refresh();
        });
        content.querySelector("[data-select-all]")?.addEventListener("change", (event) => {
          if (event.target.checked) rendered.pending.forEach((row) => selected.add(row.ma_giao_dich));
          else rendered.pending.forEach((row) => selected.delete(row.ma_giao_dich));
          void refresh();
        });
        content.querySelectorAll("[data-select-payment]").forEach((checkbox) => checkbox.addEventListener("change", () => {
          if (checkbox.checked) selected.add(checkbox.dataset.selectPayment);
          else selected.delete(checkbox.dataset.selectPayment);
          void refresh();
        }));
        content.querySelectorAll("[data-confirm-payment]").forEach((button) => button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await context.api.post(paymentPath({ ma_giao_dich: button.dataset.confirmPayment }), {});
            selected.delete(button.dataset.confirmPayment);
            showToast("Đã xác nhận thanh toán.", "success");
            await refresh();
          } catch (error) { showToast(error.message, "error"); button.disabled = false; }
        }));
        content.querySelector("[data-confirm-selected]")?.addEventListener("click", async () => {
          const ids = rendered.pending.filter((row) => selected.has(row.ma_giao_dich)).map((row) => row.ma_giao_dich);
          if (!ids.length) { showToast("Chọn ít nhất một giao dịch đang chờ.", "error"); return; }
          const button = content.querySelector("[data-confirm-selected]");
          button.disabled = true;
          let confirmed = 0;
          const failures = [];
          for (const id of ids) {
            try { await context.api.post(paymentPath({ ma_giao_dich: id }), {}); confirmed += 1; selected.delete(id); }
            catch (error) { failures.push(error.message); }
          }
          showToast(failures.length ? `Đã xác nhận ${confirmed}/${ids.length}; ${failures.length} giao dịch chưa xử lý.` : `Đã xác nhận ${confirmed} giao dịch.`, failures.length ? "error" : "success");
          await refresh();
        });
        content.querySelectorAll("[data-cancel-payment]").forEach((button) => button.addEventListener("click", () => {
          const row = rows.find((item) => item.ma_giao_dich === button.dataset.cancelPayment);
          if (!row) return;
          openFormModal({
            title: "Hủy xác nhận thanh toán",
            fields: [{ name: "reason", label: "Lý do (chỉ hủy khi chưa nhận tiền; công nợ sẽ được cập nhật lại)", type: "textarea", required: true }],
            submitLabel: "Hủy xác nhận",
            submit: async ({ reason }) => {
              await context.api.post(`/v1/payments/${encodeURIComponent(row.ma_giao_dich)}/cancel`, { reason });
              selected.delete(row.ma_giao_dich);
              await refresh();
            },
          });
        }));
        content.querySelector("[data-create-payment]")?.addEventListener("click", async () => {
          const button = content.querySelector("[data-create-payment]");
          button.disabled = true;
          try {
            const bills = await loadPayableBills(context);
            if (!bills.length) {
              showToast("Hiện không có phiếu đã gửi còn khoản phải thu.", "error");
              return;
            }
            const billOptions = bills.map((bill) => ({ value: bill.ma_thanh_toan, label: paymentBillLabel(bill) }));
            openFormModal({
              title: "Ghi nhận thanh toán",
              fields: [
                { name: "ma_khoan_phai_thu", label: "Phiếu cần thu", options: billOptions, required: true },
                { name: "ngay_thanh_toan", label: "Ngày nhận tiền", type: "date", required: true },
                { name: "so_tien", label: "Số tiền nhận", type: "number", required: true },
                { name: "phuong_thuc", label: "Phương thức", options: [{ value: "Tiền mặt", label: "Tiền mặt" }, { value: "Chuyển khoản", label: "Chuyển khoản" }], required: true },
                { name: "ghi_chu", label: "Ghi chú (không bắt buộc)" },
              ],
              initial: {
                ma_khoan_phai_thu: bills[0].ma_thanh_toan,
                ngay_thanh_toan: todayLocal(),
                so_tien: Number(bills[0].so_tien_con_no),
                phuong_thuc: "Tiền mặt",
              },
              onOpen: ({ form }) => {
                const billSelect = form.elements.namedItem("ma_khoan_phai_thu");
                const amountInput = form.elements.namedItem("so_tien");
                billSelect.addEventListener("change", () => {
                  const selectedBill = bills.find((bill) => bill.ma_thanh_toan === billSelect.value);
                  if (selectedBill) amountInput.value = Number(selectedBill.so_tien_con_no);
                });
              },
              submitLabel: "Ghi nhận",
              submit: async (raw) => {
                const note = raw.ghi_chu?.trim();
                await context.api.post("/khoan-phai-thu/payment/create", {
                  ...raw,
                  so_tien: Number(raw.so_tien),
                  ghi_chu: note ? `${raw.phuong_thuc} · ${note}` : undefined,
                }, { "Idempotency-Key": crypto.randomUUID() });
                await refresh();
              },
            });
          } catch (error) { showToast(error.message, "error"); }
          finally { button.disabled = false; }
        });
      } catch (error) {
        content.innerHTML = `<div class="empty-state empty-state--error"><h4 class="empty-state__title">Không tải được thanh toán</h4><p class="empty-state__desc">${escapeHtml(error.message)}</p><button class="btn btn--secondary" data-retry>Thử lại</button></div>`;
        content.querySelector("[data-retry]")?.addEventListener("click", () => void refresh());
      }
    };
    await refresh(false);
  },
};
