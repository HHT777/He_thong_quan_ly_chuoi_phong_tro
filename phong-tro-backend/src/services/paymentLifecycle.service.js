const crypto = require("crypto");
const sequelize = require("../config/database");
const { ThanhToan, GiaoDichThanhToan, KhoanThu, HopDong, PhongTro } = require("../models");
const billService = require("./khoanPhaiThu.service");
const { writeAuditLog } = require("./auditLog.service");

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
function deterministicUuid(value) { const hex = crypto.createHash("sha256").update(value).digest("hex").slice(0, 32).split(""); hex[12] = "4"; hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16); return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`; }
async function recordRemaining(bill, key, actorId, transaction, now = new Date()) {
  if (bill.loai_thanh_toan === "SAU_THANH_LY" || Number(bill.so_tien_con_no) <= 0) return null;
  const id = deterministicUuid(`mark-paid:${key}:${bill.ma_thanh_toan}`);
  const existing = await GiaoDichThanhToan.findByPk(id, { transaction }); if (existing) return existing;
  const amount = Number(bill.so_tien_con_no);
  const contract = await HopDong.findByPk(bill.ma_hop_dong, { include: [{ model: PhongTro, as: "phongTro" }], transaction });
  const payment = await GiaoDichThanhToan.create({ ma_giao_dich: id, ma_thanh_toan: bill.ma_thanh_toan, so_tien: amount, thoi_diem_ghi_nhan: now, trang_thai_xac_nhan: "DA_XAC_NHAN", thoi_diem_xac_nhan: now, nguon_thanh_toan: "THU_TIEN" }, { transaction });
  await KhoanThu.create({ loai_khoan_thu: "THANH_TOAN", so_tien: amount, ngay_ghi_nhan: now, ghi_chu: "Đánh dấu đã đóng", trang_thai_ghi_nhan: "HIEU_LUC", ma_giao_dich_thanh_toan: id, ma_can: contract.phongTro.ma_can }, { transaction });
  await billService.updateBillStatus(bill.ma_thanh_toan, transaction);
  await writeAuditLog({ transaction, actorId, action: "BILL_MARKED_PAID", entityType: "ThanhToan", entityId: bill.ma_thanh_toan, after: { paymentId: id, amount } });
  return payment;
}
async function markPaid(billId, key, actorId) {
  if (!key) throw fail(400, "Thiếu Idempotency-Key", "IDEMPOTENCY_KEY_REQUIRED");
  return sequelize.transaction(async (transaction) => { const bill = await ThanhToan.findByPk(billId, { transaction, lock: transaction.LOCK.UPDATE }); if (!bill) throw fail(404, "Không tìm thấy phiếu", "BILL_NOT_FOUND"); if (bill.loai_thanh_toan === "SAU_THANH_LY") throw fail(409, "Không dùng Đã đóng cho nợ sau thanh lý", "POST_LIQUIDATION_NOT_SUPPORTED"); return { payment: await recordRemaining(bill, key, actorId, transaction), bill: await billService.updateBillStatus(billId, transaction) }; });
}
async function markAllPaid({ buildingId, period, key, actorId, failAfter }) {
  if (!key) throw fail(400, "Thiếu Idempotency-Key", "IDEMPOTENCY_KEY_REQUIRED");
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period || ""); if (!buildingId || !match) throw fail(422, "Căn và kỳ YYYY-MM là bắt buộc", "INVALID_MARK_ALL_SCOPE");
  return sequelize.transaction(async (transaction) => {
    const bills = await ThanhToan.findAll({ where: { nam: Number(match[1]), thang: Number(match[2]), loai_thanh_toan: "DINH_KY" }, include: [{ model: HopDong, as: "hopDong", required: true, include: [{ model: PhongTro, as: "phongTro", required: true, where: { ma_can: buildingId } }] }], transaction, lock: transaction.LOCK.UPDATE, order: [["ma_thanh_toan", "ASC"]] });
    const payments = []; for (const bill of bills) { const row = await recordRemaining(bill, key, actorId, transaction); if (row) payments.push(row); if (failAfter && payments.length >= failAfter) throw fail(500, "Lỗi mô phỏng giữa giao dịch", "INJECTED_FAILURE"); }
    return { processed: payments.length, payments };
  });
}
async function cancel(paymentId, reason, actorId) {
  reason = String(reason || "").trim(); if (!reason) throw fail(422, "Lý do hủy là bắt buộc", "PAYMENT_CANCEL_REASON_REQUIRED");
  return sequelize.transaction(async (transaction) => {
    const payment = await GiaoDichThanhToan.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE }); if (!payment) throw fail(404, "Không tìm thấy lần thu", "PAYMENT_NOT_FOUND");
    if (payment.nguon_thanh_toan !== "THU_TIEN") throw fail(409, "Không được hủy khoản khấu trừ cọc", "DEPOSIT_OFFSET_CANNOT_CANCEL");
    if (payment.trang_thai_xac_nhan === "DA_HUY") throw fail(409, "Lần thu đã bị hủy", "PAYMENT_ALREADY_CANCELLED");
    if (payment.trang_thai_xac_nhan !== "DA_XAC_NHAN") throw fail(409, "Chỉ được hủy lần thu đã xác nhận", "PAYMENT_NOT_CONFIRMED");
    const receipt = await KhoanThu.findOne({ where: { ma_giao_dich_thanh_toan: paymentId }, transaction, lock: transaction.LOCK.UPDATE }); const now = new Date();
    await payment.update({ trang_thai_xac_nhan: "DA_HUY", ly_do_huy: reason, ngay_huy: now, nguoi_huy_id: actorId }, { transaction });
    if (receipt?.trang_thai_ghi_nhan === "HIEU_LUC") await receipt.update({ trang_thai_ghi_nhan: "DA_HUY", ly_do_huy: reason, ngay_huy: now }, { transaction });
    const bill = await billService.updateBillStatus(payment.ma_thanh_toan, transaction);
    await writeAuditLog({ transaction, actorId, action: "PAYMENT_CANCELLED", entityType: "GiaoDichThanhToan", entityId: paymentId, before: { amount: Number(payment.so_tien) }, after: { billRemaining: Number(bill.so_tien_con_no) }, reason });
    return { payment, bill };
  });
}
module.exports = { deterministicUuid, markPaid, markAllPaid, cancel };
