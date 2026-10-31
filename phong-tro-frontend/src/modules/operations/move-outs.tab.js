import { shellPage, escapeHtml, money, date, confirmAction } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import { createRequestKeyStore, integerVnd, requiredText } from "../../core/idempotency.js";
import { loadAllPages } from "./incident-form.mjs";
import { actionableMoveOutRequests } from "./move-outs.model.mjs";
import "./move-outs.css";

const meta = { id: "move-outs", route: "/operations/move-outs", title: "Trả phòng & thanh lý", tabLabel: "Trả phòng", group: "move-outs", order: 52, roles: ["CHU_TRO"] };
const requestKeys = createRequestKeyStore();
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

function contextMarkup(data) {
  const assets = data.assets || [];
  const incidents = data.pendingIncidentCharges || [];
  const violations = data.violations || [];
  return `
    <section class="panel settlement-card" data-settlement-context>
      <header class="settlement-card__heading"><div><span class="settlement-eyebrow">ĐANG XỬ LÝ</span><h2>Thông tin quyết toán</h2></div><span class="settlement-room">Phòng ${escapeHtml(data.room?.so_phong || "—")}</span></header>
      <div class="settlement-summary">
        <div><span>Khách thuê</span><strong>${escapeHtml(data.tenant?.ho_ten || "—")}</strong></div>
        <div><span>Tiền cọc</span><strong>${money(data.deposit?.so_tien_coc)}</strong></div>
        <div><span>Công nợ hiện tại</span><strong>${money(data.outstandingDebt)}</strong></div>
        <div><span>Chỉ số điện gần nhất</span><strong>${escapeHtml(data.latestElectricityReading?.chi_so_moi ?? "—")}</strong></div>
        <div><span>Ngày trả đã duyệt</span><strong>${date(data.approvedMoveOutDate)}</strong></div>
      </div>
      <div class="settlement-note"><strong>Lưu ý:</strong> Tiền điện cuối kỳ, tiền phòng tháng lẻ, khoản trả trước và kết quả cọc/công nợ sẽ do hệ thống tính khi quyết toán.</div>
      <form data-settlement-form>
        <section class="settlement-section"><div class="settlement-section__heading"><span>01</span><div><h3>Kiểm tra phòng</h3><p>Ghi nhận hiện trạng và chốt chỉ số điện trước khi trả phòng.</p></div></div>
          <div class="settlement-fields">
            <label>Ngày kiểm tra<input name="inspectionDate" type="date" value="${localToday()}" required></label>
            <label>Chỉ số điện cuối<input name="finalElectricityReading" type="number" min="0" step="1" placeholder="Nhập chỉ số cuối" required></label>
            <label class="settlement-fields__wide">Tình trạng phòng<textarea name="roomCondition" rows="3" placeholder="Mô tả tình trạng phòng khi bàn giao" required></textarea></label>
          </div>
        </section>
        <section class="settlement-section"><div class="settlement-section__heading"><span>02</span><div><h3>Kiểm kê tài sản</h3><p>Chọn tài sản hỏng hoặc mất, nhập số lượng và mức bồi thường.</p></div></div>
          <div class="settlement-table-wrap"><table class="settlement-table"><thead><tr><th>Tài sản</th><th>Hỏng / mất</th><th>Số lượng</th><th>Bồi thường (VND)</th><th>Lý do</th></tr></thead><tbody>
            ${assets.map((asset) => `<tr data-asset-row data-asset-id="${escapeHtml(asset.ma_tai_san)}"><td><strong>${escapeHtml(asset.ten_tai_san)}</strong></td><td><input data-asset-selected type="checkbox" aria-label="Đánh dấu ${escapeHtml(asset.ten_tai_san)} hỏng hoặc mất"></td><td><input data-asset-quantity type="number" min="1" step="1" value="1" aria-label="Số lượng ${escapeHtml(asset.ten_tai_san)}"></td><td><input data-asset-amount type="number" min="0" step="1" value="0" aria-label="Tiền bồi thường ${escapeHtml(asset.ten_tai_san)}"></td><td><input data-asset-reason placeholder="Lý do" aria-label="Lý do ${escapeHtml(asset.ten_tai_san)}"></td></tr>`).join("") || "<tr><td colspan='5' class='settlement-empty'>Phòng chưa có tài sản cần kiểm kê.</td></tr>"}
          </tbody></table></div>
        </section>
        <section class="settlement-section"><div class="settlement-section__heading"><span>03</span><div><h3>Khoản khấu trừ</h3><p>Khoản sự cố được hệ thống tính tự động; có thể ghi thêm khấu trừ khác.</p></div></div>
          <div class="settlement-pending"><strong>Khoản khách chịu đang chờ</strong><span>${incidents.length} sự cố · ${violations.length} vi phạm</span><p>Các khoản sự cố đủ điều kiện sẽ tự được đưa vào quyết toán.</p>
            ${violations.map((item) => `<label class="settlement-violation" data-violation-row data-violation-id="${escapeHtml(item.ma_vi_pham)}"><input data-violation-selected type="checkbox"><span>${escapeHtml(item.noi_dung)}</span><input data-violation-amount type="number" min="0" step="1" value="${escapeHtml(item.muc_phat || 0)}" aria-label="Mức phạt"><small>VND</small></label>`).join("") || "<p>Không có vi phạm chờ quyết toán.</p>"}
          </div>
          <div class="settlement-fields settlement-fields--deduction"><label>Khấu trừ khác (VND)<input name="deduction" type="number" min="0" step="1" value="0" required></label><label>Lý do khấu trừ<textarea name="reason" rows="2" placeholder="Bắt buộc ghi lý do nếu có khấu trừ"></textarea></label></div>
        </section>
        <section class="settlement-confirmations"><label><input name="assetsChecked" type="checkbox" required><span>Đã kiểm tra đầy đủ tài sản</span></label><label><input name="debtReviewed" type="checkbox" required><span>Đã đối chiếu công nợ</span></label></section>
        <div class="settlement-actions"><p>Vui lòng rà soát thông tin trước khi xác nhận. Quyết toán sẽ thanh lý hợp đồng và cập nhật trạng thái phòng.</p><div><span data-settlement-message role="status"></span><button class="btn btn--primary" type="submit">Xác nhận quyết toán</button></div></div>
      </form>
    </section>`;
}

