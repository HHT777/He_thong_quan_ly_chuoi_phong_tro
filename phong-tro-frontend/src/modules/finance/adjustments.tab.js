import { shellPage, escapeHtml, money } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import "./adjustments.css";

const currentPeriod = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}`;
};

const query = (values) => new URLSearchParams(Object.entries(values)
  .filter(([, value]) => value !== undefined && value !== null && value !== "")).toString();
const roomOf = (bill) => bill.hopDong?.phongTro?.so_phong || "Phòng chưa rõ";
const tenantOf = (bill) => bill.hopDong?.khachThue?.ho_ten || "Chưa rõ khách thuê";
const periodOf = (bill) => `${String(bill.thang).padStart(2, "0")}/${bill.nam}`;
const billLabel = (bill) => `${roomOf(bill)} · ${tenantOf(bill)} · kỳ ${periodOf(bill)} · còn nợ ${money(bill.so_tien_con_no)}`;

export default {
  id: "adjustments", route: "/finance/adjustments", title: "Điều chỉnh", tabLabel: "Điều chỉnh", group: "finance", order: 44, roles: ["CHU_TRO"],
  render(context) {
    context.main.innerHTML = shellPage("Điều chỉnh phiếu thu", "Ghi nhận khoản tăng hoặc giảm trừ cho một phiếu thu, kèm lý do.");
    const root = context.main.querySelector("[data-content]");
    root.classList.add("adjustment-page");
    root.innerHTML = `
        <form class="panel adjustment-form" data-adjustment-form>
          <div class="adjustment-form__heading"><h2>Điều chỉnh một lần</h2><p>Điều chỉnh được ghi vào chi tiết phiếu và lưu lịch sử.</p></div>
          <div class="adjustment-form__grid">
            <label>Kỳ phiếu<input type="month" name="period" value="${escapeHtml(currentPeriod())}" required></label>
            <label>Phiếu thu<select name="billId" required><option value="">Đang tải phiếu…</option></select></label>
            <label>Loại điều chỉnh<select name="direction"><option value="decrease">Giảm trừ</option><option value="increase">Khoản tăng</option></select></label>
            <label>Số tiền (VND)<input name="amount" type="number" min="1" step="1" inputmode="numeric" placeholder="Nhập số tiền" required></label>
            <label class="adjustment-form__wide">Lý do<textarea name="reason" rows="3" maxlength="1000" placeholder="Nêu rõ lý do điều chỉnh" required></textarea></label>
          </div>
          <div class="adjustment-preview" data-preview aria-live="polite">Chọn phiếu thu để xem số phải thu, đã thu và còn nợ.</div>
          <div class="adjustment-form__actions"><button class="btn btn--primary" type="submit" disabled data-submit>Ghi nhận điều chỉnh</button><span data-message role="status"></span></div>
        </form>
        <section class="panel adjustment-history"><div class="adjustment-history__heading"><h2>Phiếu trong kỳ</h2><span data-count></span></div><div data-list role="region" aria-live="polite">Đang tải danh sách phiếu…</div></section>
    `;

    const form = root.querySelector("[data-adjustment-form]");
    const billSelect = form.elements.namedItem("billId");
    const preview = root.querySelector("[data-preview]");
    let bills = [];

    const selectedBill = () => bills.find((bill) => bill.ma_thanh_toan === billSelect.value);
    const updatePreview = () => {
      const bill = selectedBill();
      const submit = form.querySelector("[data-submit]");
      const amount = Number(form.elements.namedItem("amount").value);
      if (!bill) {
        preview.textContent = "Chọn phiếu thu để xem số phải thu, đã thu và còn nợ.";
        submit.disabled = true;
        return;
      }
      const delta = form.elements.namedItem("direction").value === "decrease" ? -amount : amount;
      const total = Number(bill.tong_phai_tra) + (Number.isFinite(amount) ? delta : 0);
      const paid = Number(bill.tong_da_thanh_toan) || 0;
      const debt = Number(bill.so_tien_con_no) || 0;
      const validAmount = Number.isSafeInteger(amount) && amount > 0;
      const invalidDecrease = delta < 0 && amount > debt;
      const belowPaid = total < paid;
      preview.innerHTML = `<div><span>Phòng / khách</span><strong>${escapeHtml(roomOf(bill))} · ${escapeHtml(tenantOf(bill))}</strong></div>
        <div><span>Phải thu hiện tại</span><strong>${escapeHtml(money(bill.tong_phai_tra))}</strong></div>
        <div><span>Đã thu</span><strong>${escapeHtml(money(paid))}</strong></div>
        <div><span>Còn nợ</span><strong>${escapeHtml(money(debt))}</strong></div>
        <div class="adjustment-preview__result"><span>Sau điều chỉnh</span><strong>${escapeHtml(money(total))} phải thu · ${escapeHtml(money(total - paid))} còn nợ</strong></div>
        ${invalidDecrease ? '<p class="adjustment-error">Mức giảm vượt số còn nợ của phiếu.</p>' : belowPaid ? '<p class="adjustment-error">Tổng mới không được thấp hơn số đã thu.</p>' : ""}`;
      submit.disabled = !validAmount || invalidDecrease || belowPaid;
    };

    async function loadBills() {
      const period = form.elements.namedItem("period").value;
      form.querySelector("[data-submit]").disabled = true;
      billSelect.innerHTML = '<option value="">Đang tải phiếu…</option>';
      root.querySelector("[data-list]").textContent = "Đang tải danh sách phiếu…";
      try {
        const response = await context.api.get(`/khoan-phai-thu?${query({ ky: period, page: 1, limit: 100 })}`);
        bills = Array.isArray(response.data) ? response.data : [];
        billSelect.innerHTML = `<option value="">Chọn phòng / khách / phiếu</option>${bills.map((bill) => `<option value="${escapeHtml(bill.ma_thanh_toan)}">${escapeHtml(billLabel(bill))}</option>`).join("")}`;
        root.querySelector("[data-count]").textContent = `${bills.length} phiếu`;
        root.querySelector("[data-list]").innerHTML = bills.length
          ? `<div class="adjustment-list">${bills.map((bill) => `<button type="button" class="adjustment-list__row" data-bill="${escapeHtml(bill.ma_thanh_toan)}"><strong>Phòng ${escapeHtml(roomOf(bill))}</strong><span>${escapeHtml(tenantOf(bill))}</span><span>Kỳ ${escapeHtml(periodOf(bill))}</span><span>Phải thu ${escapeHtml(money(bill.tong_phai_tra))}</span><span>Còn nợ ${escapeHtml(money(bill.so_tien_con_no))}</span></button>`).join("")}</div>`
          : '<p class="adjustment-empty">Không có phiếu thu trong kỳ này.</p>';
        root.querySelectorAll("[data-bill]").forEach((button) => button.addEventListener("click", () => {
          billSelect.value = button.dataset.bill;
          updatePreview();
          form.scrollIntoView({ behavior: "smooth", block: "start" });
          form.elements.namedItem("direction").focus();
        }));
        updatePreview();
      } catch (error) {
        bills = [];
        billSelect.innerHTML = '<option value="">Không tải được phiếu</option>';
        root.querySelector("[data-list]").innerHTML = `<p class="adjustment-error">Không tải được danh sách phiếu: ${escapeHtml(error.message)}</p><button class="btn btn--secondary" type="button" data-retry>Tải lại</button>`;
        root.querySelector("[data-retry]")?.addEventListener("click", loadBills);
        updatePreview();
      }
    }

    form.elements.namedItem("period").addEventListener("change", loadBills);
    billSelect.addEventListener("change", updatePreview);
    form.elements.namedItem("direction").addEventListener("change", updatePreview);
    form.elements.namedItem("amount").addEventListener("input", updatePreview);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const bill = selectedBill();
      const amount = Number(form.elements.namedItem("amount").value);
      const reason = form.elements.namedItem("reason").value.trim();
      if (!bill || !Number.isSafeInteger(amount) || amount <= 0 || !reason) return;
      const delta = form.elements.namedItem("direction").value === "decrease" ? -amount : amount;
      const submit = form.querySelector("[data-submit]");
      const message = form.querySelector("[data-message]");
      submit.disabled = true;
      message.textContent = "Đang ghi nhận…";
      try {
        await context.api.post(`/v1/bills/${encodeURIComponent(bill.ma_thanh_toan)}/adjustments`, { delta, reason });
        showToast("Đã ghi nhận điều chỉnh.", "success");
        message.textContent = "Đã ghi nhận điều chỉnh.";
        form.elements.namedItem("amount").value = "";
        form.elements.namedItem("reason").value = "";
        await loadBills();
        billSelect.value = bill.ma_thanh_toan;
        updatePreview();
      } catch (error) {
        message.textContent = error.message;
        showToast(error.message, "error");
        updatePreview();
      }
    });

    loadBills();
  },
};
