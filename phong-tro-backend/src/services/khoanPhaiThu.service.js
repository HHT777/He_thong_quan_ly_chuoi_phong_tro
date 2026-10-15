const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ThanhToan, ChiTietThanhToan, GiaoDichThanhToan, HopDong, PhongTro, KhachThue } = require("../models");
const { writeAuditLog } = require("./auditLog.service");

function splitPeriod(period) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period || "");
  if (!match) throw { status: 422, message: "Kỳ phải có định dạng YYYY-MM" };
  return { nam: Number(match[1]), thang: Number(match[2]) };
}
const billInclude = [
  { model: HopDong, as: "hopDong", include: [{ model: KhachThue, as: "khachThue" }, { model: PhongTro, as: "phongTro" }] },
  { model: ChiTietThanhToan, as: "chiTiets" },
  { model: GiaoDichThanhToan, as: "giaoDichs" },
];

class KhoanPhaiThuService {
  async createKhoanPhaiThu(data, actorId) {
    const { nam, thang } = splitPeriod(data.ky);
    return sequelize.transaction(async (transaction) => {
      const contract = data.ma_hop_dong
        ? await HopDong.findByPk(data.ma_hop_dong, { transaction, lock: transaction.LOCK.UPDATE })
        : await HopDong.findOne({ where: { ma_phong: data.ma_phong, ma_khach_thue: data.ma_khach_thue, trang_thai: { [Op.ne]: "DA_THANH_LY" } }, transaction, lock: transaction.LOCK.UPDATE });
      if (!contract) throw { status: 404, message: "Không tìm thấy hợp đồng phù hợp" };
      if (await ThanhToan.findOne({ where: { ma_hop_dong: contract.ma_hop_dong, thang, nam, loai_thanh_toan: "DINH_KY" }, transaction })) throw { status: 409, message: "Khoản phải thu của hợp đồng trong kỳ đã tồn tại" };
      const positiveComponents = [
        ["TIEN_PHONG", data.tien_phong, "Tiền phòng"], ["TIEN_DIEN", data.tien_dien, "Tiền điện"],
        ["TIEN_NUOC", data.tien_nuoc, "Tiền nước"], ["PHI_DICH_VU", data.phi_dich_vu, "Phí dịch vụ"],
        ["PHI_PHAT_SINH", data.phi_phat_sinh, "Phí phát sinh"],
      ].filter(([, value]) => Number(value) > 0);
      const calculated = positiveComponents.reduce((sum, [, value]) => sum + Number(value), 0) - Math.abs(Number(data.khoan_giam_tru || 0));
      const total = data.tong_phai_thanh_toan === undefined ? calculated : Number(data.tong_phai_thanh_toan);
      if (!Number.isFinite(total) || total < 0 || Math.abs(total - calculated) > 0.001) throw { status: 422, message: "Tổng phải trả không khớp tổng chi tiết", details: { calculated } };
      const bill = await ThanhToan.create({ ma_hop_dong: contract.ma_hop_dong, thang, nam, loai_thanh_toan: "DINH_KY", tong_phai_tra: total, tong_da_thanh_toan: 0, so_tien_con_no: total, trang_thai: "CHUA_THANH_TOAN" }, { transaction });
      for (const [type, amount, description] of positiveComponents) await ChiTietThanhToan.create({ ma_thanh_toan: bill.ma_thanh_toan, loai_khoan: type, so_tien: amount, dien_giai: description }, { transaction });
      if (actorId) await writeAuditLog({ transaction, actorId, action: "BILL_CREATED", entityType: "ThanhToan", entityId: bill.ma_thanh_toan, after: { period: data.ky, total } });
      return bill;
    });
  }

  buildWhere(filters = {}) {
    const where = { loai_thanh_toan: "DINH_KY" };
    if (filters.ky) Object.assign(where, splitPeriod(filters.ky));
    if (filters.trang_thai_thanh_toan) where.trang_thai = filters.trang_thai_thanh_toan;
    const contractWhere = {};
    if (filters.ma_phong) contractWhere.ma_phong = filters.ma_phong;
    if (filters.ma_khach_thue) contractWhere.ma_khach_thue = filters.ma_khach_thue;
    return { where, contractWhere };
  }

  async getKhoanPhaiThuList(filters, pagination) {
    const { where, contractWhere } = this.buildWhere(filters);
    const include = billInclude.map((item) => item.as === "hopDong" ? { ...item, required: Object.keys(contractWhere).length > 0, where: contractWhere } : item);
    const { count, rows } = await ThanhToan.findAndCountAll({ where, include, distinct: true, limit: pagination.limit, offset: pagination.offset, order: [["nam", "DESC"], ["thang", "DESC"]] });
    return { count, total: count, data: rows };
  }

  async getKhoanPhaiThuById(id) {
    const row = await ThanhToan.findByPk(id, { include: billInclude });
    if (!row) throw { status: 404, message: "Không tìm thấy khoản phải thu" };
    return row;
  }

  async getOutstandingBills(tenantId) {
    return ThanhToan.findAll({ where: { so_tien_con_no: { [Op.gt]: 0 } }, include: [{ model: HopDong, as: "hopDong", required: true, where: { ma_khach_thue: tenantId }, include: [{ model: PhongTro, as: "phongTro" }] }], order: [["nam", "ASC"], ["thang", "ASC"]] });
  }

  async updateBillStatus(id, transaction) {
    const bill = await ThanhToan.findByPk(id, { transaction, lock: transaction?.LOCK.UPDATE });
    if (!bill) throw { status: 404, message: "Không tìm thấy khoản phải thu" };
    const paid = Number(await GiaoDichThanhToan.sum("so_tien", { where: { ma_thanh_toan: id, trang_thai_xac_nhan: "DA_XAC_NHAN" }, transaction }) || 0);
    const remaining = Number(bill.tong_phai_tra) - paid;
    await bill.update({ tong_da_thanh_toan: paid, so_tien_con_no: remaining, trang_thai: remaining === 0 ? "DA_THANH_TOAN" : paid > 0 ? "THANH_TOAN_MOT_PHAN" : "CHUA_THANH_TOAN" }, { transaction });
    return bill;
  }

  async getOverdueBills() {
    const local = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const currentKey = local.getFullYear() * 12 + local.getMonth() + 1;
    return (await ThanhToan.findAll({ where: { so_tien_con_no: { [Op.gt]: 0 }, loai_thanh_toan: "DINH_KY" }, include: billInclude }))
      .filter((bill) => bill.nam * 12 + bill.thang < currentKey || (bill.nam * 12 + bill.thang === currentKey && local.getDate() > 10));
  }
}

module.exports = new KhoanPhaiThuService();
