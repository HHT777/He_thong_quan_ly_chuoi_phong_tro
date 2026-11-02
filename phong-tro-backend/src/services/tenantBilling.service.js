const { Op, Transaction } = require("sequelize");
const sequelize = require("../config/database");
const { ThanhToan, HopDong, PhongTro, CanTro, GiaoDichThanhToan } = require("../models");
const { actionDue } = require("./debtLifecycle.service");
const { getPersistedSystemConfig } = require("./systemConfig.service");
const { businessDate } = require("../utils/businessDate.util");
const { roundedMoney } = require("../utils/billLine.util");

const plain = (row) => row?.toJSON ? row.toJSON() : row;
const pick = (row, fields) => Object.fromEntries(fields.map((key) => [key, row[key] ?? null]));
function tenantScope(user) {
  if (user?.vai_tro !== "KHACH_THUE" || !user.ma_khach_thue) throw Object.assign(new Error("Quyền truy cập bị từ chối"), { status: 403, code: "FORBIDDEN" });
  return { ma_khach_thue: user.ma_khach_thue };
}
const visibilityWhere = () => ({ [Op.or]: [{ loai_thanh_toan: "DINH_KY", da_gui: true }, { loai_thanh_toan: "SAU_THANH_LY" }] });
const isVisible = (bill) => Boolean(bill && (bill.loai_thanh_toan === "SAU_THANH_LY" || (bill.loai_thanh_toan === "DINH_KY" && bill.da_gui)));
async function readContext(now = new Date()) {
  const date = businessDate(now);
  const [year, month, day] = date.split("-").map(Number);
  return { date, period: date.slice(0, 7), local: { year, month, day }, config: await getPersistedSystemConfig() };
}
const periodKey = (bill) => Number(bill.nam) * 12 + Number(bill.thang);
const currentKey = (context) => context.local.year * 12 + context.local.month;
const isOverdue = (bill, context) => Number(bill.so_tien_con_no) > 0 && bill.loai_thanh_toan === "DINH_KY" && actionDue(bill, context.local, context.config).overdue;

function paymentView(row) {
  return pick(plain(row), ["ma_giao_dich", "ma_thanh_toan", "so_tien", "thoi_diem_ghi_nhan", "trang_thai_xac_nhan", "thoi_diem_xac_nhan", "nguon_thanh_toan", "ngay_huy"]);
}
function billView(row, context) {
  const bill = plain(row);
  const room = bill.hopDong?.phongTro;
  return {
    ...pick(bill, ["ma_thanh_toan", "ma_hop_dong", "thang", "nam", "loai_thanh_toan", "tong_phai_tra", "tong_da_thanh_toan", "so_tien_con_no", "trang_thai", "ngay_lap", "da_gui", "ngay_gui"]),
    isOverdue: isOverdue(bill, context),
    hopDong: { ma_hop_dong: bill.ma_hop_dong, phongTro: room ? {
      ...pick(room, ["ma_phong", "so_phong", "ma_can"]),
      ...(room.canTro ? { canTro: pick(room.canTro, ["ma_can", "ten_can"]) } : {}),
    } : null },
    chiTiets: (bill.chiTiets || []).filter((line) => line.ma_thanh_toan === bill.ma_thanh_toan)
      .map((line) => pick(line, ["loai_khoan", "so_tien", "dien_giai", "thoi_diem_tao"])),
    giaoDichs: (bill.giaoDichs || []).filter((payment) => payment.ma_thanh_toan === bill.ma_thanh_toan).map(paymentView),
  };
}
async function debtViews(rows, user, now) {
  tenantScope(user);
  const context = await readContext(now);
  return rows.map(plain).filter((bill) => bill.hopDong?.ma_khach_thue === user.ma_khach_thue
    && isVisible(bill) && periodKey(bill) <= currentKey(context)).map((bill) => billView(bill, context));
}
const sum = (rows, key) => roundedMoney(rows.reduce((total, row) => total + Number(row[key] ?? 0), 0));
const cashPayment = (payment) => payment.trang_thai_xac_nhan === "DA_XAC_NHAN" && payment.nguon_thanh_toan === "THU_TIEN";
const depositPayment = (payment) => payment.trang_thai_xac_nhan === "DA_XAC_NHAN" && payment.nguon_thanh_toan === "KHAU_TRU_COC";
async function getSummary(user, { now = new Date() } = {}) {
  const scope = tenantScope(user);
  return sequelize.transaction({ readOnly: true, isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async (transaction) => {
    const context = await readContext(now);
    const rows = await ThanhToan.findAll({ where: visibilityWhere(), transaction,
      include: [
        { model: HopDong, as: "hopDong", required: true, where: scope, attributes: ["ma_hop_dong", "ma_khach_thue"],
          include: [{ model: PhongTro, as: "phongTro", required: true, attributes: ["ma_phong", "ma_can", "so_phong"],
            include: [{ model: CanTro, as: "canTro", required: true, attributes: ["ma_can", "ten_can"] }] }] },
        { model: GiaoDichThanhToan, as: "giaoDichs" },
      ], order: [["nam", "ASC"], ["thang", "ASC"], ["ma_thanh_toan", "ASC"]],
    });
    const bills = rows.map(plain).filter(isVisible);
    const current = bills.filter((bill) => bill.loai_thanh_toan === "DINH_KY" && periodKey(bill) === currentKey(context));
    const old = bills.filter((bill) => bill.loai_thanh_toan === "DINH_KY" && periodKey(bill) < currentKey(context) && Number(bill.so_tien_con_no) > 0);
    const post = bills.filter((bill) => bill.loai_thanh_toan === "SAU_THANH_LY" && periodKey(bill) <= currentKey(context) && Number(bill.so_tien_con_no) > 0);
    const payments = current.flatMap((bill) => (bill.giaoDichs || []).filter((payment) => payment.ma_thanh_toan === bill.ma_thanh_toan));
    const currentRemaining = sum(current, "so_tien_con_no");
    const oldRemaining = sum(old, "so_tien_con_no");
    return {
      businessDate: context.date, currentPeriod: context.period,
      current: { count: current.length, totalDue: sum(current, "tong_phai_tra"), settledAmount: sum(current, "tong_da_thanh_toan"),
        cashReceived: sum(payments.filter(cashPayment), "so_tien"), depositOffset: sum(payments.filter(depositPayment), "so_tien"),
        remainingAmount: currentRemaining, pendingCount: payments.filter((payment) => payment.trang_thai_xac_nhan === "CHO_XAC_NHAN").length,
        isOverdue: current.some((bill) => isOverdue(bill, context)) },
      oldDebt: { count: old.length, remainingAmount: oldRemaining, isOverdue: old.some((bill) => isOverdue(bill, context)) },
      postLiquidationDebt: { count: post.length, remainingAmount: sum(post, "so_tien_con_no"), bills: post.map((bill) => billView(bill, context)) },
      totalRemainingDue: roundedMoney(currentRemaining + oldRemaining),
      isOverdue: [...current, ...old].some((bill) => isOverdue(bill, context)),
    };
  });
}

module.exports = { tenantScope, visibilityWhere, isVisible, readContext, billView, paymentView, debtViews, getSummary };