function resultMarkup(result) {
  const report = result.report || {};
  const lines = result.snapshot?.lines || [];
  return `<section class="panel settlement-result" data-settlement-result>
    <header><span class="settlement-eyebrow">HOÀN TẤT</span><h2>Biên bản quyết toán</h2></header>
    <p>Biên bản đã được tạo.</p>
    <p>Tổng khấu trừ: <strong>${money(result.totalDeduction)}</strong> · Cọc được hoàn: <strong>${money(result.refund)}</strong> · Nợ sau thanh lý: <strong>${money(result.postDebt)}</strong></p>
    <div class="table-wrap"><table><thead><tr><th>Khoản</th><th>Lý do</th><th>Số tiền</th></tr></thead><tbody>${lines.map((line) => `<tr><td>${escapeHtml(line.type)}</td><td>${escapeHtml(line.reason)}</td><td>${money(line.amount)}</td></tr>`).join("")}</tbody></table></div>
    <form class="form-grid" data-refund-form data-report-id="${escapeHtml(report.ma_bien_ban)}">
      <h4>Ghi nhận hoàn cọc thực tế</h4>
      <label>Ngày hoàn<input name="ngayHoan" type="date" value="${localToday()}" required></label>
      <label>Số tiền hoàn lần này<input name="soTien" type="number" min="1" step="1" required></label>
      <div class="form-grid__actions"><button class="btn btn--secondary" type="submit">Ghi nhận hoàn cọc</button><span data-refund-message></span></div>
    </form>
  </section>`;
}

