const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ThanhToan, ChiTietThanhToan, GiaoDichThanhToan, HopDong, PhongTro, KhachThue } = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const { BILL_LINE_TYPES } = require("../domain/billing.constants");
const { sumSignedLineAmounts } = require("../utils/billLine.util");
const { assertOwned, getOwnedBuildingIds, notFoundError } = require("./ownership.service");
const { getPersistedSystemConfig } = require("./systemConfig.service");
const { actionDue } = require("./debtLifecycle.service");
const { businessDate } = require("../utils/businessDate.util");

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

async function searchContractIds(search) {
  const term = `%${search}%`;
  const matches = await HopDong.findAll({ attributes: ["ma_hop_dong"], include: [
    { model: PhongTro, as: "phongTro", required: false, where: { so_phong: { [Op.like]: term } }, attributes: [] },
    { model: KhachThue, as: "khachThue", required: false, where: { ho_ten: { [Op.like]: term } }, attributes: [] },
  ], where: { [Op.or]: [ { "$phongTro.ma_phong$": { [Op.ne]: null } }, { "$khachThue.ma_khach_thue$": { [Op.ne]: null } } ] } });
  return matches.map((row) => row.ma_hop_dong);
}

class KhoanPhaiThuService {
  async createKhoanPhaiThu(data, actorId) {
    const { nam, thang } = splitPeriod(data.ky);
    return sequelize.transaction(async (transaction) => {
      const contract = data.ma_hop_dong
        ? await HopDong.findByPk(data.ma_hop_dong, { transaction, lock: transaction.LOCK.UPDATE })
        : await HopDong.findOne({ where: { ma_phong: data.ma_phong, ma_khach_thue: data.ma_khach_thue, trang_thai: { [Op.ne]: "DA_THANH_LY" } }, transaction, lock: transaction.LOCK.UPDATE });
      if (!contract) throw notFoundError();
      if (actorId) await assertOwned({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId }, "contract", contract.ma_hop_dong, { transaction });
      if (await ThanhToan.findOne({ where: { ma_hop_dong: contract.ma_hop_dong, thang, nam, loai_thanh_toan: "DINH_KY" }, transaction })) throw { status: 409, code: "BILL_ALREADY_EXISTS", message: "Khoản phải thu của hợp đồng trong kỳ đã tồn tại" };
      const lines = [
        { type: BILL_LINE_TYPES.RENT, amount: Number(data.tien_phong), description: "Tiền phòng" },
        { type: BILL_LINE_TYPES.ELECTRICITY, amount: Number(data.tien_dien), description: "Tiền điện" },
        { type: BILL_LINE_TYPES.WATER, amount: Number(data.tien_nuoc), description: "Tiền nước" },
        { type: BILL_LINE_TYPES.SERVICE_FEE, amount: Number(data.phi_dich_vu), description: "Phí dịch vụ" },
        { type: BILL_LINE_TYPES.INCIDENTAL_FEE, amount: Number(data.phi_phat_sinh), description: "Phí phát sinh" },
      ].filter(({ amount }) => amount > 0);
      const definitions = Array.isArray(data.adjustments) ? data.adjustments : [];
      for (const definition of definitions.filter((item) => item.type === BILL_LINE_TYPES.INCIDENTAL_FEE)) {
        const amount = Number(definition.amount);
        if (amount > 0) lines.push({ type: BILL_LINE_TYPES.INCIDENTAL_FEE, amount, description: definition.description, definitionId: definition.id });
      }
      const gross = sumSignedLineAmounts(lines);
      let discountCapacity = gross;
      const manualDiscount = Math.min(Math.abs(Number(data.khoan_giam_tru || 0)) || 0, discountCapacity);
      if (manualDiscount > 0) { lines.push({ type: BILL_LINE_TYPES.DISCOUNT, amount: -manualDiscount, description: "Giảm trừ" }); discountCapacity -= manualDiscount; }
      for (const definition of definitions.filter((item) => item.type === BILL_LINE_TYPES.DISCOUNT)) {
        const amount = Math.min(Number(definition.amount) || 0, discountCapacity);
        if (amount > 0) { lines.push({ type: BILL_LINE_TYPES.DISCOUNT, amount: -amount, description: definition.description, definitionId: definition.id }); discountCapacity -= amount; }
      }
      const calculated = sumSignedLineAmounts(lines);
      const total = data.tong_phai_thanh_toan === undefined ? calculated : Number(data.tong_phai_thanh_toan);
      if (!Number.isFinite(total) || total < 0 || Math.abs(total - calculated) > 0.001) throw { status: 422, message: "Tổng phải trả không khớp tổng chi tiết", details: { calculated } };
      let bill;
      try {
        bill = await ThanhToan.create({ ma_hop_dong: contract.ma_hop_dong, thang, nam, loai_thanh_toan: "DINH_KY", tong_phai_tra: total, tong_da_thanh_toan: 0, so_tien_con_no: total, trang_thai: total === 0 ? "DA_THANH_TOAN" : "CHUA_THANH_TOAN" }, { transaction });
      } catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") throw Object.assign(new Error("Khoản phải thu của hợp đồng trong kỳ đã tồn tại"), { status: 409, code: "BILL_ALREADY_EXISTS" });
        throw error;
      }
      for (const line of lines) await ChiTietThanhToan.create({ ma_thanh_toan: bill.ma_thanh_toan, loai_khoan: line.type, so_tien: line.amount, dien_giai: String(line.description || line.type).slice(0, 255), ma_khoan_dieu_chinh: line.definitionId || null, nguoi_thuc_hien_id: actorId || null }, { transaction });
      if (actorId) await writeAuditLog({ transaction, actorId, action: "BILL_CREATED", entityType: "ThanhToan", entityId: bill.ma_thanh_toan, after: { period: data.ky, total } });
      return bill;
    });
  }

  buildWhere(filters = {}) {
    if (filters.issuance && !["DRAFT", "SENT"].includes(filters.issuance)) throw Object.assign(new Error("Trạng thái gửi phiếu không hợp lệ"), { status: 400, code: "INVALID_ISSUANCE_FILTER" });
    const where = { loai_thanh_toan: "DINH_KY" };
    if (filters.ky) Object.assign(where, splitPeriod(filters.ky));
    if (filters.trang_thai_thanh_toan) where.trang_thai = filters.trang_thai_thanh_toan;
    if (filters.issuance === "DRAFT") where.da_gui = false;
    if (filters.issuance === "SENT") where.da_gui = true;
    const contractWhere = {};
    if (filters.ma_phong) contractWhere.ma_phong = filters.ma_phong;
    if (filters.ma_khach_thue) contractWhere.ma_khach_thue = filters.ma_khach_thue;
    const buildingId = filters.ma_can || filters.buildingId;
    return { where, contractWhere, buildingId };
  }

  async getKhoanPhaiThuList(filters, pagination, requester) {
    const { where, contractWhere, buildingId } = this.buildWhere(filters);
    const ownedBuildings = requester?.vai_tro === "CHU_TRO" ? await getOwnedBuildingIds(requester) : null;
    const include = billInclude.map((item) => item.as === "hopDong" ? {
      ...item,
      required: Object.keys(contractWhere).length > 0 || Boolean(buildingId) || Boolean(ownedBuildings),
      where: contractWhere,
      include: item.include.map((nested) => nested.as === "phongTro" && (buildingId || ownedBuildings)
        ? { ...nested, required: true, where: { ma_can: ownedBuildings
          ? { [Op.in]: buildingId ? (ownedBuildings.includes(buildingId) ? [buildingId] : []) : ownedBuildings }
          : buildingId } } : nested),
    } : item);
    if (requester?.vai_tro === "KHACH_THUE") where.da_gui = true;
    if (filters.search) where.ma_hop_dong = { [Op.in]: await searchContractIds(filters.search) };
    const { count, rows } = await ThanhToan.findAndCountAll({ where, include, distinct: true, limit: pagination.limit, offset: pagination.offset, order: [["nam", "DESC"], ["thang", "DESC"], ["ma_thanh_toan", "DESC"]] });
    return { count, total: count, data: rows };
  }

  async getSummary(filters, requester) {
    const { where, contractWhere, buildingId } = this.buildWhere(filters);
    if (filters.search) where.ma_hop_dong = { [Op.in]: await searchContractIds(filters.search) };
    const owned = await getOwnedBuildingIds(requester);
    const scope = buildingId ? (owned.includes(buildingId) ? [buildingId] : []) : owned;
    const rows = await ThanhToan.findAll({ where, attributes: ["tong_phai_tra", "tong_da_thanh_toan", "so_tien_con_no", "da_gui"], include: [{ model: HopDong, as: "hopDong", required: true, where: contractWhere, attributes: [], include: [{ model: PhongTro, as: "phongTro", required: true, where: { ma_can: { [Op.in]: scope } }, attributes: [] }] }] });
    return rows.reduce((result, bill) => {
      result.totalDue += Number(bill.tong_phai_tra); result.totalPaid += Number(bill.tong_da_thanh_toan);
      if (bill.da_gui) result.totalDebt += Number(bill.so_tien_con_no); else result.unsent += 1;
      return result;
    }, { totalDue: 0, totalPaid: 0, totalDebt: 0, unsent: 0 });
  }

  async getKhoanPhaiThuById(id, requester) {
    if (requester) await assertOwned(requester, "bill", id);
    const row = await ThanhToan.findByPk(id, { include: billInclude });
    if (!row) throw { status: 404, message: "Không tìm thấy khoản phải thu" };
    if (requester?.vai_tro === "KHACH_THUE" && !row.da_gui) throw notFoundError();
    return row;
  }

  async getOutstandingBills(tenantId, requester) {
    if (requester) await assertOwned(requester, "tenant", tenantId);
    return ThanhToan.findAll({ where: { so_tien_con_no: { [Op.gt]: 0 }, da_gui: true }, include: [{ model: HopDong, as: "hopDong", required: true, where: { ma_khach_thue: tenantId }, include: [{ model: PhongTro, as: "phongTro" }] }], order: [["nam", "ASC"], ["thang", "ASC"]] });
  }

  async updateBillStatus(id, transaction) {
    const bill = await ThanhToan.findByPk(id, { transaction, lock: transaction?.LOCK.UPDATE });
    if (!bill) throw { status: 404, message: "Không tìm thấy khoản phải thu" };
    const paid = Number(await GiaoDichThanhToan.sum("so_tien", { where: { ma_thanh_toan: id, trang_thai_xac_nhan: "DA_XAC_NHAN" }, transaction }) || 0);
    const remaining = Number(bill.tong_phai_tra) - paid;
    await bill.update({ tong_da_thanh_toan: paid, so_tien_con_no: remaining, trang_thai: remaining === 0 ? "DA_THANH_TOAN" : paid > 0 ? "THANH_TOAN_MOT_PHAN" : "CHUA_THANH_TOAN" }, { transaction });
    return bill;
  }

  async getOverdueBills(requester, now = new Date()) {
    const [year, month, day] = businessDate(now).split("-").map(Number);
    const currentPeriodDue = actionDue(
      { nam: year, thang: month }, { year, month, day }, await getPersistedSystemConfig(),
    ).overdue;
    // Filter before fetching rows. January before the due day has month < 1,
    // correctly selecting only bills from earlier years.
    const periodWhere = { [Op.or]: [
      { nam: { [Op.lt]: year } },
      { nam: year, thang: { [Op.lte]: currentPeriodDue ? month : month - 1 } },
    ] };
    const ownedBuildings = requester?.vai_tro === "CHU_TRO" ? await getOwnedBuildingIds(requester) : null;
    const rows = await ThanhToan.findAll({ where: { ...periodWhere, so_tien_con_no: { [Op.gt]: 0 }, loai_thanh_toan: "DINH_KY", da_gui: true },
      include: billInclude.map((item) => item.as === "hopDong" ? { ...item, required: true,
        ...(requester?.vai_tro === "KHACH_THUE" ? { where: { ma_khach_thue: requester.ma_khach_thue } } : {}),
        include: item.include.map((nested) => nested.as === "phongTro" && ownedBuildings
          ? { ...nested, required: true, where: { ma_can: { [Op.in]: ownedBuildings } } } : nested) } : item) });
    return rows.map((row) => ({ ...row.toJSON(), isOverdue: true }));
  }
}

module.exports = new KhoanPhaiThuService();
