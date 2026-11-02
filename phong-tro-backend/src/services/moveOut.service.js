const crypto = require("crypto");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { TaiKhoan, KhachThue, HopDong, PhongTro, TaiSan, ChiSoDien, ThanhToan, ChiTietThanhToan, GiaoDichThanhToan, TienCoc, ThanhVienPhong, YeuCau, YeuCauTraPhong, BienBanTraPhong, KhoanKhauTru, ChiPhiSuCoKhachThue, ViPhamHopDong, ThongBao, GiaoDichHoanCoc } = require("../models");
const billService = require("./khoanPhaiThu.service");
const { writeAuditLog } = require("./auditLog.service");
const contractLifecycle = require("./contractLifecycle.service");
const { countBillableOccupants, calculateWaterCharge } = require("./occupancy.service");
const { BILL_LINE_TYPES } = require("../domain/billing.constants");
const { elapsedMonthRatio } = require("../utils/billingPeriod.util");
const { assertOwned } = require("./ownership.service");
const { businessDate } = require("../utils/businessDate.util");
const ownerUser = (actorId) => ({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId });

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const money = (value) => Math.round(Number(value) * 100) / 100;
function amount(value, label) { const n = Number(value || 0); if (!Number.isFinite(n) || n < 0) throw fail(422, `${label} không hợp lệ`, "INVALID_SETTLEMENT_AMOUNT"); return money(n); }
function validateChecklist(payload) {
  if (payload.assetsChecked !== true) throw fail(422, "Chưa xác nhận kiểm tra tài sản", "ASSETS_NOT_CHECKED");
  if (payload.debtReviewed !== true) throw fail(422, "Chưa xác nhận đối chiếu công nợ", "DEBT_NOT_REVIEWED");
  if (!String(payload.roomCondition || "").trim()) throw fail(422, "Thiếu kết quả kiểm tra phòng", "ROOM_CONDITION_REQUIRED");
  return amount(payload.deduction, "Khấu trừ khác");
}
const dayRatio = elapsedMonthRatio;
async function approvedRequest(contractId, transaction) {
  const details = await YeuCauTraPhong.findAll({ where: { ma_hop_dong: contractId }, order: [["ngay_tra_da_duyet", "DESC"]], transaction });
  for (const detail of details) if ((await YeuCau.findByPk(detail.ma_yeu_cau, { transaction }))?.trang_thai === "DA_PHE_DUYET") return detail;
  return null;
}
async function getContext(contractId, actorId) {
  if (actorId) await assertOwned(ownerUser(actorId), "contract", contractId);
  const contract = await HopDong.findByPk(contractId, { include: [{ model: KhachThue, as: "khachThue" }, { model: PhongTro, as: "phongTro" }] });
  if (!contract) throw fail(404, "Không tìm thấy hợp đồng", "CONTRACT_NOT_FOUND");
  if (contract.trang_thai === "DA_THANH_LY") throw fail(409, "Hợp đồng đã thanh lý", "CONTRACT_ALREADY_LIQUIDATED");
  const [deposit, reading, assets, debts, incidents, violations, request, occupants] = await Promise.all([
    TienCoc.findOne({ where: { ma_hop_dong: contractId } }),
    ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, da_xoa: false, trang_thai_xac_nhan: "DA_XAC_NHAN" }, order: [["ngay_ghi_nhan", "DESC"], ["ma_chi_so", "DESC"]] }),
    TaiSan.findAll({ where: { ma_phong: contract.ma_phong } }),
    ThanhToan.findAll({ where: { ma_hop_dong: contractId, so_tien_con_no: { [Op.gt]: 0 }, [Op.or]: [{ loai_thanh_toan: { [Op.ne]: "DINH_KY" } }, { da_gui: true }] } }),
    ChiPhiSuCoKhachThue.findAll({ where: { ma_hop_dong: contractId, trang_thai: "CHO_KHAU_TRU" } }),
    ViPhamHopDong.findAll({ where: { ma_hop_dong: contractId } }), approvedRequest(contractId),
    countBillableOccupants(contractId),
  ]);
  return { tenant: contract.khachThue, room: contract.phongTro, contract, deposit, latestElectricityReading: reading, assets, outstandingBills: debts, outstandingDebt: debts.reduce((s, r) => s + Number(r.so_tien_con_no), 0), pendingIncidentCharges: incidents, violations, approvedMoveOutDate: request?.ngay_tra_da_duyet || null, occupantCount: occupants };
}
async function settle(contractId, payload, actorId, { now = new Date() } = {}) {
  const other = validateChecklist(payload);
  return sequelize.transaction(async (transaction) => {
    const contract = await HopDong.findByPk(contractId, { transaction, lock: transaction.LOCK.UPDATE });
    await assertOwned(ownerUser(actorId), "contract", contractId, { transaction });
    if (!contract || contract.trang_thai === "DA_THANH_LY") throw fail(409, "Hợp đồng không còn hiệu lực", "CONTRACT_NOT_ACTIVE");
    if (await BienBanTraPhong.findOne({ where: { ma_hop_dong: contractId }, transaction, lock: transaction.LOCK.UPDATE })) throw fail(409, "Hợp đồng đã quyết toán", "MOVE_OUT_ALREADY_SETTLED");
    const room = await PhongTro.findByPk(contract.ma_phong, { transaction, lock: transaction.LOCK.UPDATE });
    if (!room || room.trang_thai !== "DANG_XU_LY_TRA_PHONG") throw fail(409, "Phòng chưa sẵn sàng trả", "ROOM_NOT_READY_FOR_MOVE_OUT");
    const request = await approvedRequest(contractId, transaction);
    if (!request) throw fail(422, "Yêu cầu trả phòng chưa duyệt", "INVALID_MOVE_OUT_REQUEST");
    const settlementDate = businessDate(payload.inspectionDate || request.ngay_tra_da_duyet || now);
    const period = dayRatio(settlementDate);
    const previous = await ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, da_xoa: false, trang_thai_xac_nhan: "DA_XAC_NHAN" }, order: [["ngay_ghi_nhan", "DESC"], ["ma_chi_so", "DESC"]], transaction, lock: transaction.LOCK.UPDATE });
    const finalValue = Number(payload.finalElectricityReading);
    if (!previous || !Number.isFinite(finalValue) || finalValue < Number(previous.chi_so_moi)) throw fail(422, "Chỉ số điện cuối không hợp lệ", "INVALID_FINAL_METER_READING");
    const electricity = money((finalValue - Number(previous.chi_so_moi)) * Number(contract.don_gia_dien));
    await ChiSoDien.create({ ma_phong: contract.ma_phong, nam: period.year, thang: period.month, loai_chi_so: "CHOT_TRA_PHONG", khoa_nghiep_vu: contractId, chi_so_moi: finalValue, don_gia_ap_dung: contract.don_gia_dien, trang_thai_xac_nhan: "DA_XAC_NHAN", ngay_ghi_nhan: new Date(`${settlementDate}T16:59:00Z`), nguoi_ghi_nhan_id: actorId, nguoi_xac_nhan_id: actorId, ngay_xac_nhan: new Date(), da_xoa: false }, { transaction });
    const deposit = await TienCoc.findOne({ where: { ma_hop_dong: contractId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!deposit || deposit.trang_thai === "CHUA_NHAN") throw fail(422, "Chưa nhận cọc", "DEPOSIT_NOT_RECEIVED");
    const occupants = await countBillableOccupants(contractId, { transaction });
    const water = calculateWaterCharge(contract.don_gia_nuoc, occupants, period.ratio);
    const currentBill = await ThanhToan.findOne({ where: { ma_hop_dong: contractId, nam: period.year, thang: period.month, loai_thanh_toan: "DINH_KY" }, include: [{ model: ChiTietThanhToan, as: "chiTiets" }], transaction, lock: transaction.LOCK.UPDATE });
    const prepaid = currentBill?.da_gui && currentBill.trang_thai === "DA_THANH_TOAN" && currentBill.chiTiets.some((x) => x.loai_khoan === BILL_LINE_TYPES.RENT);
    const prepaidRefund = prepaid ? money(Number(contract.gia_thue) * (1 - period.ratio)) : 0;
    const rent = prepaid ? 0 : money(Number(contract.gia_thue) * period.ratio);
    const debts = await ThanhToan.findAll({ where: { ma_hop_dong: contractId, so_tien_con_no: { [Op.gt]: 0 }, loai_thanh_toan: "DINH_KY", da_gui: true }, transaction, lock: transaction.LOCK.UPDATE });
    const debtTotal = money(debts.reduce((s, x) => s + Number(x.so_tien_con_no), 0));
    const incidents = await ChiPhiSuCoKhachThue.findAll({ where: { ma_hop_dong: contractId, trang_thai: "CHO_KHAU_TRU" }, transaction, lock: transaction.LOCK.UPDATE });
    const violationInput = Array.isArray(payload.violationDeductions) ? payload.violationDeductions : [];
    const violationIds = violationInput.map((x) => x.violationId).filter(Boolean);
    const violations = violationIds.length ? await ViPhamHopDong.findAll({ where: { ma_hop_dong: contractId, ma_vi_pham: { [Op.in]: violationIds } }, transaction, lock: transaction.LOCK.UPDATE }) : [];
    if (violations.length !== new Set(violationIds).size) throw fail(422, "Vi phạm không hợp lệ", "INVALID_VIOLATION_DEDUCTION");
    const assetInput = Array.isArray(payload.assetDeductions) ? payload.assetDeductions : [];
    const assetIds = assetInput.map((x) => x.assetId).filter(Boolean);
    const assets = assetIds.length ? await TaiSan.findAll({ where: { ma_phong: contract.ma_phong, ma_tai_san: { [Op.in]: assetIds } }, transaction, lock: transaction.LOCK.UPDATE }) : [];
    if (assets.length !== new Set(assetIds).size) throw fail(422, "Tài sản không hợp lệ", "INVALID_ASSET_DEDUCTION");
    const lines = [
      { type: "CONG_NO", amount: debtTotal, reason: "Công nợ cũ" }, { type: "TIEN_DIEN_CUOI", amount: electricity, reason: "Điện cuối kỳ" },
      { type: "TIEN_NUOC_CUOI", amount: water, reason: "Nước cuối kỳ" }, { type: "TIEN_PHONG_THANG_LE", amount: rent, reason: "Tiền phòng tháng lẻ" },
      ...incidents.map((x) => ({ type: "SUA_CHUA_SU_CO", amount: Number(x.so_tien), reason: x.can_cu_trach_nhiem, incidentId: x.ma_chi_phi_su_co })),
      ...violations.map((x) => { const i = violationInput.find((v) => v.violationId === x.ma_vi_pham); return { type: "VI_PHAM_HOP_DONG", amount: amount(i?.amount ?? x.muc_phat, "Mức phạt"), reason: x.noi_dung, violationId: x.ma_vi_pham }; }),
      ...assets.map((x) => { const i = assetInput.find((v) => v.assetId === x.ma_tai_san); return { type: "TAI_SAN_HONG_MAT", amount: amount(i.amount, "Bồi thường"), reason: i.reason || x.ten_tai_san, assetId: x.ma_tai_san, quantity: Number(i.quantity || 1) }; }),
      { type: payload.deductionType || "KHAC", amount: other, reason: payload.reason || "Khấu trừ khác" },
    ].filter((x) => x.amount > 0);
    const totalDeduction = money(lines.reduce((s, x) => s + x.amount, 0));
    const depositAmount = Number(deposit.so_tien_coc); const net = money(depositAmount + prepaidRefund - totalDeduction); const refund = Math.max(net, 0); const postDebt = Math.max(-net, 0);
    const snapshot = { previousElectricityReading: Number(previous.chi_so_moi), finalElectricityReading: finalValue, electricity, water, occupants, dayRatio: period.ratio, proratedRent: rent, prepaidRentRefund: prepaidRefund, debtTotal, lines };
    const report = await BienBanTraPhong.create({ ngay_kiem_tra: settlementDate, ngay_quyet_toan: settlementDate, tinh_trang_phong: String(payload.roomCondition).trim(), ghi_chu: payload.reason || null, tong_khoan_khau_tru: totalDeduction, so_tien_coc_duoc_hoan: refund, tien_coc_ban_dau: depositAmount, tien_phong_tra_truoc_duoc_hoan: prepaidRefund, gia_tri_quyet_toan_rong: net, so_tien_no_sau_thanh_ly: postDebt, cong_thuc_quyet_toan: "tienCocBanDau + tienPhongTraTruocDuocHoan - tongKhoanKhauTru", snapshot_json: snapshot, la_du_lieu_legacy: false, ma_hop_dong: contractId, ma_yeu_cau_tra_phong: request.ma_yeu_cau, nguoi_lap_id: actorId }, { transaction });
    for (const line of lines) await KhoanKhauTru.create({ loai_khau_tru: line.type, ly_do: line.reason, so_tien: line.amount, ma_bien_ban_tra_phong: report.ma_bien_ban, ma_tai_san: line.assetId || null, so_luong_tai_san: line.quantity || null, ma_vi_pham: line.violationId || null, ma_chi_phi_su_co: line.incidentId || null }, { transaction });
    for (const x of incidents) await x.update({ trang_thai: "DA_KHAU_TRU", ngay_khau_tru: new Date() }, { transaction });
    let offset = Math.min(depositAmount, debtTotal);
    for (const bill of debts) { const paid = Math.min(offset, Number(bill.so_tien_con_no)); if (paid <= 0) break; await GiaoDichThanhToan.create({ ma_giao_dich: crypto.randomUUID(), ma_thanh_toan: bill.ma_thanh_toan, so_tien: paid, nguon_thanh_toan: "KHAU_TRU_COC", thoi_diem_ghi_nhan: new Date(), trang_thai_xac_nhan: "DA_XAC_NHAN", thoi_diem_xac_nhan: new Date() }, { transaction }); await billService.updateBillStatus(bill.ma_thanh_toan, transaction); offset -= paid; }
    if (postDebt > 0) { const bill = await ThanhToan.create({ ma_hop_dong: contractId, thang: period.month, nam: period.year, loai_thanh_toan: "SAU_THANH_LY", ma_bien_ban_tra_phong: report.ma_bien_ban, tong_phai_tra: postDebt, tong_da_thanh_toan: 0, so_tien_con_no: postDebt, trang_thai: "CHUA_THANH_TOAN" }, { transaction }); await ChiTietThanhToan.create({ ma_thanh_toan: bill.ma_thanh_toan, loai_khoan: BILL_LINE_TYPES.POST_LIQUIDATION_DEBT, so_tien: postDebt, dien_giai: "Nợ sau thanh lý", nguoi_thuc_hien_id: actorId }, { transaction }); }
    await deposit.update({ so_tien_da_khau_tru: Math.min(depositAmount, totalDeduction), trang_thai: totalDeduction >= depositAmount ? "DA_KHAU_TRU_TOAN_BO" : totalDeduction > 0 ? "DA_KHAU_TRU_MOT_PHAN" : "DA_NHAN" }, { transaction });
    await ThanhVienPhong.update({ trang_thai_cu_tru: "DA_ROI", ngay_roi: settlementDate }, { where: { ma_hop_dong: contractId, trang_thai_cu_tru: "DANG_O" }, transaction });
    const before = contract.get({ plain: true }); await contract.update({ trang_thai: "DA_THANH_LY", ngay_thanh_ly: settlementDate }, { transaction });
    await contractLifecycle.recordChange({ contract, before, after: contract, reason: payload.reason || "Thanh lý", actorId, transaction, action: "LIQUIDATED" }); await room.update({ trang_thai: "TRONG" }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "MOVE_OUT_SETTLED", entityType: "BienBanTraPhong", entityId: report.ma_bien_ban, after: { totalDeduction, refund, postDebt } });
    const tenant = await KhachThue.findByPk(contract.ma_khach_thue, { transaction });
    if (tenant?.ma_tai_khoan) { await require("./notification.service").createIdempotent({ loai_thong_bao: "THANH_LY_HOP_DONG", noi_dung: "Hợp đồng đã thanh lý.", thoi_diem_tao: new Date(), ma_tai_khoan: tenant.ma_tai_khoan, khoa_su_kien: `THANH_LY_HOP_DONG:${contractId}` }, { transaction }); if (await HopDong.count({ where: { ma_khach_thue: contract.ma_khach_thue, ma_hop_dong: { [Op.ne]: contractId }, trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] } }, transaction }) === 0) await TaiKhoan.update({ trang_thai: "DA_KHOA" }, { where: { ma_tai_khoan: tenant.ma_tai_khoan, vai_tro: "KHACH_THUE" }, transaction }); }
    return { report, totalDeduction, refund, postDebt, snapshot };
  });
}
async function recordDepositRefund(reportId, payload, actorId, { now = new Date() } = {}) {
  const key = String(payload.khoaChongTrung || "").trim(); const refundAmount = amount(payload.soTien, "Số tiền hoàn");
  if (!key || refundAmount <= 0) throw fail(422, "Thiếu thông tin hoàn cọc", "INVALID_DEPOSIT_REFUND");
  return sequelize.transaction(async (transaction) => {
    await assertOwned(ownerUser(actorId), "moveOut", reportId, { transaction });
    const old = await GiaoDichHoanCoc.findOne({ where: { khoa_chong_trung: key }, transaction, lock: transaction.LOCK.UPDATE });
    if (old) { if (old.ma_bien_ban_tra_phong !== reportId || Number(old.so_tien) !== refundAmount) throw fail(409, "Khóa chống trùng xung đột", "IDEMPOTENCY_CONFLICT"); return old; }
    const report = await BienBanTraPhong.findByPk(reportId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!report || report.la_du_lieu_legacy) throw fail(409, "Biên bản không hỗ trợ hoàn cọc", "REFUND_REPORT_NOT_ELIGIBLE");
    const deposit = await TienCoc.findOne({ where: { ma_hop_dong: report.ma_hop_dong }, transaction, lock: transaction.LOCK.UPDATE });
    if (Number(deposit.so_tien_da_hoan) + refundAmount > Number(report.so_tien_coc_duoc_hoan)) throw fail(422, "Hoàn vượt số được hoàn", "DEPOSIT_REFUND_EXCEEDED");
    const row = await GiaoDichHoanCoc.create({ ma_bien_ban_tra_phong: reportId, ma_tien_coc: deposit.ma_tien_coc, ngay_hoan: businessDate(payload.ngayHoan || now), so_tien: refundAmount, nguoi_ghi_nhan_id: actorId, khoa_chong_trung: key }, { transaction });
    const total = Number(deposit.so_tien_da_hoan) + refundAmount; await deposit.update({ so_tien_da_hoan: total, trang_thai: total === Number(report.so_tien_coc_duoc_hoan) ? "DA_HOAN" : deposit.trang_thai }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "DEPOSIT_REFUND_RECORDED", entityType: "GiaoDichHoanCoc", entityId: row.ma_giao_dich_hoan_coc, after: { reportId, refundAmount, total } }); return row;
  });
}
module.exports = { settle, validateChecklist, getContext, recordDepositRefund, dayRatio };
