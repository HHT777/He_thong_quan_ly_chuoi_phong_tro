import { listTab } from "../../shared/components/tab-factory.js";
import { date, money, openFormModal, escapeHtml, confirmAction } from "../../shared/components/view.js";
import { integerVnd, requiredText } from "../../core/idempotency.js";
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
  const keys = ["ngay_bat_dau", "ngay_ket_thuc", "gia_thue", "ma_phong", "trang_thai", "don_gia_dien", "don_gia_nuoc"];
  const detail = item.type === "CHANGE" ? keys.filter((key) => before[key] !== after[key] && (before[key] != null || after[key] != null)).map((key) => `${key}: ${before[key] ?? "—"} → ${after[key] ?? "—"}`).join(" · ") : item.type === "RENEWAL" ? `${row.ngay_ket_thuc_cu} → ${row.ngay_ket_thuc_moi} (${row.so_thang} tháng)` : `${row.ma_phong_cu} → ${row.ma_phong_moi} (${row.ngay_chuyen})`;
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

export default listTab({ id: "contracts", route: "/residents-contracts/contracts", title: "Hợp đồng", tabLabel: "Hợp đồng", group: "residents-contracts", order: 31, roles: ["CHU_TRO"] }, {
  title: "Hợp đồng",
  description: "Tạo hợp đồng kèm hồ sơ cọc và gia hạn hợp đồng hiện có.",
  endpoint: "/hop-dong?limit=100",
  columns: [{ label: "Khách thuê", format: (row) => row.khachThue?.ho_ten || "—" }, { label: "Phòng", format: (row) => row.phongTro?.so_phong || row.ma_phong }, { label: "Giá thuê", format: (row) => money(row.gia_thue) }, { label: "Kết thúc", format: (row) => date(row.ngay_ket_thuc) }, { label: "Trạng thái", key: "trang_thai" }],
  create: {
    label: "Tạo hợp đồng",
    endpoint: "/hop-dong",
    onCreated: () => sessionStorage.removeItem("qlpt:contract-reservation"),
    initial: () => ({ ma_phong: reservationPrefill()?.roomId || "", ma_dat_giu: reservationPrefill()?.reservationId || "" }),
    fields: [
      { name: "ma_dat_giu", label: "Mã giữ phòng (nếu có)" },
      { name: "ma_khach_thue", label: "Mã khách thuê", required: true },
      { name: "ma_phong", label: "Mã phòng", required: true },
      { name: "ngay_bat_dau", label: "Ngày bắt đầu", type: "date", required: true },
      { name: "ngay_ket_thuc", label: "Ngày kết thúc", type: "date", required: true },
      { name: "gia_thue", label: "Giá thuê", type: "number", required: true },
      { name: "tien_coc", label: "Tiền cọc", type: "number", required: true },
      { name: "ngay_nhan_coc", label: "Ngày nhận cọc", type: "date" },
      { name: "don_gia_dien", label: "Đơn giá điện", type: "number", required: true },
      { name: "chi_so_dien_ban_dau", label: "Chỉ số điện ban đầu", type: "number", required: true },
      { name: "don_gia_nuoc", label: "Đơn giá nước/người", type: "number", required: true },
      { name: "dieu_khoan", label: "Điều khoản", type: "textarea", required: true },
      { name: "da_co_ban_giay_ky", label: "Đã có bản giấy ký", type: "checkbox", required: true },
    ],
    map: (raw) => { const result = numericContractValues(raw); if (!result.ma_dat_giu) delete result.ma_dat_giu; return result; },
  },
  rowActions: [{
    id: "history", label: "Lịch sử", run: async (context, row) => {
      const result = await context.api.get(`/hop-dong/${encodeURIComponent(row.ma_hop_dong)}/history`);
      const entries = (result.data || []).map(safeHistory);
      const overlay = document.createElement("div"); overlay.className = "modal-overlay";
      overlay.innerHTML = `<div class="modal-dialog" role="dialog" aria-modal="true"><h3>Lịch sử hợp đồng</h3><div>${entries.map((item) => `<p><strong>${escapeHtml(item.type)}</strong> — ${escapeHtml(item.date)}<br>${escapeHtml(item.detail)}</p>`).join("") || "Chưa có lịch sử."}</div><button type="button" data-close>Đóng</button></div>`;
      overlay.querySelector("[data-close]").addEventListener("click", () => overlay.remove()); document.body.appendChild(overlay);
    },
  }, {
    id: "transfer", label: "Chuyển phòng", visible: (row) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(row.trang_thai),
    run: async (context, row) => {
      const rooms = (await context.api.get("/phong?limit=100")).data || [];
      const vacant = rooms.filter((room) => room.trang_thai === "TRONG" && room.ma_phong !== row.ma_phong);
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
