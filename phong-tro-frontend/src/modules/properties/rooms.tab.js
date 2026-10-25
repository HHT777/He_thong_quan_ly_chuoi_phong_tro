import { listTab } from "../../shared/components/tab-factory.js";
import { escapeHtml, formatStatusBadge, money } from "../../shared/components/view.js";
import "./rooms.css";

const numberFields = (raw) => ({ ...raw, dien_tich: Number(raw.dien_tich), gia_thue: Number(raw.gia_thue), so_nguoi_toi_da: Number(raw.so_nguoi_toi_da) });

async function openRoomDetails(context, summary) {
  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal-dialog room-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="room-detail-title">
    <div class="modal-header"><h3 class="modal-title" id="room-detail-title">Phòng ${escapeHtml(summary.so_phong || summary.ma_phong)}</h3>
      <button type="button" class="modal-close-btn" data-modal-close aria-label="Đóng chi tiết phòng">×</button></div>
    <div class="modal-body" data-room-detail>Đang tải thông tin phòng...</div>
  </div>`;
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-modal-close]")) close(); });
  document.addEventListener("keydown", onKeydown);
  document.body.appendChild(overlay);
  overlay.querySelector("[data-modal-close]").focus();
  try {
    const roomRequest = context.api.get(`/phong/${encodeURIComponent(summary.ma_phong)}`);
    const contractsRequest = context.api.get(`/hop-dong?ma_phong=${encodeURIComponent(summary.ma_phong)}&limit=100&page=1`).catch(() => ({ data: [] }));
    const [roomResponse, contractsResponse] = await Promise.all([roomRequest, contractsRequest]);
    const room = roomResponse.data;
    if (!overlay.isConnected) return;
    const activeContracts = (Array.isArray(contractsResponse.data) ? contractsResponse.data : [])
      .filter((contract) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai));
    const occupants = [...(room.nguoi_dang_o || []), ...activeContracts.map((contract) => contract.khachThue).filter(Boolean)];
    const uniqueOccupants = [...new Map(occupants.map((person) => [`${person.ho_ten}|${person.so_dien_thoai}`, person])).values()];
    overlay.querySelector("[data-room-detail]").innerHTML = `<dl class="room-detail-grid">
      <div><dt>Căn trọ</dt><dd>${escapeHtml(room.canTro?.ten_can)}</dd></div>
      <div><dt>Trạng thái</dt><dd>${formatStatusBadge(room.trang_thai)}</dd></div>
      <div><dt>Địa chỉ căn</dt><dd>${escapeHtml(room.canTro?.dia_chi)}</dd></div>
      <div><dt>Mã phòng</dt><dd>${escapeHtml(room.ma_phong)}</dd></div>
      <div><dt>Giá thuê mỗi tháng</dt><dd>${escapeHtml(money(room.gia_thue))}</dd></div>
      <div><dt>Diện tích</dt><dd>${escapeHtml(room.dien_tich)} m²</dd></div>
      <div><dt>Số người tối đa</dt><dd>${escapeHtml(room.so_nguoi_toi_da)} người</dd></div>
      <div class="room-detail-grid__wide"><dt>Mô tả nội thất</dt><dd>${escapeHtml(room.noi_that_mo_ta || "Chưa có mô tả")}</dd></div>
      <div class="room-detail-grid__wide"><dt>\u004e\u0067\u01b0\u1eddi \u0111\u0061\u006e\u0067 \u1edf</dt><dd>${uniqueOccupants.length
        ? `<ul class="room-current-occupants">${uniqueOccupants.map((person) => `<li><span class="room-current-occupants__name">${escapeHtml(person.ho_ten)}</span><span class="room-current-occupants__phone">${escapeHtml(person.so_dien_thoai)}</span></li>`).join("")}</ul>`
        : "\u0043\u0068\u01b0\u0061 \u0063\u00f3 \u006e\u0067\u01b0\u1eddi \u0111\u0061\u006e\u0067 \u1edf"}</dd></div>
    </dl>`;
  } catch (error) {
    if (overlay.isConnected) overlay.querySelector("[data-room-detail]").textContent = `Không tải được chi tiết phòng: ${error.message}`;
  }
}

export default listTab({ id: "rooms", route: "/properties/rooms", title: "Phòng", tabLabel: "Phòng", group: "properties", order: 21, roles: ["CHU_TRO"] }, {
  title: "Phòng",
  description: "Danh sách phòng, giá thuê, sức chứa và trạng thái sử dụng.",
  endpoint: "/phong?limit=100",
  sortRows: (a, b) => new Intl.Collator("vi", { numeric: true, sensitivity: "base" }).compare(String(a.so_phong || ""), String(b.so_phong || "")),
  openDetail: openRoomDetails,
  columns: [{ label: "Số phòng", key: "so_phong" }, { label: "Căn trọ", format: (row) => row.canTro?.ten_can || "—" }, { label: "Giá thuê", format: (row) => money(row.gia_thue) }, { label: "Tối đa", key: "so_nguoi_toi_da" }, { label: "Trạng thái", key: "trang_thai" }],
  create: { label: "Thêm phòng", fields: [{ name: "so_phong", label: "Số phòng", required: true }, { name: "ma_can", label: "Mã căn trọ", required: true }, { name: "dien_tich", label: "Diện tích", type: "number", required: true }, { name: "gia_thue", label: "Giá thuê", type: "number", required: true }, { name: "so_nguoi_toi_da", label: "Số người tối đa", type: "number", required: true }], map: numberFields },
  rowActions: [
    { id: "details", label: "Xem chi tiết", openDetail: true },
    {
      id: "edit",
      label: "Sửa",
      fields: [
        { name: "so_phong", label: "Số phòng", required: true },
        { name: "dien_tich", label: "Diện tích", type: "number", required: true },
        { name: "gia_thue", label: "Giá thuê", type: "number", required: true },
        { name: "so_nguoi_toi_da", label: "Số người tối đa", type: "number", required: true },
        { name: "noi_that_mo_ta", label: "Mô tả nội thất", type: "textarea" },
      ],
      initial: (row) => row,
      map: numberFields,
      run: (context, row, values) => context.api.put(`/phong/${row.ma_phong}`, values),
    },
    {
      id: "toggle-availability",
      label: "Đổi trạng thái",
      visible: (row) => ["TRONG", "NGUNG_SU_DUNG"].includes(row.trang_thai),
      confirm: (row) => row.trang_thai === "TRONG" ? "Ngừng sử dụng phòng này?" : "Đưa phòng về trạng thái trống?",
      run: (context, row) => context.api.put(`/phong/${row.ma_phong}`, { trang_thai: row.trang_thai === "TRONG" ? "NGUNG_SU_DUNG" : "TRONG" }),
    },
  ],
});
