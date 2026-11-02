const Joi = require("joi");
const { Transaction } = require("sequelize");
const sequelize = require("../config/database");
const { HopDong, KhachThue, PhongTro, CanTro, TienCoc, BienBanTraPhong, KhoanKhauTru, GiaoDichHoanCoc } = require("../models");
const ownership = require("./ownership.service");

const depositFields = ["so_tien_coc", "ngay_nhan_coc", "trang_thai", "so_tien_da_hoan", "so_tien_da_khau_tru"];
const settlementFields = ["ngay_quyet_toan", "la_du_lieu_legacy", "tien_coc_ban_dau", "tien_phong_tra_truoc_duoc_hoan", "tong_khoan_khau_tru", "so_tien_coc_duoc_hoan", "gia_tri_quyet_toan_rong", "so_tien_no_sau_thanh_ly"];
const deductionFields = ["loai_khau_tru", "ly_do", "so_tien", "ghi_chu"];
const refundFields = ["ngay_hoan", "so_tien"];
const pick = (row, fields) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
const matches = (row, expected) => Boolean(row && Object.entries(expected).every(([key, value]) => value != null && row[key] === value));
const receivedStates = new Set(["DA_NHAN", "DA_HOAN", "DA_KHAU_TRU_MOT_PHAN", "DA_KHAU_TRU_TOAN_BO"]);

async function getTenantDeposit(user, contractId) {
  if (user?.vai_tro !== "KHACH_THUE") throw Object.assign(new Error("Quyền truy cập bị từ chối"), { status: 403, code: "FORBIDDEN" });
  if (Joi.string().uuid().required().validate(contractId).error) throw ownership.notFoundError();
  return sequelize.transaction({ readOnly: true, isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async (transaction) => {
    await ownership.assertOwned(user, "contract", contractId, { transaction });
    const contract = await HopDong.findByPk(contractId, {
      attributes: ["ma_hop_dong", "ma_khach_thue", "ma_phong"], transaction,
      include: [
        { model: KhachThue, as: "khachThue", required: true, attributes: ["ma_khach_thue"] },
        { model: PhongTro, as: "phongTro", required: true, attributes: ["ma_phong", "ma_can"],
          include: [{ model: CanTro, as: "canTro", required: true, attributes: ["ma_can"] }] },
      ],
    });
    if (!matches(contract, { ma_hop_dong: contractId })
      || !matches(contract.khachThue, { ma_khach_thue: contract.ma_khach_thue })
      || !matches(contract.phongTro, { ma_phong: contract.ma_phong })
      || !matches(contract.phongTro.canTro, { ma_can: contract.phongTro.ma_can })) throw ownership.notFoundError();

    const deposit = await TienCoc.findOne({ where: { ma_hop_dong: contractId }, attributes: ["ma_tien_coc", "ma_hop_dong", ...depositFields], raw: true, transaction });
    const settlement = await BienBanTraPhong.findOne({ where: { ma_hop_dong: contractId }, attributes: ["ma_bien_ban", "ma_hop_dong", ...settlementFields], raw: true, transaction });
    if ((deposit && !matches(deposit, { ma_hop_dong: contractId }))
      || (settlement && !matches(settlement, { ma_hop_dong: contractId }))) throw ownership.notFoundError();

    const deductions = settlement ? await KhoanKhauTru.findAll({
      where: { ma_bien_ban_tra_phong: settlement.ma_bien_ban },
      attributes: ["ma_bien_ban_tra_phong", ...deductionFields], order: [["ma_khau_tru", "ASC"]], raw: true, transaction,
    }) : [];
    const refunds = deposit && settlement ? await GiaoDichHoanCoc.findAll({
      where: { ma_bien_ban_tra_phong: settlement.ma_bien_ban, ma_tien_coc: deposit.ma_tien_coc },
      attributes: ["ma_bien_ban_tra_phong", "ma_tien_coc", ...refundFields], order: [["ngay_hoan", "ASC"], ["ma_giao_dich_hoan_coc", "ASC"]], raw: true, transaction,
    }) : [];
    // Two independent refund FKs are not proof that report and deposit share a contract.
    const safeDeductions = deductions.filter((row) => matches(row, { ma_bien_ban_tra_phong: settlement.ma_bien_ban }));
    const safeRefunds = refunds.filter((row) => matches(row, { ma_bien_ban_tra_phong: settlement.ma_bien_ban, ma_tien_coc: deposit.ma_tien_coc }));
    const dataWarnings = [];
    if (deposit && !((deposit.trang_thai === "CHUA_NHAN" && !deposit.ngay_nhan_coc)
      || (receivedStates.has(deposit.trang_thai) && deposit.ngay_nhan_coc))) dataWarnings.push("RECEIPT_DATA_INCOMPLETE");
    if (deposit && Number(deposit.so_tien_da_hoan) > 0 && !safeRefunds.length) dataWarnings.push("REFUND_DETAILS_UNAVAILABLE");
    if (settlement?.la_du_lieu_legacy) dataWarnings.push("LEGACY_SETTLEMENT");
    if (settlement && settlementFields.some((field) => settlement[field] == null)) dataWarnings.push("SETTLEMENT_DATA_INCOMPLETE");
    if (safeDeductions.length !== deductions.length || safeRefunds.length !== refunds.length) dataWarnings.push("RELATED_RECORDS_UNAVAILABLE");
    return {
      ma_hop_dong: contractId,
      deposit: deposit ? pick(deposit, depositFields) : null,
      settlement: settlement ? pick(settlement, settlementFields) : null,
      deductions: safeDeductions.map((row) => pick(row, deductionFields)),
      refunds: safeRefunds.map((row) => pick(row, refundFields)), dataWarnings,
    };
  });
}

module.exports = { getTenantDeposit };
