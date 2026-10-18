const sequelize = require("../config/database");
const { ThanhToan, GiaoDichThanhToan, KhoanThu, HopDong, PhongTro, KhachThue, ThongBao } = require("../models");
const billService = require("./khoanPhaiThu.service");
const { writeAuditLog } = require("./auditLog.service");
const { buildSnapshot } = require("./receiptSnapshot.service");
const { assertOwned } = require("./ownership.service");

async function confirm(id, actorId) {
  return sequelize.transaction(async (transaction) => {
    const payment = await GiaoDichThanhToan.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    await assertOwned({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId }, "payment", id, { transaction });
    if (payment.trang_thai_xac_nhan === "DA_HUY") {
      throw { status: 409, code: "PAYMENT_CANCELLED", message: "Không thể xác nhận giao dịch đã hủy" };
    }
    if (payment.trang_thai_xac_nhan !== "CHO_XAC_NHAN") {
      throw { status: 409, code: "PAYMENT_NOT_PENDING", message: "Chỉ minh chứng chờ xác nhận mới được duyệt" };
    }
    const bill = await ThanhToan.findByPk(payment.ma_thanh_toan, {
      include: [{ model: HopDong, as: "hopDong", include: [{ model: PhongTro, as: "phongTro" }, { model: KhachThue, as: "khachThue" }] }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!bill) throw { status: 404, code: "BILL_NOT_FOUND", message: "Khoản phải thu không tồn tại" };
    const amount = Number(payment.so_tien);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(bill.so_tien_con_no)) {
      throw { status: 422, code: "INVALID_PAYMENT_AMOUNT", message: "Số tiền minh chứng không hợp lệ với công nợ hiện tại" };
    }
    if (await KhoanThu.findOne({ where: { ma_giao_dich_thanh_toan: payment.ma_giao_dich }, transaction })) {
      throw { status: 409, code: "PAYMENT_RECEIPT_EXISTS", message: "Giao dịch đã có khoản thu" };
    }
    await payment.update({ trang_thai_xac_nhan: "DA_XAC_NHAN", thoi_diem_xac_nhan: new Date() }, { transaction });
    await KhoanThu.create({
      loai_khoan_thu: "THANH_TOAN",
      so_tien: amount,
      ngay_ghi_nhan: new Date(),
      ghi_chu: "Xác nhận minh chứng thanh toán",
      trang_thai_ghi_nhan: "HIEU_LUC",
      ma_giao_dich_thanh_toan: payment.ma_giao_dich,
      ma_can: bill.hopDong.phongTro.ma_can,
      ...await buildSnapshot(bill, amount, transaction),
    }, { transaction });
    await billService.updateBillStatus(bill.ma_thanh_toan, transaction);
    await writeAuditLog({
      transaction, actorId, action: "PAYMENT_EVIDENCE_CONFIRMED", entityType: "GiaoDichThanhToan", entityId: payment.ma_giao_dich,
      after: { billId: bill.ma_thanh_toan, amount },
    });
    if (bill.hopDong.khachThue?.ma_tai_khoan) {
      await require("./notification.service").createIdempotent({
        ma_tai_khoan: bill.hopDong.khachThue.ma_tai_khoan,
        loai_thong_bao: "THANH_TOAN",
        noi_dung: `Minh chứng ${amount.toLocaleString("vi-VN")}đ đã được xác nhận`,
        thoi_diem_tao: new Date(),
        da_doc: false,
        khoa_su_kien: `THANH_TOAN_XAC_NHAN:${payment.ma_giao_dich}`,
      }, { transaction });
    }
    return payment;
  });
}

module.exports = { confirm };