async function render(context) {
  context.main.innerHTML = shellPage("Trả phòng & thanh lý", "");
  const content = context.main.querySelector("[data-content]");
  try {
    const [response, contracts] = await Promise.all([
      context.api.get("/v1/move-outs"),
      loadAllPages(context.api, "/hop-dong").catch(() => []),
    ]);
    const contractsById = new Map(contracts.map((contract) => [String(contract.ma_hop_dong), contract]));
    const rows = actionableMoveOutRequests(response.data);
    if (!rows.length) { content.innerHTML = '<div class="empty-state moveout-empty"><h3>Không có yêu cầu trả phòng đã duyệt</h3><p>Các yêu cầu đã được duyệt sẽ xuất hiện tại đây để tiếp tục kiểm tra và quyết toán.</p></div>'; return; }
    content.innerHTML = `<section class="moveout-requests panel"><header><div><span class="settlement-eyebrow">CẦN XỬ LÝ</span><h2>Yêu cầu trả phòng đã duyệt</h2></div><span class="moveout-count">${rows.length} yêu cầu</span></header><div class="moveout-request-list">${rows.map((row, index) => { const contract = contractsById.get(String(row.ma_hop_dong)); const room = contract?.phongTro?.so_phong ? `Phòng ${contract.phongTro.so_phong}` : "Không rõ phòng"; const tenant = contract?.khachThue?.ho_ten || "Khách thuê"; return `<article class="moveout-request"><div class="moveout-request__contract"><span>${escapeHtml(room)}</span><strong>${escapeHtml(tenant)}</strong></div><div><span>Nội dung</span><strong>${escapeHtml(row.noi_dung || "Đề nghị trả phòng")}</strong></div><div><span>Ngày gửi</span><strong>${escapeHtml(date(row.ngay_gui))}</strong></div><button class="btn btn--secondary" data-open-context="${index}">Mở quyết toán</button></article>`; }).join("")}</div></section><div class="moveout-workspace" data-workspace></div>`;
    const workspace = content.querySelector("[data-workspace]");
    content.querySelectorAll("[data-open-context]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true; workspace.innerHTML = '<div class="panel moveout-loading" role="status">Đang tải dữ liệu quyết toán…</div>';
      try {
        const row = rows[Number(button.dataset.openContext)];
        const details = (await context.api.get(`/v1/move-outs/${row.ma_hop_dong}/context`)).data;
        workspace.innerHTML = contextMarkup(details);
        workspace.scrollIntoView({ behavior: "smooth", block: "start" });
        const form = workspace.querySelector("[data-settlement-form]");
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!await confirmAction("Quyết toán sẽ thanh lý hợp đồng, chốt công nợ và trả phòng. Bạn chắc chắn tiếp tục?")) return;
          const submit = form.querySelector("button[type='submit']"); const message = form.querySelector("[data-settlement-message]"); submit.disabled = true;
          try {
            const raw = Object.fromEntries(new FormData(form));
            const assetDeductions = [...form.querySelectorAll("[data-asset-row]")].filter((x) => x.querySelector("[data-asset-selected]").checked).map((x) => ({ assetId: x.dataset.assetId, quantity: integerVnd(x.querySelector("[data-asset-quantity]").value, "Số lượng", { positive: true }), amount: integerVnd(x.querySelector("[data-asset-amount]").value, "Chi phí tài sản"), reason: requiredText(x.querySelector("[data-asset-reason]").value, "Lý do tài sản") }));
            if (assetDeductions.some((x) => !x.reason)) throw new Error("Tài sản hỏng/mất phải có lý do.");
            const violationDeductions = [...form.querySelectorAll("[data-violation-row]")].filter((x) => x.querySelector("[data-violation-selected]").checked).map((x) => ({ violationId: x.dataset.violationId, amount: integerVnd(x.querySelector("[data-violation-amount]").value, "Mức phạt") }));
            const payload = { inspectionDate: raw.inspectionDate, finalElectricityReading: integerVnd(raw.finalElectricityReading, "Chỉ số điện cuối"), roomCondition: requiredText(raw.roomCondition, "Tình trạng phòng"), assetsChecked: raw.assetsChecked === "on", debtReviewed: raw.debtReviewed === "on", deduction: integerVnd(raw.deduction, "Khấu trừ khác"), reason: raw.reason.trim() || undefined, assetDeductions, violationDeductions, moveOutRequestId: row.ma_yeu_cau };
            const settled = (await context.api.post(`/v1/move-outs/${row.ma_hop_dong}/settle`, payload)).data;
            workspace.innerHTML = resultMarkup(settled);
            button.closest(".moveout-request").remove();
            const remaining = content.querySelectorAll(".moveout-request").length;
            if (remaining) content.querySelector(".moveout-count").textContent = `${remaining} yêu cầu`;
            else content.querySelector(".moveout-requests").remove();
            const refundForm = workspace.querySelector("[data-refund-form]");
            refundForm.addEventListener("submit", async (refundEvent) => {
              refundEvent.preventDefault();
              if (!await confirmAction("Ghi nhận số tiền đã hoàn thực tế? Thao tác này làm tăng tổng tiền cọc đã hoàn.")) return;
              const refundButton = refundForm.querySelector("button[type='submit']"); const refundMessage = refundForm.querySelector("[data-refund-message]"); refundButton.disabled = true;
              const scope = `refund:${refundForm.dataset.reportId}`;
              try { const values = Object.fromEntries(new FormData(refundForm)); const identity = { reportId: refundForm.dataset.reportId, ngayHoan: requiredText(values.ngayHoan, "Ngày hoàn"), soTien: integerVnd(values.soTien, "Số tiền hoàn", { positive: true }) }; await context.api.post(`/v1/move-outs/${refundForm.dataset.reportId}/deposit-refunds`, { ngayHoan: identity.ngayHoan, soTien: identity.soTien, khoaChongTrung: requestKeys.keyFor(scope, identity) }); requestKeys.complete(scope); refundMessage.textContent = "Đã ghi nhận hoàn cọc."; showToast("Đã ghi nhận hoàn cọc.", "success"); }
              catch (error) { refundMessage.textContent = error.message; if (error.status === 409 && error.code === "IDEMPOTENCY_CONFLICT") { const renew = document.createElement("button"); renew.type = "button"; renew.textContent = "Tạo yêu cầu mới"; renew.addEventListener("click", () => { requestKeys.renew(scope); refundMessage.textContent = "Đã tạo khóa mới; bạn có thể gửi lại."; }); refundMessage.append(" ", renew); } showToast(error.message, "error"); }
              finally { refundButton.disabled = false; }
            });
            showToast("Quyết toán thành công.", "success");
          } catch (error) { message.textContent = error.message; showToast(error.message, "error"); submit.disabled = false; }
        });
      } catch (error) { workspace.textContent = error.message; showToast(error.message, "error"); }
      finally { button.disabled = false; }
    }));
  } catch (error) { content.innerHTML = `<div class="empty-state empty-state--error"><h4>Lỗi tải dữ liệu</h4><p>${escapeHtml(error.message)}</p></div>`; }
}

export default { ...meta, render };
