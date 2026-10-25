const { HopDong, KhachThue, PhongTro, CanTro, ChuTro, TienCoc, ChiSoDien } = require("../models");
const { assertOwned } = require("./ownership.service");
const { businessDate } = require("../utils/businessDate.util");
const { DEFAULT_CONTRACT_TERMS } = require("./contractTerms");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value);
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) return "";
  const [whole, fraction] = text.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = fraction?.replace(/0+$/, "");
  return `${grouped}${decimal ? `,${decimal}` : ""} đ`;
}

function formatDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function maskIdentity(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "";
}

function renderContractHtml({ contract, meter, printedOn }) {
  const room = contract.phongTro;
  const building = room?.canTro;
  const field = (label, value) => `<div class="field"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`;
  const dateField = (label, value) => field(label, formatDate(value));
  const moneyField = (label, value) => field(label, formatMoney(value));
  const meterDate = meter?.ngay_ghi_nhan ? businessDate(meter.ngay_ghi_nhan) : "";
  const defaultTerms = DEFAULT_CONTRACT_TERMS.map((term) => `<li><strong>${escapeHtml(term.title)}</strong><p>${escapeHtml(term.text)}</p></li>`).join("");
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hợp đồng thuê phòng trọ</title>
<style>body{font:14px/1.5 "Noto Sans","Segoe UI",Arial,sans-serif;color:#111;max-width:760px;margin:32px auto;padding:0 24px}h1{text-align:center;font-size:22px}h2{font-size:16px;margin-top:24px;border-bottom:1px solid #aaa}.field{display:grid;grid-template-columns:210px 1fr;padding:5px 0}dt{font-weight:600}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.contract-terms li{padding:4px 0}.contract-terms p{margin:3px 0 8px}.signing-date{margin-top:28px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:36px;text-align:center;margin-top:45px}.signature{min-height:110px;border-top:1px solid #888;padding-top:8px}@media print{body{margin:0;max-width:none;padding:0}h2{break-after:avoid}}</style></head><body>
<h1>HỢP ĐỒNG THUÊ PHÒNG TRỌ</h1>
<h2>Các bên</h2><dl>${field("Chủ trọ", building?.chuTro?.ho_ten)}${field("Khách thuê", contract.khachThue?.ho_ten)}${field("Số điện thoại khách", contract.khachThue?.so_dien_thoai)}${field("Giấy tờ khách (4 số cuối)", maskIdentity(contract.khachThue?.cccd_giay_to))}</dl>
<h2>Phòng và thời hạn</h2><dl>${field("Số phòng", room?.so_phong)}${field("Tên căn", building?.ten_can)}${field("Địa chỉ căn", building?.dia_chi)}${dateField("Ngày bắt đầu", contract.ngay_bat_dau)}${dateField("Ngày kết thúc", contract.ngay_ket_thuc)}</dl>
<h2>Giá và điều khoản</h2><dl>${moneyField("Giá thuê hợp đồng", contract.gia_thue)}${moneyField("Tiền cọc", contract.tienCoc?.so_tien_coc)}${moneyField("Đơn giá điện", contract.don_gia_dien)}${moneyField("Đơn giá nước", contract.don_gia_nuoc)}${moneyField("Phí dịch vụ", contract.phi_dich_vu)}${field("Gói gia hạn", contract.goi_gia_han_cho_phep)}${field("Điều khoản bổ sung riêng", contract.dieu_khoan)}</dl>
<h2>Chỉ số điện đầu</h2><dl>${field("Chỉ số", meter?.chi_so_moi)}${dateField("Ngày chốt", meterDate)}</dl>
<p>Ngày in: ${escapeHtml(formatDate(printedOn))}</p><div class="signatures"><div class="signature">Chữ ký Chủ trọ</div><div class="signature">Chữ ký Khách thuê</div></div>
</body></html>`;
  return html.replace("</dl>\n<p>", `</dl>
<h2>Quy định sử dụng phòng và tài sản</h2><ol class="contract-terms">${defaultTerms}</ol>
<p class="signing-date">Ngày ký: …… / …… / …………</p><p>`);
}

async function getPrintableContract(id, requester, now = new Date()) {
  await assertOwned(requester, "contract", id);
  const contract = await HopDong.findByPk(id, { include: [
    { model: KhachThue, as: "khachThue" },
    { model: PhongTro, as: "phongTro", include: [
      { model: CanTro, as: "canTro", include: [{ model: ChuTro, as: "chuTro" }] },
    ] },
    { model: TienCoc, as: "tienCoc" },
  ] });
  if (!contract) throw Object.assign(new Error("Không tìm thấy tài nguyên"), { status: 404, code: "RESOURCE_NOT_FOUND" });
  const meter = await ChiSoDien.findOne({ where: { loai_chi_so: "DAU_HOP_DONG", khoa_nghiep_vu: id, da_xoa: false } });
  return renderContractHtml({ contract, meter, printedOn: businessDate(now) });
}

module.exports = { getPrintableContract, renderContractHtml };
