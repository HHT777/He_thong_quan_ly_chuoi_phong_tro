const sequelize = require("../config/database");
const { ThanhToan, ChiTietThanhToan } = require("../models");
const { writeAuditLog } = require("./auditLog.service");

const ALLOWED_LINE_TYPES = new Set([
  "TIEN_PHONG", "TIEN_DIEN", "TIEN_NUOC", "DICH_VU", "SUA_CHUA", "PHAT_SINH",
]);

const fail = (status, code, message, details) => Object.assign(new Error(message), { status, code, details });
const rounded = (value) => Math.round(Number(value) * 100) / 100;

function validateInput(payload) {
  const reason = String(payload.reason || "").trim();
  const delta = rounded(payload.delta);
  if (!reason || !Number.isFinite(delta) || delta === 0) {
    throw fail(422, "INVALID_BILL_ADJUSTMENT", "Điều chỉnh cần số tiền khác 0 và lý do");
  }
  return { reason, delta };
}

function planReductions(details, amount) {
  let remaining = rounded(amount);
  const changes = [];
  for (const detail of details) {
    if (remaining <= 0) break;
    const current = rounded(detail.so_tien);
    const reduction = Math.min(current, remaining);
    if (reduction > 0) changes.push({ detail, amount: rounded(current - reduction) });
    remaining = rounded(remaining - reduction);
  }
  if (remaining !== 0) throw fail(409, "BILL_DETAIL_TOTAL_MISMATCH", "Không đủ chi tiết để áp dụng giảm trừ");
  return changes;
}

async function adjust(billId, payload, actorId) {
  const { reason, delta } = validateInput(payload);
  return sequelize.transaction(async (transaction) => {
    const bill = await ThanhToan.findByPk(billId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!bill) throw fail(404, "BILL_NOT_FOUND", "Khoản phải thu không tồn tại");
    const details = await ChiTietThanhToan.findAll({
      where: { ma_thanh_toan: bill.ma_thanh_toan },
      order: [["ma_chi_tiet", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const invalidType = details.find((row) => !ALLOWED_LINE_TYPES.has(row.loai_khoan));
    if (invalidType) throw fail(409, "INVALID_BILL_LINE_TYPE", "Hóa đơn có loại chi tiết ngoài miền dữ liệu", { type: invalidType.loai_khoan });
    const detailTotal = rounded(details.reduce((sum, row) => sum + Number(row.so_tien), 0));
    const oldTotal = rounded(bill.tong_phai_tra);
    if (detailTotal !== oldTotal) {
      throw fail(409, "BILL_DETAIL_TOTAL_MISMATCH", "Tổng chi tiết hiện tại không khớp tổng hóa đơn", { detailTotal, billTotal: oldTotal });
    }
    const paid = rounded(bill.tong_da_thanh_toan);
    const total = rounded(oldTotal + delta);
    if (total < paid || total < 0) throw fail(422, "ADJUSTMENT_BELOW_PAID", "Tổng mới không được thấp hơn số đã thu");

    if (delta > 0) {
      await ChiTietThanhToan.create({
        ma_thanh_toan: bill.ma_thanh_toan,
        loai_khoan: "PHAT_SINH",
        so_tien: delta,
        dien_giai: reason.slice(0, 255),
      }, { transaction });
    } else {
      const suffix = ` [Giảm: ${reason}]`;
      for (const change of planReductions(details, Math.abs(delta))) {
        const original = String(change.detail.dien_giai || "Điều chỉnh");
        await change.detail.update({
          so_tien: change.amount,
          dien_giai: `${original}${suffix}`.slice(0, 255),
        }, { transaction });
      }
    }
    await bill.update({
      tong_phai_tra: total,
      so_tien_con_no: rounded(total - paid),
      trang_thai: total === paid ? "DA_THANH_TOAN" : paid > 0 ? "THANH_TOAN_MOT_PHAN" : "CHUA_THANH_TOAN",
    }, { transaction });
    if (actorId) await writeAuditLog({
      transaction, actorId, action: "BILL_ADJUSTED", entityType: "ThanhToan", entityId: bill.ma_thanh_toan,
      before: { total: oldTotal }, after: { total, delta }, reason,
    });
    return bill;
  });
}

module.exports = { ALLOWED_LINE_TYPES, validateInput, planReductions, adjust };
