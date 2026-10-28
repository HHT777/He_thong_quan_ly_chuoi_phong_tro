import { shellPage, escapeHtml, money } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import { createRequestKeyStore, integerVnd, requiredText } from "../../core/idempotency.js";
import "./debts.css";

const meta = { id: "debts", route: "/finance/debts", title: "Công nợ", tabLabel: "Công nợ", group: "finance", order: 42, roles: ["CHU_TRO"] };
const requestKeys = createRequestKeyStore();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const isPostLiquidation = (row) => row.debtGroup?.type === "SAU_THANH_LY" || row.loai_thanh_toan === "SAU_THANH_LY";

function buildingId(row) { return String(row.debtGroup?.buildingId || row.hopDong?.phongTro?.ma_can || ""); }
function sortDebts(rows, buildingNames, mode = "room") {
  const byRoom = (a, b) => {
    const byBuilding = (buildingNames.get(buildingId(a)) || "").localeCompare(buildingNames.get(buildingId(b)) || "", "vi");
    if (byBuilding) return byBuilding;
    const byRoom = String(a.hopDong?.phongTro?.so_phong || "").localeCompare(String(b.hopDong?.phongTro?.so_phong || ""), "vi", { numeric: true });
    if (byRoom) return byRoom;
    const byTenant = String(a.hopDong?.khachThue?.ho_ten || "").localeCompare(String(b.hopDong?.khachThue?.ho_ten || ""), "vi");
    return byTenant || Number(a.nam) - Number(b.nam) || Number(a.thang) - Number(b.thang);
  };
  const period = (row) => Number(row.nam || 0) * 12 + Number(row.thang || 0);
  return [...rows].sort((a, b) => {
    if (mode === "debt-desc") return Number(b.so_tien_con_no || 0) - Number(a.so_tien_con_no || 0) || byRoom(a, b);
    if (mode === "debt-asc") return Number(a.so_tien_con_no || 0) - Number(b.so_tien_con_no || 0) || byRoom(a, b);
    if (mode === "period-desc") return period(b) - period(a) || byRoom(a, b);
    if (mode === "period-asc") return period(a) - period(b) || byRoom(a, b);
    return byRoom(a, b);
  });
}

function conflictAction(target, scope) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn--secondary";
  button.textContent = "Tạo yêu cầu mới";
  button.addEventListener("click", () => {
    requestKeys.renew(scope);
    target.textContent = "Đã tạo khóa mới; bạn có thể gửi lại.";
  });
  target.append(" ", button);
}

