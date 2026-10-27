import { escapeHtml, money, openFormModal, shellPage } from "../../shared/components/view.js";
import { expenseLabel } from "./report.model.mjs";
import { expensePayload } from "./cashflow.model.mjs";
import "./cashflow.css";

const endpoint = "/management/thu-chi";
const categories = ["SUA_CHUA", "BAO_TRI", "VE_SINH", "DIEN_CHUNG", "NUOC_CHUNG", "KHAC"];

const fields = (buildings, row) => [
  { name: "loai_khoan_chi", label: "Loại khoản chi", options: [...new Set([...categories, ...(row?.loai_khoan_chi ? [row.loai_khoan_chi] : [])])].map((code) => ({ value: code, label: expenseLabel(code) })), required: true },
  { name: "so_tien", label: "Số tiền (VND)", type: "number", required: true },
  { name: "ngay_phat_sinh", label: "Ngày phát sinh", type: "date", required: true },
  { name: "pham_vi", label: "Phạm vi", options: [{ value: "CAN_TRO", label: "Một căn" }, { value: "TOAN_CHUOI", label: "Toàn chuỗi" }], required: true },
  { name: "ma_can", label: "Căn trọ (khi chọn Một căn)", options: [{ value: "", label: "Chọn căn" }, ...buildings.map((building) => ({ value: building.ma_can, label: building.ten_can }))] },
  { name: "ghi_chu", label: "Ghi chú", type: "textarea" },
];

export default {
  id: "cashflow", route: "/finance/cashflow", title: "Thu chi", tabLabel: "Thu chi", group: "finance", order: 43, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Thu chi", "Quản lý khoản chi vận hành. Khoản thu từ phiếu được ghi nhận qua luồng thanh toán.");
    const content = context.main.querySelector("[data-content]");
    content.classList.add("cashflow-page");
    content.innerHTML = '<div class="cashflow-state" role="status">Đang tải khoản chi...</div>';
    let buildings;
    try {
      const response = await context.api.get("/management/can-tro");
      buildings = Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      content.innerHTML = `<div class="cashflow-state" role="alert">Không tải được danh sách căn: ${escapeHtml(error.message)}</div>`;
      return;
    }
    const buildingNames = new Map(buildings.map((row) => [row.ma_can, row.ten_can]));
    let rows = [];
    let status = "loading";
    let errorMessage = "";
    const paint = () => {
      const body = status === "loading" ? '<p role="status">Đang tải khoản chi...</p>' : status === "error"
        ? `<p role="alert">${escapeHtml(errorMessage)}</p><button type="button" data-expense-retry>Thử lại</button>`
        : rows.length ? `<div class="cashflow-table-scroll"><table><thead><tr><th>Loại chi</th><th>Căn</th><th>Ngày</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(expenseLabel(row.loai_khoan_chi))}</td><td>${escapeHtml(row.ma_can ? buildingNames.get(row.ma_can) : "Toàn chuỗi")}</td><td>${escapeHtml(row.ngay_phat_sinh)}</td><td class="cashflow-amount">${escapeHtml(money(row.so_tien))}</td><td>${row.trang_thai === "DA_HUY" ? "Đã hủy" : "Hiệu lực"}</td><td>${row.trang_thai === "HIEU_LUC" && !row.ma_su_co ? `<button type="button" data-expense-edit="${escapeHtml(row.ma_khoan_chi)}">Sửa</button><button type="button" data-expense-cancel="${escapeHtml(row.ma_khoan_chi)}">Hủy</button>` : "—"}</td></tr>`).join("")}</tbody></table></div>`
          : '<p>Chưa có khoản chi cho các căn đang quản lý.</p>';
      content.innerHTML = `<section class="cashflow-panel"><div class="cashflow-heading"><div><h2>Khoản chi</h2><p>Hủy khoản chi sẽ lưu lý do và không tính vào báo cáo.</p></div><button type="button" class="btn btn--primary" data-expense-add ${buildings.length ? "" : "disabled"}>+ Thêm khoản chi</button></div>${body}</section>`;
    };
    const refresh = async () => {
      status = "loading"; paint();
      try {
        const response = await context.api.get(endpoint);
        rows = (Array.isArray(response.data) ? response.data : []).filter((row) => !row.ma_can || buildingNames.has(row.ma_can));
        status = "ready"; errorMessage = "";
      } catch (error) { status = "error"; errorMessage = error.message; }
      paint();
    };
    const openExpense = (row) => openFormModal({
      title: row ? "Sửa khoản chi" : "Thêm khoản chi", fields: fields(buildings, row),
      initial: row || { ngay_phat_sinh: new Date().toISOString().slice(0, 10), pham_vi: "CAN_TRO", ma_can: buildings[0]?.ma_can || "" },
      submitLabel: row ? "Lưu thay đổi" : "Thêm khoản chi",
      submit: async (raw) => {
        const payload = expensePayload(raw, [...categories, ...(row?.loai_khoan_chi ? [row.loai_khoan_chi] : [])]);
        if (payload.ma_can && !buildingNames.has(payload.ma_can)) throw new Error("Căn trọ không hợp lệ.");
        if (row) await context.api.put(`${endpoint}/${encodeURIComponent(row.ma_khoan_chi)}`, payload);
        else await context.api.post(endpoint, payload);
        await refresh();
      },
    });
    content.addEventListener("click", (event) => {
      if (event.target.closest("[data-expense-retry]")) { refresh(); return; }
      if (event.target.closest("[data-expense-add]")) { openExpense(null); return; }
      const edit = event.target.closest("[data-expense-edit]");
      if (edit) { const row = rows.find((item) => item.ma_khoan_chi === edit.dataset.expenseEdit); if (row) openExpense(row); return; }
      const cancel = event.target.closest("[data-expense-cancel]");
      if (!cancel) return;
      const row = rows.find((item) => item.ma_khoan_chi === cancel.dataset.expenseCancel);
      if (!row) return;
      openFormModal({ title: "Hủy khoản chi", fields: [{ name: "reason", label: "Lý do hủy", type: "textarea", required: true }], submitLabel: "Xác nhận hủy",
        submit: async ({ reason }) => {
          if (!reason.trim()) throw new Error("Cần nhập lý do hủy.");
          await context.api.request(`${endpoint}/${encodeURIComponent(row.ma_khoan_chi)}`, { method: "DELETE", body: JSON.stringify({ reason: reason.trim() }) });
          await refresh();
        } });
    });
    await refresh();
  },
};
