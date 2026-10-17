const { ChiTietThanhToan, KhoanThu, GiaoDichThanhToan } = require("../models");

const roundMoney = (value) => Math.round(Number(value));

function billTotals(lines = [], fallbackNet = 0) {
  const gross = lines.filter((line) => line.loai_khoan !== "GIAM_TRU")
    .reduce((sum, line) => sum + Math.max(0, Number(line.so_tien)), 0);
  const discount = lines.filter((line) => line.loai_khoan === "GIAM_TRU")
    .reduce((sum, line) => sum + Math.abs(Number(line.so_tien)), 0);
  return { gross: gross || Number(fallbackNet), discount };
}

function calculateSnapshot({ amount, outstanding, netTotal, discountTotal, priorDiscount = 0 }) {
  amount = Number(amount);
  const remainingDiscount = Math.max(0, roundMoney(Number(discountTotal) - Number(priorDiscount)));
  const closesCurrentDebt = amount >= Number(outstanding) - 0.001;
  const allocatedDiscount = closesCurrentDebt
    ? remainingDiscount
    : Math.min(remainingDiscount, roundMoney(amount * Number(discountTotal) / (Number(netTotal) || 1)));
  return {
    doanh_thu_gop: roundMoney(amount + allocatedDiscount),
    giam_tru_phan_bo: allocatedDiscount,
    nguon_snapshot: "GHI_NHAN",
  };
}

async function buildSnapshot(bill, amount, transaction) {
  if (!bill || bill.loai_thanh_toan === "SAU_THANH_LY") return {};
  const lines = bill.chiTiets || await ChiTietThanhToan.findAll({ where: { ma_thanh_toan: bill.ma_thanh_toan }, transaction });
  const totals = billTotals(lines, bill.tong_phai_tra);
  const previous = await KhoanThu.findAll({
    where: { trang_thai_ghi_nhan: "HIEU_LUC" },
    include: [{ model: GiaoDichThanhToan, as: "giaoDich", required: true, where: { ma_thanh_toan: bill.ma_thanh_toan, nguon_thanh_toan: "THU_TIEN" } }],
    transaction,
  });
  return calculateSnapshot({
    amount,
    outstanding: bill.so_tien_con_no,
    netTotal: bill.tong_phai_tra,
    discountTotal: totals.discount,
    priorDiscount: previous.reduce((sum, row) => sum + Number(row.giam_tru_phan_bo || 0), 0),
  });
}

module.exports = { roundMoney, billTotals, calculateSnapshot, buildSnapshot };
