import { listTab } from "../../shared/components/tab-factory.js";
import { date, money, openFormModal, escapeHtml, confirmAction } from "../../shared/components/view.js";
import { statusLabel } from "../../shared/components/status-labels.mjs";
import { integerVnd, requiredText } from "../../core/idempotency.js";
import { loadBuildingScope } from "./building-scope.js";
import { defaultContractTerms } from "./contract-terms.js";
import "./contracts.css";
const reservationPrefill = () => {
  try { return JSON.parse(sessionStorage.getItem("qlpt:contract-reservation") || "null"); } catch (_) { return null; }
};
const safeHistory = (item) => {
  const row = item.data || {};
  const parse = (value) => { try { return typeof value === "string" ? JSON.parse(value) : value || {}; } catch (_) { return {}; } };
  const before = parse(row.truoc_json);
  const afterEnvelope = parse(row.sau_json);
  const after = parse(afterEnvelope.contract || afterEnvelope);
  const type = item.type === "CHANGE" ? ({ CREATE: "Tạo hợp đồng", UPDATE: "Sửa hợp đồng", LIQUIDATE: "Thanh lý" }[afterEnvelope.action] || "Sửa hợp đồng") : ({ RENEWAL: "Gia hạn", ROOM_TRANSFER: "Chuyển phòng" }[item.type] || "Lịch sử");
  const keys = ["ngay_bat_dau", "ngay_ket_thuc", "gia_thue", "trang_thai", "don_gia_dien", "don_gia_nuoc"];
  const detail = item.type === "CHANGE" ? keys.filter((key) => before[key] !== after[key] && (before[key] != null || after[key] != null)).map((key) => `${key}: ${before[key] ?? "—"} → ${after[key] ?? "—"}`).join(" · ") : item.type === "RENEWAL" ? `${row.ngay_ket_thuc_cu} → ${row.ngay_ket_thuc_moi} (${row.so_thang} tháng)` : `Phòng cũ → phòng mới (${row.ngay_chuyen})`;
  return { type, date: date(item.occurredAt), detail };
};
const numericContractValues = (raw) => ({
  ...raw,
  gia_thue: Number(raw.gia_thue),
  tien_coc: Number(raw.tien_coc),
  don_gia_dien: Number(raw.don_gia_dien),
  chi_so_dien_ban_dau: Number(raw.chi_so_dien_ban_dau),
  don_gia_nuoc: Number(raw.don_gia_nuoc),
  da_co_ban_giay_ky: raw.da_co_ban_giay_ky === "true",
  ngay_nhan_coc: raw.ngay_nhan_coc || null,
});

