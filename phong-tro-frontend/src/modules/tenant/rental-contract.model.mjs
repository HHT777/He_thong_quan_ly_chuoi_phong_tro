import { datePadded, escapeHtml, money } from "../../shared/components/view.js";
import { statusLabel } from "../../shared/components/status-labels.mjs";
import { defaultContractTerms, readableContractTerms } from "../residents-contracts/contract-terms.js";

const currentStates = new Set(["DANG_HIEU_LUC", "SAP_HET_HAN"]);
const shown = (value) => escapeHtml(value == null || value === "" ? "—" : value);
const price = (value) => value == null ? "—" : money(value);
const date = (value) => value ? datePadded(value) : "—";
const json = (value) => { if (typeof value === "object") return value || {}; try { return JSON.parse(value || "{}"); } catch { return {}; } };

export const currentFirst = (a, b) => Number(currentStates.has(b.trang_thai)) - Number(currentStates.has(a.trang_thai))
  || String(b.ngay_bat_dau || "").localeCompare(String(a.ngay_bat_dau || ""));

export async function loadContracts(api) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const result = await api.get(`/hop-dong?limit=100&page=${page}`);
    if (!Array.isArray(result.data)) throw new Error("Phản hồi danh sách hợp đồng không hợp lệ");
    rows.push(...result.data);
    if (!result.pagination?.hasNext) break;
    if (page >= Number(result.pagination.totalPages || 0)) throw new Error("Phân trang hợp đồng không hợp lệ");
  }
  return rows.sort(currentFirst);
}

export function overviewMarkup(rows) {
  if (!rows.length) return '<div class="panel empty-state"><h2>Chưa có hợp đồng thuê phòng</h2></div>';
  const card = (row) => `<article class="panel panel--padded" data-contract-card><h3>${shown(row.phongTro?.canTro?.ten_can)} · Phòng ${shown(row.phongTro?.so_phong)}</h3>
    <p>${shown(statusLabel(row.trang_thai))} · ${shown(date(row.ngay_bat_dau))} – ${shown(date(row.ngay_ket_thuc))}</p>
    <p>Giá thuê theo hợp đồng: <strong>${shown(price(row.gia_thue))}</strong></p>
    <div class="tenant-contract-actions"><button type="button" class="btn btn--secondary" data-contract-detail="${shown(row.ma_hop_dong)}">Xem chi tiết</button>
    ${currentStates.has(row.trang_thai) ? `<button type="button" class="btn btn--secondary" data-room-members="${shown(row.ma_hop_dong)}">Xem thành viên trong phòng</button>` : ""}</div></article>`;
  const current = rows.filter((row) => currentStates.has(row.trang_thai));
  const previous = rows.filter((row) => !currentStates.has(row.trang_thai));
  return `<div class="content-card-stack"><section class="content-card-stack" aria-label="Hợp đồng hiện hành"><h2>Hợp đồng hiện hành</h2>${current.length ? current.map(card).join("") : '<p class="panel panel--padded">Không có hợp đồng đang hiệu lực.</p>'}</section>
    <section class="content-card-stack" aria-label="Hợp đồng trước đây"><h2>Hợp đồng trước đây</h2>${previous.length ? previous.map(card).join("") : '<p class="panel panel--padded">Chưa có hợp đồng trước đây.</p>'}</section></div>`;
}

export function roomMembersMarkup(data, contract) {
  const roomId = contract?.phongTro?.ma_phong;
  const ownRoom = data?.contracts?.find((row) => String(row.contractId) === String(contract?.ma_hop_dong) && String(row.roomId) === String(roomId));
  if (!roomId || !ownRoom) return "<p>Không còn thông tin cư trú của hợp đồng này.</p>";
  const members = Array.isArray(data.roomMembers) ? data.roomMembers.filter((member) => String(member.roomId) === String(roomId) && member.trang_thai_cu_tru === "DANG_O" && !member.isPrincipal) : [];
  const people = [{ name: contract.khachThue?.ho_ten, role: "Khách đứng tên hợp đồng", joined: contract.ngay_bat_dau },
    ...members.map((member) => ({ name: member.ho_ten, role: "Người ở cùng", joined: member.ngay_vao, relationship: member.relationship, phone: member.so_dien_thoai, document: member.cccd_giay_to }))];
  const field = (label, value) => value ? `<div><dt>${label}</dt><dd>${shown(value)}</dd></div>` : "";
  const expected = Number(ownRoom.currentOccupants);
  const missing = Number.isSafeInteger(expected) && expected > people.length;
  return `${missing ? `<p role="alert" class="tenant-room-members__warning">Danh sách mới có ${people.length}/${expected} người đang ở. Vui lòng tải lại trang để cập nhật đầy đủ.</p>` : ""}<div class="tenant-room-members__list">${people.map((person) => `<article class="tenant-room-members__item"><h4>${shown(person.name)}</h4><p>${shown(person.role)}</p><dl>${field("Ngày vào ở", person.joined ? date(person.joined) : null)}${field("Quan hệ", person.relationship)}${field("Số điện thoại", person.phone)}${field("Giấy tờ", person.document)}</dl></article>`).join("")}</div>`;
}

