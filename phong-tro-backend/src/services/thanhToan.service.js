const crypto = require("crypto");
const { Op, fn, col } = require("sequelize");
const sequelize = require("../config/database");
const { ThanhToan, GiaoDichThanhToan, KhoanThu, HopDong, PhongTro, KhachThue, ThongBao } = require("../models");
const billService = require("./khoanPhaiThu.service");
const { writeAuditLog } = require("./auditLog.service");
const { buildSnapshot } = require("./receiptSnapshot.service");
const { assertOwned, getOwnedBuildingIds } = require("./ownership.service");

function deterministicUuid(value) {
  const hex = crypto.createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

class ThanhToanService {
  async createThanhToan(data, idempotencyKey, actorId) {
    const billId = data.ma_khoan_phai_thu || data.ma_thanh_toan;
    if (actorId) await assertOwned({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId }, "bill", billId);
    const amount = Number(data.so_tien);
    const paymentId = deterministicUuid(`payment:${idempotencyKey}`);
    const existing = await GiaoDichThanhToan.findByPk(paymentId);
    if (existing) {
      if (existing.ma_thanh_toan !== billId || Number(existing.so_tien) !== amount) {
        throw Object.assign(new Error("Idempotency-Key đã được dùng cho thanh toán khác"), {
          status: 409,
          code: "IDEMPOTENCY_CONFLICT",
        });
      }
      return existing;
    }
    const payment = await sequelize.transaction(async (transaction) => {
      const bill = await ThanhToan.findByPk(billId, { include: [{ model: HopDong, as: "hopDong", include: [{ model: PhongTro, as: "phongTro" }, { model: KhachThue, as: "khachThue" }] }], transaction, lock: transaction.LOCK.UPDATE });
      if (actorId) await assertOwned({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId }, "bill", billId, { transaction });
      if (!bill) throw { status: 404, message: "Khoản phải thu không tồn tại" };
      if (!Number.isFinite(amount) || amount <= 0) throw { status: 422, code: "INVALID_PAYMENT_AMOUNT", message: "Số tiền thanh toán phải lớn hơn 0" };
      if (amount > Number(bill.so_tien_con_no)) throw { status: 409, code: "PAYMENT_EXCEEDS_OUTSTANDING", message: "Số tiền thu không được vượt quá số còn thiếu", details: { remaining: Number(bill.so_tien_con_no) } };
      const row = await GiaoDichThanhToan.create({
        ma_giao_dich: paymentId, ma_thanh_toan: bill.ma_thanh_toan, so_tien: amount,
        thoi_diem_ghi_nhan: data.ngay_thanh_toan || new Date(), minh_chung_url: data.minh_chung_url || null,
        trang_thai_xac_nhan: "DA_XAC_NHAN", thoi_diem_xac_nhan: new Date(), nguon_thanh_toan: "THU_TIEN",
      }, { transaction });
      await KhoanThu.create({
        loai_khoan_thu: "THANH_TOAN", so_tien: amount,
        ngay_ghi_nhan: data.ngay_thanh_toan || new Date(), ghi_chu: data.ghi_chu || data.phuong_thuc || null,
        trang_thai_ghi_nhan: "HIEU_LUC", ma_giao_dich_thanh_toan: row.ma_giao_dich,
        ma_can: bill.hopDong.phongTro.ma_can,
        ...await buildSnapshot(bill, amount, transaction),
      }, { transaction });
      await billService.updateBillStatus(bill.ma_thanh_toan, transaction);
      if (actorId) await writeAuditLog({
        transaction, actorId, action: "PAYMENT_RECORDED", entityType: "GiaoDichThanhToan", entityId: row.ma_giao_dich,
        after: { billId: bill.ma_thanh_toan, amount }, reason: data.ghi_chu || null,
      });
      const accountId = bill.hopDong?.khachThue?.ma_tai_khoan;
      if (accountId) await require("./notification.service").createIdempotent({ ma_tai_khoan: accountId, loai_thong_bao: "THANH_TOAN", noi_dung: `Đã ghi nhận thanh toán ${amount.toLocaleString("vi-VN")}đ`, thoi_diem_tao: new Date(), da_doc: false, khoa_su_kien: `THANH_TOAN_GHI_NHAN:${row.ma_giao_dich}` }, { transaction });
      return row;
    });
    return payment;
  }

  async getThanhToanList(filters, pagination, requester) {
    const where = {};
    if (filters.ma_khoan_phai_thu || filters.ma_thanh_toan) where.ma_thanh_toan = filters.ma_khoan_phai_thu || filters.ma_thanh_toan;
    const tenantWhere = filters.ma_khach_thue ? { ma_khach_thue: filters.ma_khach_thue } : undefined;
    const ownedBuildings = requester?.vai_tro === "CHU_TRO" ? await getOwnedBuildingIds(requester) : null;
    const { count, rows } = await GiaoDichThanhToan.findAndCountAll({
      where, distinct: true, limit: pagination.limit, offset: pagination.offset,
      include: [{
        model: ThanhToan,
        as: "thanhToan",
        required: Boolean(tenantWhere) || Boolean(ownedBuildings),
        include: [{
          model: HopDong,
          as: "hopDong",
          required: Boolean(tenantWhere) || Boolean(ownedBuildings),
          where: tenantWhere,
          include: [
            { model: KhachThue, as: "khachThue", attributes: ["ma_khach_thue", "ho_ten"] },
            { model: PhongTro, as: "phongTro", attributes: ["ma_phong", "so_phong"],
              ...(ownedBuildings ? { required: true, where: { ma_can: { [Op.in]: ownedBuildings } } } : {}) },
          ],
        }],
      }],
      order: [["thoi_diem_ghi_nhan", "DESC"]],
    });
    return { count, total: count, data: rows };
  }

  async getThanhToanById(id, requester) {
    if (requester) await assertOwned(requester, "payment", id);
    const row = await GiaoDichThanhToan.findByPk(id, { include: [{ model: ThanhToan, as: "thanhToan", include: [{ model: HopDong, as: "hopDong" }] }] });
    if (!row) throw { status: 404, message: "Không tìm thấy giao dịch thanh toán" };
    return row;
  }
  getPaymentsByBill(id) { return GiaoDichThanhToan.findAll({ where: { ma_thanh_toan: id }, order: [["thoi_diem_ghi_nhan", "DESC"]] }); }
  async getTotalPaidForBill(id) { return Number(await GiaoDichThanhToan.sum("so_tien", { where: { ma_thanh_toan: id, trang_thai_xac_nhan: "DA_XAC_NHAN" } }) || 0); }
  async getPaymentStats(startDate, endDate, requester) {
    const ownedBuildings = requester?.vai_tro === "CHU_TRO" ? await getOwnedBuildingIds(requester) : null;
    const rows = await GiaoDichThanhToan.findAll({
      where: { thoi_diem_ghi_nhan: { [Op.between]: [startDate, endDate] }, trang_thai_xac_nhan: "DA_XAC_NHAN" },
      attributes: [
        "nguon_thanh_toan",
        [fn("COALESCE", fn("SUM", col("GiaoDichThanhToan.soTien")), 0), "total_amount"],
        [fn("COUNT", col("GiaoDichThanhToan.maGiaoDich")), "count"],
      ],
      group: ["nguon_thanh_toan"],
      ...(ownedBuildings ? { include: [{ model: ThanhToan, as: "thanhToan", attributes: [], required: true,
        include: [{ model: HopDong, as: "hopDong", attributes: [], required: true,
          include: [{ model: PhongTro, as: "phongTro", attributes: [], required: true, where: { ma_can: { [Op.in]: ownedBuildings } } }] }] }] } : {}),
      raw: true,
    });
    const bySource = Object.fromEntries(rows.map((row) => [row.nguon_thanh_toan, {
      amount: Number(row.total_amount),
      count: Number(row.count),
    }]));
    const cash = bySource.THU_TIEN || { amount: 0, count: 0 };
    const deposit = bySource.KHAU_TRU_COC || { amount: 0, count: 0 };
    return {
      total_amount: cash.amount + deposit.amount,
      count: cash.count + deposit.count,
      cash_collected: cash.amount,
      cash_count: cash.count,
      deposit_offset: deposit.amount,
      deposit_offset_count: deposit.count,
    };
  }
}
module.exports = new ThanhToanService();