async function openContractDetail(context, row) {
  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal-dialog contract-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="contract-detail-title">
    <div class="modal-header"><h3 class="modal-title" id="contract-detail-title">Chi tiết hợp đồng</h3>
      <button type="button" class="modal-close-btn" data-close aria-label="Đóng chi tiết hợp đồng">×</button></div>
    <div class="modal-body contract-detail-body">
      <div data-detail>Đang tải chi tiết...</div>
      <section class="contract-detail-deposit"><h4>Tiền cọc</h4><div data-deposit>Đang tải tiền cọc...</div></section>
      <section class="contract-detail-history"><h4>Lịch sử hợp đồng</h4><div data-history>Đang tải lịch sử...</div></section>
      <div class="contract-print-state" data-print-state></div>
    </div>
    <div class="modal-footer contract-detail-footer"><button type="button" class="btn btn--secondary" data-close>Đóng</button>
      <button type="button" class="btn btn--primary" data-print disabled>In hợp đồng</button></div>
  </div>`;
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKeydown);
  document.body.appendChild(overlay);
  overlay.querySelector("[data-close]").focus();
  const detail = overlay.querySelector("[data-detail]");
  const deposit = overlay.querySelector("[data-deposit]");
  const history = overlay.querySelector("[data-history]");
  const state = overlay.querySelector("[data-print-state]");
  const printButton = overlay.querySelector("[data-print]");
  let printFrame = null;
  const loadDetail = async () => {
    try {
      const response = await context.api.get(`/hop-dong/${encodeURIComponent(row.ma_hop_dong)}`);
      const contract = response.data || {};
      if (!overlay.isConnected) return;
      detail.innerHTML = `<dl class="contract-detail-grid">
        <div><dt>Khách thuê</dt><dd>${escapeHtml(contract.khachThue?.ho_ten)}</dd></div>
        <div><dt>Phòng</dt><dd>${escapeHtml(contract.phongTro?.so_phong ? `Phòng ${contract.phongTro.so_phong}` : "Không rõ phòng")}</dd></div>
        <div><dt>Giá thuê hợp đồng</dt><dd>${escapeHtml(money(contract.gia_thue))}</dd></div>
        <div><dt>Trạng thái</dt><dd>${escapeHtml(statusLabel(contract.trang_thai))}</dd></div>
        <div><dt>Ngày bắt đầu</dt><dd>${escapeHtml(date(contract.ngay_bat_dau))}</dd></div>
        <div><dt>Ngày kết thúc</dt><dd>${escapeHtml(date(contract.ngay_ket_thuc))}</dd></div>
        <div class="contract-detail-grid__wide"><dt>Điều khoản bổ sung riêng</dt><dd>${escapeHtml(contract.dieu_khoan)}</dd></div>
      </dl>
      <details class="contract-default-terms"><summary>Điều khoản sử dụng phòng và tài sản (mặc định)</summary>
        <ol>${defaultContractTerms.map((term) => `<li><strong>${escapeHtml(term.title)}</strong><p>${escapeHtml(term.text)}</p></li>`).join("")}</ol>
      </details>`;
    } catch (error) {
      if (!overlay.isConnected) return;
      detail.textContent = `Không tải được chi tiết: ${error.message} `;
      const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Thử lại";
      retry.addEventListener("click", loadDetail); detail.append(retry);
    }
  };
  const loadHistory = async () => {
    try {
      const result = await context.api.get(`/hop-dong/${encodeURIComponent(row.ma_hop_dong)}/history`);
      if (!overlay.isConnected) return;
      const entries = (result.data || []).map(safeHistory);
      history.innerHTML = entries.map((item) => `<div class="contract-history-item"><strong>${escapeHtml(item.type)}</strong><time>${escapeHtml(item.date)}</time><p>${escapeHtml(item.detail)}</p></div>`).join("") || "Chưa có lịch sử.";
    } catch (error) {
      if (overlay.isConnected) history.textContent = `Không tải được lịch sử: ${error.message}`;
    }
  };
  const loadDeposit = async () => {
    try {
      const result = await context.api.get(`/dat-coc?ma_hop_dong=${encodeURIComponent(row.ma_hop_dong)}&limit=1`);
      if (!overlay.isConnected) return;
      const record = result.data?.[0];
      deposit.innerHTML = record ? `<dl class="contract-detail-grid">
        <div><dt>Số tiền cọc</dt><dd>${escapeHtml(money(record.so_tien_coc))}</dd></div>
        <div><dt>Trạng thái</dt><dd>${escapeHtml(statusLabel(record.trang_thai))}</dd></div>
        <div><dt>Ngày nhận cọc</dt><dd>${escapeHtml(date(record.ngay_nhan_coc))}</dd></div>
        <div><dt>Đã hoàn</dt><dd>${escapeHtml(money(record.so_tien_da_hoan))}</dd></div>
        <div><dt>Đã khấu trừ</dt><dd>${escapeHtml(money(record.so_tien_da_khau_tru))}</dd></div>
      </dl>` : "Chưa có hồ sơ tiền cọc cho hợp đồng này.";
    } catch (error) {
      if (!overlay.isConnected) return;
      deposit.textContent = `Không tải được tiền cọc: ${error.message} `;
      const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Thử lại";
      retry.addEventListener("click", loadDeposit); deposit.append(retry);
    }
  };
  const loadPrint = async () => {
    printButton.disabled = true;
    state.textContent = "Đang chuẩn bị bản in...";
    try {
      const html = await context.api.getHtml(`/hop-dong/${encodeURIComponent(row.ma_hop_dong)}/print`);
      if (!overlay.isConnected) return;
      const frame = document.createElement("iframe");
      frame.title = "Bản in hợp đồng";
      frame.setAttribute("sandbox", "allow-same-origin allow-modals");
      frame.className = "contract-print-frame";
      frame.addEventListener("load", () => {
        if (!overlay.isConnected) return;
        printFrame = frame;
        printButton.disabled = false;
      }, { once: true });
      frame.srcdoc = html;
      state.textContent = "";
      state.append(frame);
    } catch (error) {
      if (!overlay.isConnected) return;
      state.textContent = `Không tải được bản in: ${error.message} `;
      const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Thử lại";
      retry.addEventListener("click", loadPrint); state.append(retry);
    }
  };
  printButton.addEventListener("click", () => printFrame?.contentWindow?.print());
  await Promise.all([loadDetail(), loadDeposit(), loadHistory(), loadPrint()]);
}

export default listTab({ id: "contracts", route: "/residents-contracts/contracts", title: "Hợp đồng", tabLabel: "Hợp đồng", group: "residents-contracts", order: 31, roles: ["CHU_TRO"] }, {
  title: "Hợp đồng",
  description: "",
  endpoint: "/hop-dong?limit=100",
  loadAllPages: true,
  buildingScope: loadBuildingScope,
  buildingScopeInToolbar: true,
  buildingMatch: (row, scope) => scope.matchesContract(row),
  statusOptions: [
    { value: "DANG_HIEU_LUC", label: "Đang hiệu lực" },
    { value: "SAP_HET_HAN", label: "Sắp hết hạn" },
    { value: "HET_HAN", label: "Hết hạn" },
    { value: "DA_THANH_LY", label: "Đã thanh lý" },
  ],
  openDetail: openContractDetail,
  columns: [{ label: "Khách thuê", format: (row) => row.khachThue?.ho_ten || "—" }, { label: "Căn", format: (row) => row.phongTro?.canTro?.ten_can || "—" }, { label: "Phòng", format: (row) => row.phongTro?.so_phong || "—" }, { label: "Giá thuê", format: (row) => money(row.gia_thue) }, { label: "Kết thúc", format: (row) => date(row.ngay_ket_thuc) }, { label: "Trạng thái", key: "trang_thai" }],
  create: {
    label: "Tạo hợp đồng",
    endpoint: "/hop-dong",
    onCreated: () => sessionStorage.removeItem("qlpt:contract-reservation"),
    initial: () => ({ ma_phong: reservationPrefill()?.roomId || "", ma_dat_giu: reservationPrefill()?.reservationId || "", dieu_khoan: "Áp dụng 8 điều khoản mặc định về sử dụng phòng và tài sản." }),
    fields: (scope) => [
      { name: "ma_dat_giu", label: "Mã giữ phòng (nếu có)" },
      { name: "ma_khach_thue", label: "Mã khách thuê", required: true },
      { name: "ma_phong", label: "Phòng", options: [{ value: "", label: "Chọn phòng" }, ...scope.rooms.filter((room) => scope.matchesRoom(room.ma_phong) && ["TRONG", "DA_GIU"].includes(room.trang_thai)).map((room) => ({ value: room.ma_phong, label: `${room.canTro?.ten_can || "Căn trọ"} · ${room.so_phong}` }))], required: true },
      { name: "ngay_bat_dau", label: "Ngày bắt đầu", type: "date", required: true },
      { name: "ngay_ket_thuc", label: "Ngày kết thúc", type: "date", required: true },
      { name: "gia_thue", label: "Giá thuê", type: "number", required: true },
      { name: "tien_coc", label: "Tiền cọc", type: "number", required: true },
      { name: "ngay_nhan_coc", label: "Ngày nhận cọc", type: "date" },
      { name: "don_gia_dien", label: "Đơn giá điện", type: "number", required: true },
      { name: "chi_so_dien_ban_dau", label: "Chỉ số điện ban đầu", type: "number", required: true },
      { name: "don_gia_nuoc", label: "Đơn giá nước/người", type: "number", required: true },
      { name: "dieu_khoan", label: "Điều khoản bổ sung riêng", type: "textarea", required: true },
      { name: "da_co_ban_giay_ky", label: "Đã có bản giấy ký", type: "checkbox", required: true },
    ],
    map: (raw) => { const result = numericContractValues(raw); if (!result.ma_dat_giu) delete result.ma_dat_giu; return result; },
  },
  rowActions: [{
    id: "detail", label: "Chi tiết", openDetail: true,
  }, {
    id: "transfer", label: "Chuyển phòng", visible: (row) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(row.trang_thai),
    run: async (context, row) => {
      const scope = await loadBuildingScope(context.api);
      const vacant = scope.rooms.filter((room) => scope.matchesRoom(room.ma_phong) && room.trang_thai === "TRONG" && room.ma_phong !== row.ma_phong);
      if (!vacant.length) throw new Error("Không có phòng trống để chuyển.");
      openFormModal({ title: "Chuyển phòng", submitLabel: "Xác nhận chuyển", fields: [
        { name: "targetRoomId", label: "Phòng đích trống", options: vacant.map((room) => ({ value: room.ma_phong, label: room.so_phong })), required: true },
        { name: "transferDate", label: "Ngày chuyển", type: "date", required: true },
        { name: "finalElectricityReading", label: "Chỉ số cuối phòng cũ", type: "number", required: true },
        { name: "initialElectricityReading", label: "Chỉ số đầu phòng mới", type: "number", required: true },
        { name: "newRent", label: "Giá thuê mới", type: "number", required: true },
        { name: "reason", label: "Lý do", type: "textarea", required: true },
      ], initial: { newRent: row.gia_thue }, submit: async (raw) => {
        if (!await confirmAction("Chuyển phòng sẽ chốt điện phòng cũ và cập nhật hợp đồng. Tiếp tục?")) return false;
        await context.api.post(`/hop-dong/${encodeURIComponent(row.ma_hop_dong)}/transfers`, { targetRoomId: raw.targetRoomId, transferDate: raw.transferDate, finalElectricityReading: integerVnd(raw.finalElectricityReading, "Chỉ số cuối"), initialElectricityReading: integerVnd(raw.initialElectricityReading, "Chỉ số đầu"), newRent: integerVnd(raw.newRent, "Giá thuê mới", { positive: true }), reason: requiredText(raw.reason, "Lý do") });
      } });
    },
  }, {
    id: "renew",
    label: "Gia hạn",
    visible: (row) => ["DANG_HIEU_LUC", "SAP_HET_HAN", "HET_HAN"].includes(row.trang_thai),
    fields: [
      { name: "ngay_bat_dau_moi", label: "Ngày bắt đầu mới", type: "date", required: true },
      { name: "ngay_ket_thuc_moi", label: "Ngày kết thúc mới", type: "date", required: true },
      { name: "gia_thue_moi", label: "Giá thuê mới", type: "number" },
    ],
    initial: (row) => ({ ngay_bat_dau_moi: row.ngay_bat_dau, ngay_ket_thuc_moi: row.ngay_ket_thuc, gia_thue_moi: row.gia_thue }),
    map: (raw) => ({ ...raw, gia_thue_moi: raw.gia_thue_moi ? Number(raw.gia_thue_moi) : undefined }),
    run: (context, row, values) => context.api.post(`/hop-dong/${row.ma_hop_dong}/renew`, values),
  }],
});