export function detailMarkup(contract) {
  const room = contract.phongTro || {};
  const field = (label, value) => `<div><dt>${label}</dt><dd>${shown(value)}</dd></div>`;
  return `<dl class="contract-detail-grid">
    ${field("Khách thuê", contract.khachThue?.ho_ten)}
    ${field("Phòng", room.so_phong ? `Phòng ${room.so_phong}` : null)}
    ${field("Giá thuê hợp đồng", price(contract.gia_thue))}
    ${field("Trạng thái", statusLabel(contract.trang_thai))}
    ${field("Ngày bắt đầu", date(contract.ngay_bat_dau))}
    ${field("Ngày kết thúc", date(contract.ngay_ket_thuc))}
    <div class="contract-detail-grid__wide"><dt>Điều khoản bổ sung riêng</dt><dd>${shown(readableContractTerms(contract.dieu_khoan))}</dd></div>
  </dl>
  <details class="contract-default-terms"><summary>Điều khoản sử dụng phòng và tài sản (mặc định)</summary>
    <ol>${defaultContractTerms.map((term) => `<li><strong>${shown(term.title)}</strong><p>${shown(term.text)}</p></li>`).join("")}</ol>
  </details>
  <section><h4>Đơn giá và phí theo hợp đồng</h4><dl class="contract-detail-grid">
    ${field("Đơn giá điện", price(contract.don_gia_dien))}
    ${field("Đơn giá nước", price(contract.don_gia_nuoc))}
    ${field("Phí dịch vụ", price(contract.phi_dich_vu))}
  </dl></section>`;
}

const changeFields = { gia_thue: "Giá thuê", don_gia_dien: "Đơn giá điện", don_gia_nuoc: "Đơn giá nước", phi_dich_vu: "Phí dịch vụ", ngay_bat_dau: "Ngày bắt đầu", ngay_ket_thuc: "Ngày kết thúc" };
const changeValue = (key, value) => value == null ? "—" : key.startsWith("ngay_") ? date(value) : price(value);

export function historyMarkup(entries) {
  if (!Array.isArray(entries) || !entries.length) return "<p>Chưa có lịch sử thay đổi.</p>";
  return `<ol>${entries.map((entry) => {
    const row = entry.data || {};
    let heading = "Thay đổi hợp đồng";
    let detail = "";
    if (entry.type === "CHANGE") {
      const before = json(row.truoc_json);
      const envelope = json(row.sau_json);
      const after = json(envelope.contract || envelope);
      heading = envelope.action === "CREATED" ? "Tạo hợp đồng" : envelope.action === "LIQUIDATED" ? "Thanh lý hợp đồng" : "Sửa hợp đồng";
      detail = Object.entries(changeFields).filter(([key]) => before[key] != null && after[key] != null && String(before[key]) !== String(after[key]))
        .map(([key, label]) => `${label}: ${changeValue(key, before[key])} → ${changeValue(key, after[key])}`).join("; ");
      if (row.ly_do) detail = `${detail ? `${detail}; ` : ""}${row.ly_do}`;
    } else if (entry.type === "RENEWAL") {
      heading = "Gia hạn hợp đồng";
      detail = `${date(row.ngay_ket_thuc_cu)} → ${date(row.ngay_ket_thuc_moi)} (${row.so_thang ?? "—"} tháng)`;
    } else if (entry.type === "ROOM_TRANSFER") {
      heading = "Chuyển phòng";
      detail = `Ngày ${date(row.ngay_chuyen)}; giá thuê ${price(row.gia_thue_cu)} → ${price(row.gia_thue_moi)}`;
    }
    return `<li><strong>${shown(heading)}</strong> · <time>${shown(date(entry.occurredAt))}</time><p>${shown(detail || "Không có thay đổi đơn giá")}</p></li>`;
  }).join("")}</ol>`;
}

export function violationsMarkup(rows) {
  if (!Array.isArray(rows) || !rows.length) return "<p>Không có vi phạm được ghi nhận.</p>";
  return `<ol>${rows.map((row) => `<li><strong>${shown(row.noi_dung)}</strong><p>Điều khoản: ${shown(row.dieu_khoan_lien_quan)}</p><p>Ngày ghi nhận: ${shown(date(row.ngay_ghi_nhan))}</p>${row.muc_phat == null ? "" : `<p>Mức phạt ghi nhận: ${shown(price(row.muc_phat))}</p>`}</li>`).join("")}</ol>`;
}
