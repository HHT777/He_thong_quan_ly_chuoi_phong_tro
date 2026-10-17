import { shellPage, escapeHtml, money } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import { createRequestKeyStore, integerVnd, requiredText } from "../../core/idempotency.js";

const meta = { id: "debts", route: "/finance/debts", title: "Công nợ", tabLabel: "Công nợ", group: "finance", order: 42, roles: ["CHU_TRO"] };
const requestKeys = createRequestKeyStore();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const isPostLiquidation = (row) => row.debtGroup?.type === "SAU_THANH_LY" || row.loai_thanh_toan === "SAU_THANH_LY";

function debtTable(rows, allRows, { postLiquidation = false } = {}) {
  if (!rows.length) return `<div class="empty-state"><p class="empty-state__desc">Không có khoản nợ trong nhóm này.</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Khách thuê</th><th>Phòng</th><th>Kỳ</th><th>Tuổi nợ</th><th>Quá hạn</th><th>Còn nợ</th><th>Thao tác</th></tr></thead><tbody>${rows.map((row) => `<tr>
    <td>${escapeHtml(row.hopDong?.khachThue?.ho_ten || "—")}</td>
    <td>${escapeHtml(row.hopDong?.phongTro?.so_phong || row.debtGroup?.roomId || "—")}</td>
    <td>${escapeHtml(`${String(row.thang || "—").padStart(2, "0")}/${row.nam || "—"}`)}</td>
    <td>${postLiquidation ? "Không áp dụng" : `${escapeHtml(row.debtAgeDays ?? 0)} ngày`}</td>
    <td>${postLiquidation ? "Nợ sau thanh lý" : (row.isOverdue ? "Đang quá hạn" : "Trong hạn")}</td>
    <td>${money(row.so_tien_con_no)}</td>
    <td><button class="btn btn--primary" data-pay-debt="${allRows.indexOf(row)}">Ghi nhận thu</button></td>
  </tr>`).join("")}</tbody></table></div>`;
}

function groupedPeriodicMarkup(rows, allRows, buildingNames) {
  const groups = new Map();
  for (const row of rows) {
    const group = row.debtGroup || {};
    const key = [group.buildingId, group.roomId, group.tenantId].map((value) => value || "—").join(":");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  if (!groups.size) return `<div class="empty-state"><p class="empty-state__desc">Không có công nợ định kỳ.</p></div>`;
  return [...groups.values()].map((items) => {
    const first = items[0];
    const buildingId = first.debtGroup?.buildingId;
    const building = buildingNames.get(buildingId) || buildingId || "Không xác định";
    const room = first.hopDong?.phongTro?.so_phong || first.debtGroup?.roomId || "—";
    const tenant = first.hopDong?.khachThue?.ho_ten || first.debtGroup?.tenantId || "—";
    return `<article class="panel"><h4>${escapeHtml(building)} · Phòng ${escapeHtml(room)} · ${escapeHtml(tenant)}</h4>${debtTable(items, allRows)}</article>`;
  }).join("");
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
  context.main.innerHTML = shellPage("Công nợ", "Theo dõi công nợ theo căn, phòng và khách; nợ sau thanh lý được tách riêng.");
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
      const buildingNames = new Map(buildings.map((row) => [row.ma_can, row.ten_can]));
      const periodic = debts.filter((row) => !isPostLiquidation(row));
      const postLiquidation = debts.filter(isPostLiquidation);
      content.innerHTML = `<section class="module-stack">
        <div data-debt-workspace></div>
        <section><h3>Công nợ định kỳ</h3><p>Tuổi nợ và cờ quá hạn do server cung cấp.</p>${groupedPeriodicMarkup(periodic, debts, buildingNames)}</section>
        <section class="panel"><h3>Nợ sau thanh lý</h3><p>Nhóm này không tham gia tuổi nợ định kỳ.</p>${debtTable(postLiquidation, debts, { postLiquidation: true })}</section>
      </section>`;
      bindPayments();
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
        <p>${escapeHtml(row.hopDong?.khachThue?.ho_ten || "Khách thuê")} · còn nợ ${money(row.so_tien_con_no)}. Có thể ghi nhận kể cả khi tài khoản khách đã khóa.</p>
        <label>Ngày thanh toán<input name="ngay_thanh_toan" type="date" value="${today()}" required></label>
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