async function render(context) {
  context.main.innerHTML = shellPage("Công nợ", "");
  const content = context.main.querySelector("[data-content]");
  content.innerHTML = `<div class="panel">Đang tải công nợ...</div>`;
  let debts = [];
  const selectedDebtIds = new Set();

  const refresh = async () => {
    content.innerHTML = `<div class="panel">Đang tải công nợ...</div>`;
    try {
      const [debtResponse, buildingResponse] = await Promise.all([
        context.api.get("/v1/debt"),
        context.api.get("/management/can-tro"),
      ]);
      debts = Array.isArray(debtResponse.data) ? debtResponse.data : [];
      const currentDebtIds = new Set(debts.map((row) => String(row.ma_thanh_toan)));
      for (const id of selectedDebtIds) if (!currentDebtIds.has(id)) selectedDebtIds.delete(id);
      const buildings = Array.isArray(buildingResponse.data) ? buildingResponse.data : [];
      const buildingNames = new Map(buildings.map((row) => [String(row.ma_can), row.ten_can]));
      content.innerHTML = `<div class="debt-toolbar panel">
        <div class="debt-toolbar-filters">
          <label>Căn<select data-building-filter><option value="">Tất cả căn</option>${buildings.map((row) => `<option value="${escapeHtml(row.ma_can)}">${escapeHtml(row.ten_can || "Căn trọ")}</option>`).join("")}</select></label>
          <div class="debt-sort"><button type="button" class="btn btn--secondary" aria-haspopup="true">Lọc ▾</button><div class="debt-sort-menu" role="group" aria-label="Lọc và sắp xếp công nợ">
          <button type="button" data-sort="debt-desc">Nợ cao đến thấp</button>
          <button type="button" data-sort="debt-asc">Nợ thấp đến cao</button>
          <button type="button" data-sort="period-desc">Kỳ mới nhất</button>
          <button type="button" data-sort="period-asc">Kỳ cũ nhất</button>
          </div></div>
        </div>
        <div class="debt-toolbar-actions"><span data-debt-count></span><button type="button" class="btn btn--primary" data-bulk-pay hidden>Ghi nhận thu (<span data-selected-count>0</span>)</button></div>
      </div>
      <section class="panel debt-list"><div class="table-wrap"><table><thead><tr><th class="debt-select-cell"><input type="checkbox" data-select-all aria-label="Chọn tất cả khoản nợ đang hiển thị"></th><th>Căn</th><th>Phòng</th><th>Khách thuê</th><th>Kỳ</th><th>Tuổi nợ</th><th>Trạng thái</th><th>Còn nợ</th><th>Thao tác</th></tr></thead><tbody data-debt-rows></tbody></table></div></section>
      <div class="debt-workspace" data-debt-workspace></div>`;
      const filter = content.querySelector("[data-building-filter]");
      let sortMode = "room";
      const paintRows = () => {
        const selectedBuilding = filter.value;
        const visibleRows = sortDebts(debts.filter((row) => !selectedBuilding || buildingId(row) === selectedBuilding), buildingNames, sortMode);
        content.querySelector("[data-debt-count]").textContent = `${visibleRows.length} khoản nợ`;
        content.querySelector("[data-debt-rows]").innerHTML = visibleRows.map((row) => {
          const postLiquidation = isPostLiquidation(row);
          const building = buildingNames.get(buildingId(row)) || "—";
          const room = row.hopDong?.phongTro?.so_phong || "—";
          const tenant = row.hopDong?.khachThue?.ho_ten || "—";
          const period = `${String(row.thang || "—").padStart(2, "0")}/${row.nam || "—"}`;
          const status = postLiquidation ? "Sau thanh lý" : (row.isOverdue ? "Quá hạn" : "Trong hạn");
          const debtId = String(row.ma_thanh_toan);
          return `<tr><td class="debt-select-cell"><input type="checkbox" data-select-debt="${escapeHtml(debtId)}" aria-label="Chọn khoản nợ phòng ${escapeHtml(room)} kỳ ${escapeHtml(period)}" ${selectedDebtIds.has(debtId) ? "checked" : ""}></td><td>${escapeHtml(building)}</td><td>${escapeHtml(room)}</td><td>${escapeHtml(tenant)}</td><td>${escapeHtml(period)}</td><td>${postLiquidation ? "—" : `${escapeHtml(row.debtAgeDays ?? 0)} ngày`}</td><td><span class="debt-status ${postLiquidation ? "debt-status--closed" : row.isOverdue ? "debt-status--overdue" : "debt-status--current"}">${status}</span></td><td class="debt-amount">${money(row.so_tien_con_no)}</td><td><button class="btn btn--primary" data-pay-debt="${debts.indexOf(row)}">Ghi nhận thu</button></td></tr>`;
        }).join("") || '<tr><td class="debt-empty" colspan="9">Không có khoản nợ.</td></tr>';
        const visibleIds = visibleRows.map((row) => String(row.ma_thanh_toan));
        const selectAll = content.querySelector("[data-select-all]");
        selectAll.checked = visibleIds.length > 0 && visibleIds.every((id) => selectedDebtIds.has(id));
        selectAll.indeterminate = visibleIds.some((id) => selectedDebtIds.has(id)) && !selectAll.checked;
        content.querySelector("[data-selected-count]").textContent = String(selectedDebtIds.size);
        content.querySelector("[data-bulk-pay]").hidden = selectedDebtIds.size === 0;
        content.querySelectorAll("[data-select-debt]").forEach((checkbox) => checkbox.addEventListener("change", () => {
          if (checkbox.checked) selectedDebtIds.add(checkbox.dataset.selectDebt);
          else selectedDebtIds.delete(checkbox.dataset.selectDebt);
          paintRows();
        }));
        selectAll.addEventListener("change", () => {
          for (const id of visibleIds) checkboxSet(selectAll.checked, id, selectedDebtIds);
          paintRows();
        });
        bindPayments();
      };
      filter.addEventListener("change", () => {
        content.querySelector("[data-debt-workspace]").replaceChildren();
        paintRows();
      });
      content.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => {
        sortMode = button.dataset.sort;
        const sortMenu = content.querySelector(".debt-sort");
        sortMenu.querySelector(":scope > .btn").textContent = "Lọc ▾";
        content.querySelector("[data-debt-workspace]").replaceChildren();
        paintRows();
      }));
      content.querySelector("[data-bulk-pay]").addEventListener("click", () => openBulkPayment(selectedDebtIds));
      paintRows();
    } catch (error) {
      content.innerHTML = `<div class="empty-state empty-state--error"><h4 class="empty-state__title">Không tải được công nợ</h4><p class="empty-state__desc">${escapeHtml(error.message)}</p></div>`;
    }
  };

  const checkboxSet = (checked, id, selection) => checked ? selection.add(id) : selection.delete(id);

  const openBulkPayment = (selectedDebtIds) => {
    const selectedRows = debts.filter((row) => selectedDebtIds.has(String(row.ma_thanh_toan)));
    if (!selectedRows.length) return;
    const workspace = content.querySelector("[data-debt-workspace]");
    workspace.innerHTML = `<form class="panel form-grid debt-bulk-form" data-bulk-payment-form>
      <h3>Ghi nhận thu ${selectedRows.length} khoản nợ</h3>
      <p>Nhập số tiền thu cho từng phòng. Có thể thu toàn bộ hoặc thu một phần.</p>
      <div class="table-wrap"><table><thead><tr><th>Căn / phòng</th><th>Khách thuê</th><th>Kỳ</th><th>Còn nợ</th><th>Số tiền thu</th></tr></thead><tbody>${selectedRows.map((row) => {
        const room = row.hopDong?.phongTro?.so_phong || "—";
        const building = row.hopDong?.phongTro?.canTro?.ten_can || row.hopDong?.phongTro?.ten_can || "";
        return `<tr data-bulk-row="${escapeHtml(row.ma_thanh_toan)}"><td>${escapeHtml(building ? `${building} · ` : "")}Phòng ${escapeHtml(room)}</td><td>${escapeHtml(row.hopDong?.khachThue?.ho_ten || "Khách thuê")}</td><td>${String(row.thang || "—").padStart(2, "0")}/${escapeHtml(row.nam || "—")}</td><td>${money(row.so_tien_con_no)}</td><td><input name="amount" type="number" min="1" max="${Number(row.so_tien_con_no)}" step="1" value="${Number(row.so_tien_con_no)}" required aria-label="Số tiền thu phòng ${escapeHtml(room)}"></td></tr>`;
      }).join("")}</tbody></table></div>
      <label>Ngày thu<input name="ngay_thanh_toan" type="date" value="${today()}" required></label>
      <label>Phương thức<select name="phuong_thuc" required><option value="TIEN_MAT">Tiền mặt</option><option value="CHUYEN_KHOAN">Chuyển khoản</option></select></label>
      <label>Ghi chú<textarea name="ghi_chu"></textarea></label>
      <div class="debt-bulk-actions"><button type="button" class="btn btn--secondary" data-cancel-bulk>Hủy</button><button class="btn btn--primary">Ghi nhận thu đã chọn</button></div><span data-bulk-payment-message role="status"></span>
    </form>`;
    const form = workspace.querySelector("[data-bulk-payment-form]");
    form.querySelector("[data-cancel-bulk]").addEventListener("click", () => workspace.replaceChildren());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = form.querySelector("[data-bulk-payment-message]");
      const submitButton = form.querySelector(".debt-bulk-actions .btn--primary");
      submitButton.disabled = true;
      const common = Object.fromEntries(new FormData(form));
      let completed = 0;
      let activeScope = "";
      try {
        const payments = selectedRows.map((row) => {
          const debtId = String(row.ma_thanh_toan);
          const rowInput = form.querySelector(`[data-bulk-row="${CSS.escape(debtId)}"] input[name="amount"]`);
          const payload = {
            ma_khoan_phai_thu: row.ma_thanh_toan,
            ngay_thanh_toan: requiredText(common.ngay_thanh_toan, "Ngày thu"),
            so_tien: integerVnd(rowInput.value, "Số tiền thu", { positive: true }),
            phuong_thuc: requiredText(common.phuong_thuc, "Phương thức"),
            ghi_chu: common.ghi_chu?.trim() || undefined,
          };
          if (payload.so_tien > Number(row.so_tien_con_no)) throw new Error(`Số tiền thu phòng ${row.hopDong?.phongTro?.so_phong || ""} vượt quá khoản còn nợ.`);
          return { row, payload, scope: `debt:${row.ma_thanh_toan}` };
        });
        for (const { row, payload, scope } of payments) {
          activeScope = scope;
          await context.api.post("/khoan-phai-thu/payment/create", payload, { "Idempotency-Key": requestKeys.keyFor(scope, payload) });
          requestKeys.complete(scope);
          selectedDebtIds.delete(String(row.ma_thanh_toan));
          completed += 1;
        }
        showToast(`Đã ghi nhận thu ${completed} khoản nợ.`, "success");
        await refresh();
      } catch (error) {
        if (completed) {
          showToast(`Đã ghi nhận ${completed}/${selectedRows.length} khoản. Các khoản còn lại vẫn được chọn để tiếp tục.`, "warning");
          await refresh();
          return;
        }
        message.textContent = error.message;
        submitButton.disabled = false;
        if (error.status === 409 && error.code === "IDEMPOTENCY_CONFLICT") conflictAction(message, activeScope);
      }
    });
  };

  const bindPayments = () => {
    content.querySelectorAll("[data-pay-debt]").forEach((button) => button.addEventListener("click", () => {
      const row = debts[Number(button.dataset.payDebt)];
      if (!row) return;
      const scope = `debt:${row.ma_thanh_toan}`;
      const workspace = content.querySelector("[data-debt-workspace]");
      workspace.innerHTML = `<form class="panel form-grid" data-debt-payment>
        <h3>Ghi nhận thu công nợ</h3>
        <p>${escapeHtml(row.hopDong?.khachThue?.ho_ten || "Khách thuê")} · còn nợ ${money(row.so_tien_con_no)}.</p>
        <label>Ngày thu<input name="ngay_thanh_toan" type="date" value="${today()}" required></label>
        <label>Số tiền<input name="so_tien" type="number" min="1" step="1" required></label>
        <label>Phương thức<select name="phuong_thuc" required><option value="TIEN_MAT">Tiền mặt</option><option value="CHUYEN_KHOAN">Chuyển khoản</option></select></label>
        <label>Ghi chú<textarea name="ghi_chu"></textarea></label>
        <button class="btn btn--primary">Ghi nhận thu</button><span data-payment-message></span>
      </form>`;
      const form = workspace.querySelector("form");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submit = form.querySelector("button");
        const message = form.querySelector("[data-payment-message]");
        submit.disabled = true;
        try {
          const raw = Object.fromEntries(new FormData(form));
          const payload = {
            ma_khoan_phai_thu: row.ma_thanh_toan,
            ngay_thanh_toan: requiredText(raw.ngay_thanh_toan, "Ngày thanh toán"),
            so_tien: integerVnd(raw.so_tien, "Số tiền", { positive: true }),
            phuong_thuc: requiredText(raw.phuong_thuc, "Phương thức"),
            ghi_chu: raw.ghi_chu?.trim() || undefined,
          };
          await context.api.post("/khoan-phai-thu/payment/create", payload, { "Idempotency-Key": requestKeys.keyFor(scope, payload) });
          requestKeys.complete(scope);
          showToast("Đã ghi nhận thu công nợ.", "success");
          await refresh();
        } catch (error) {
          message.textContent = error.message;
          if (error.status === 409 && error.code === "IDEMPOTENCY_CONFLICT") conflictAction(message, scope);
        } finally {
          submit.disabled = false;
        }
      });
    }));
  };

  await refresh();
}

export default { ...meta, render };
