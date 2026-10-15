const sequelize = require("../config/database");
const { ThanhToan, ChiTietThanhToan } = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const { BILL_LINE_TYPES, ALLOWED_BILL_LINE_TYPES } = require("../domain/billing.constants");
const { roundedMoney, assertBillDetailTotal } = require("../utils/billLine.util");

const fail = (status, code, message, details) => Object.assign(new Error(message), { status, code, details });

function validateInput(payload) {
  const reason = String(payload.reason || "").trim();
  const delta = roundedMoney(payload.delta);
  if (!reason || !Number.isFinite(delta) || delta === 0) {
    throw fail(422, "INVALID_BILL_ADJUSTMENT", "Điều chỉnh cần số tiền khác 0 và lý do");
  }
  return { reason, delta };
}

async function adjust(billId, payload, actorId) {
  const { reason, delta } = validateInput(payload);
  return sequelize.transaction(async (transaction) => {
    const bill = await ThanhToan.findByPk(billId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!bill) throw fail(404, "BILL_NOT_FOUND", "Khoản phải thu không tồn tại");
    const details = await ChiTietThanhToan.findAll({ where: { ma_thanh_toan: bill.ma_thanh_toan }, transaction, lock: transaction.LOCK.UPDATE });
    assertBillDetailTotal(details, bill.tong_phai_tra);
    const oldTotal = roundedMoney(bill.tong_phai_tra);
    const paid = roundedMoney(bill.tong_da_thanh_toan);
    if (delta < 0 && Math.abs(delta) > roundedMoney(bill.so_tien_con_no)) {
      throw fail(409, "ADJUSTMENT_EXCEEDS_OUTSTANDING", "Điều chỉnh giảm không được vượt số tiền còn nợ");
    }
    const total = roundedMoney(oldTotal + delta);
    if (total < paid || total < 0) throw fail(409, "ADJUSTMENT_BELOW_PAID", "Tổng mới không được thấp hơn số đã thu");
    await ChiTietThanhToan.create({
      ma_thanh_toan: bill.ma_thanh_toan,
      loai_khoan: delta > 0 ? BILL_LINE_TYPES.ADJUSTMENT_INCREASE : BILL_LINE_TYPES.ADJUSTMENT_DECREASE,
      so_tien: delta,
      dien_giai: reason.slice(0, 255),
      nguoi_thuc_hien_id: actorId || null,
      thoi_diem_tao: new Date(),
    }, { transaction });
    await bill.update({
      tong_phai_tra: total,
      so_tien_con_no: roundedMoney(total - paid),
      trang_thai: total === paid ? "DA_THANH_TOAN" : paid > 0 ? "THANH_TOAN_MOT_PHAN" : "CHUA_THANH_TOAN",
    }, { transaction });
    if (actorId) await writeAuditLog({
      transaction, actorId, action: "BILL_ADJUSTED", entityType: "ThanhToan", entityId: bill.ma_thanh_toan,
      before: { total: oldTotal }, after: { total, delta }, reason,
    });
    return bill;
  });
}

module.exports = { ALLOWED_LINE_TYPES: ALLOWED_BILL_LINE_TYPES, validateInput, adjust };
