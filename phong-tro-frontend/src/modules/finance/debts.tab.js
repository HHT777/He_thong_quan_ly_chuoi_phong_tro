import { shellPage, escapeHtml, money } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import { createRequestKeyStore, integerVnd, requiredText } from "../../core/idempotency.js";
import "./debts.css";

const meta = { id: "debts", route: "/finance/debts", title: "Công nợ", tabLabel: "Công nợ", group: "finance", order: 42, roles: ["CHU_TRO"] };
const requestKeys = createRequestKeyStore();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const isPostLiquidation = (row) => row.debtGroup?.type === "SAU_THANH_LY" || row.loai_thanh_toan === "SAU_THANH_LY";

function buildingId(row) { return String(row.debtGroup?.buildingId || row.hopDong?.phongTro?.ma_can || ""); }
function sortDebts(rows, buildingNames) {
  return [...rows].sort((a, b) => {
    const byBuilding = (buildingNames.get(buildingId(a)) || "").localeCompare(buildingNames.get(buildingId(b)) || "", "vi");
    if (byBuilding) return byBuilding;
    const byRoom = String(a.hopDong?.phongTro?.so_phong || "").localeCompare(String(b.hopDong?.phongTro?.so_phong || ""), "vi", { numeric: true });
    if (byRoom) return byRoom;
    const byTenant = String(a.hopDong?.khachThue?.ho_ten || "").localeCompare(String(b.hopDong?.khachThue?.ho_ten || ""), "vi");
    return byTenant || Number(a.nam) - Number(b.nam) || Number(a.thang) - Number(b.thang);
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

  const refresh = async () => {
    content.innerHTML = `<div class="panel">Đang tải công nợ...</div>`;
    try {
      const [debtResponse, buildingResponse] = await Promise.all([
        context.api.get("/v1/debt"),
        context.api.get("/management/can-tro"),
      ]);
      debts = Array.isArray(debtResponse.data) ? debtResponse.data : [];
      const buildings = Array.isArray(buildingResponse.data) ? buildingResponse.data : [];
      const buildingNames = new Map(buildings.map((row) => [String(row.ma_can), row.ten_can]));
      content.innerHTML = `<div class="debt-toolbar panel">
        <label>Căn<select data-building-filter><option value="">Tất cả căn</option>${buildings.map((row) => `<option value="${escapeHtml(row.ma_can)}">${escapeHtml(row.ten_can || "Căn trọ")}</option>`).join("")}</select></label>
        <span data-debt-count></span>
      </div>
      <section class="panel debt-list"><div class="table-wrap"><table><thead><tr><th>Căn</th><th>Phòng</th><th>Khách thuê</th><th>Kỳ</th><th>Tuổi nợ</th><th>Trạng thái</th><th>Còn nợ</th><th>Thao tác</th></tr></thead><tbody data-debt-rows></tbody></table></div></section>
      <div class="debt-workspace" data-debt-workspace></div>`;
      const filter = content.querySelector("[data-building-filter]");
      const paintRows = () => {
        const selectedBuilding = filter.value;
        const visibleRows = sortDebts(debts.filter((row) => !selectedBuilding || buildingId(row) === selectedBuilding), buildingNames);
        content.querySelector("[data-debt-count]").textContent = `${visibleRows.length} khoản nợ`;
        content.querySelector("[data-debt-rows]").innerHTML = visibleRows.map((row) => {
          const postLiquidation = isPostLiquidation(row);
          const building = buildingNames.get(buildingId(row)) || "—";
          const room = row.hopDong?.phongTro?.so_phong || "—";
          const tenant = row.hopDong?.khachThue?.ho_ten || "—";
          const period = `${String(row.thang || "—").padStart(2, "0")}/${row.nam || "—"}`;
          const status = postLiquidation ? "Sau thanh lý" : (row.isOverdue ? "Quá hạn" : "Trong hạn");
          return `<tr><td>${escapeHtml(building)}</td><td>${escapeHtml(room)}</td><td>${escapeHtml(tenant)}</td><td>${escapeHtml(period)}</td><td>${postLiquidation ? "—" : `${escapeHtml(row.debtAgeDays ?? 0)} ngày`}</td><td><span class="debt-status ${postLiquidation ? "debt-status--closed" : row.isOverdue ? "debt-status--overdue" : "debt-status--current"}">${status}</span></td><td class="debt-amount">${money(row.so_tien_con_no)}</td><td><button class="btn btn--primary" data-pay-debt="${debts.indexOf(row)}">Ghi nhận thu</button></td></tr>`;
        }).join("") || '<tr><td class="debt-empty" colspan="8">Không có khoản nợ.</td></tr>';
        bindPayments();
      };
      filter.addEventListener("change", () => {
        content.querySelector("[data-debt-workspace]").replaceChildren();
        paintRows();
      });
      paintRows();
    } catch (error) {
      content.innerHTML = `<div class="empty-state empty-state--error"><h4 class="empty-state__title">Không tải được công nợ</h4><p class="empty-state__desc">${escapeHtml(error.message)}</p></div>`;
    }
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
