const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { HopDong, PhongTro, CanTro, YeuCau, YeuCauGiaHan, YeuCauTraPhong, DeXuatBanCungPhong } = require("../models");
const { assertOwned, getOwnedBuildingIds, getLandlordAccountForRoom, notFoundError } = require("./ownership.service");
const { businessDate, addBusinessDays } = require("../utils/businessDate.util");
const { getPersistedSystemConfig } = require("./systemConfig.service");
const lifecycle = require("./contractLifecycle.service");
const notification = require("./notification.service");
const { writeAuditLog } = require("./auditLog.service");
const { attachRequestRooms } = require("../utils/requestBuildingScope");
const { findContractRequest, assertNoConflict } = require("./requestConflict.service");
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

function packages(contract) {
  if (contract.goi_gia_han_cho_phep == null) return [6, 12];
  if (!["6", "12", "6,12"].includes(contract.goi_gia_han_cho_phep)) return [];
  return contract.goi_gia_han_cho_phep.split(",").map(Number);
}
function eligibility(contract, config, today = businessDate(new Date(), config.timezone)) {
  if (!["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai)) return "CONTRACT_NOT_ACTIVE";
  if (!contract.ngay_ket_thuc) return "CONTRACT_END_DATE_MISSING";
  if (contract.ngay_ket_thuc < today) return "CONTRACT_EXPIRED";
  if (contract.ngay_ket_thuc > addBusinessDays(today, config.contractWarningDays)) return "CONTRACT_NOT_EXPIRING";
  if (!packages(contract).length) return "RENEWAL_PACKAGES_UNAVAILABLE";
  return null;
}
function validatePayload(body) {
  if (Object.keys(body).some((key) => /date|ngay|end/i.test(key))) throw fail(400, "CLIENT_RENEWAL_DATE_FORBIDDEN", "Ngày gia hạn do hệ thống tính; không gửi ngày tự nhập");
  if (Object.keys(body).some((key) => !["type", "contractId", "packageMonths", "content"].includes(key))) throw fail(400, "INVALID_RENEWAL_PAYLOAD", "Tham số yêu cầu gia hạn không hợp lệ");
  if (body.type !== "GIA_HAN" || ![6, 12].includes(body.packageMonths) || typeof body.contractId !== "string" || !body.contractId) throw fail(400, "INVALID_RENEWAL_PACKAGE", "Vui lòng chọn hợp đồng và gói 6 hoặc 12 tháng");
  if (typeof body.content !== "string" || !body.content.trim() || body.content.trim().length > 1000) throw fail(400, "INVALID_RENEWAL_CONTENT", "Nội dung từ 1 đến 1000 ký tự là bắt buộc");
}
async function pending(contractId, transaction) {
  const details = await YeuCauGiaHan.findAll({ where: { ma_hop_dong: contractId }, attributes: ["ma_yeu_cau"], transaction, raw: true });
  return YeuCau.findOne({ where: { ma_yeu_cau: { [Op.in]: details.map((r) => r.ma_yeu_cau) }, loai_yeu_cau: "GIA_HAN", trang_thai: "CHO_XU_LY" }, transaction });
}
async function context(user) {
  const config = await getPersistedSystemConfig();
  const today = businessDate(new Date(), config.timezone);
  const rows = await HopDong.findAll({ where: { ma_khach_thue: user.ma_khach_thue }, include: [{ model: PhongTro, as: "phongTro", include: [{ model: CanTro, as: "canTro", attributes: ["ten_can"] }] }], order: [["ngay_ket_thuc", "DESC"], ["ma_hop_dong", "ASC"]] });
  const contracts = [];
  for (const row of rows) {
    const waiting = await pending(row.ma_hop_dong);
    const conflict = await findContractRequest(row.ma_hop_dong, "TRA_PHONG");
    const reasonCode = eligibility(row, config, today) || (waiting ? "RENEWAL_ALREADY_PENDING" : null) || (conflict ? "CONTRACT_REQUEST_CONFLICT" : null);
    contracts.push({ contractId: row.ma_hop_dong, roomName: row.phongTro?.so_phong ?? null, buildingName: row.phongTro?.canTro?.ten_can ?? null, currentEndDate: row.ngay_ket_thuc, contractStatus: row.trang_thai, eligible: !reasonCode, reasonCode, pendingRequest: waiting ? { id: waiting.ma_yeu_cau, status: waiting.trang_thai } : null, allowedPackages: row.ngay_ket_thuc ? packages(row).map((months) => ({ months, expectedEndDate: lifecycle.addRenewalMonths(row.ngay_ket_thuc, months) })) : [] });
  }
  return { today, contracts };
}
async function create(user, body) {
  validatePayload(body);
  const config = await getPersistedSystemConfig();
  return sequelize.transaction(async (transaction) => {
    // All creates for a contract serialize on the existing contract row.
    const contract = await HopDong.findByPk(body.contractId, { transaction, lock: transaction.LOCK.UPDATE });
    await assertOwned(user, "contract", body.contractId, { transaction });
    if (!contract || contract.ma_khach_thue !== user.ma_khach_thue) throw notFoundError();
    const reason = eligibility(contract, config);
    if (reason) throw fail(409, reason, "Hợp đồng chưa đủ điều kiện gửi yêu cầu gia hạn");
    if (!packages(contract).includes(body.packageMonths)) throw fail(400, "RENEWAL_PACKAGE_NOT_ALLOWED", "Gói gia hạn không được hợp đồng cho phép");
    if (await pending(contract.ma_hop_dong, transaction)) throw fail(409, "RENEWAL_ALREADY_PENDING", "Hợp đồng đã có yêu cầu gia hạn chờ xử lý");
    await assertNoConflict(contract.ma_hop_dong, "GIA_HAN", { transaction });
    const row = await YeuCau.create({ loai_yeu_cau: "GIA_HAN", trang_thai: "CHO_XU_LY", noi_dung: body.content.trim(), ma_khach_thue: user.ma_khach_thue }, { transaction });
    await YeuCauGiaHan.create({ ma_yeu_cau: row.ma_yeu_cau, ma_hop_dong: contract.ma_hop_dong, goi_gia_han_thang: body.packageMonths, ngay_ket_thuc_de_xuat: lifecycle.addRenewalMonths(contract.ngay_ket_thuc, body.packageMonths) }, { transaction });
    const ownerAccount = await getLandlordAccountForRoom(contract.ma_phong, transaction);
    if (!ownerAccount) throw fail(409, "CONTRACT_OWNER_MISSING", "Hợp đồng chưa có Chủ trọ nhận yêu cầu");
    await notification.createIdempotent({ ma_tai_khoan: ownerAccount, loai_thong_bao: "YEU_CAU", noi_dung: "Có yêu cầu gia hạn hợp đồng mới chờ xử lý.", khoa_su_kien: `YEU_CAU_MOI:${row.ma_yeu_cau}`, thoi_diem_tao: new Date() }, { transaction });
    await writeAuditLog({ transaction, actorId: user.ma_tai_khoan, action: "RENEWAL_REQUEST_CREATED", entityType: "YeuCau", entityId: row.ma_yeu_cau, after: { contractId: contract.ma_hop_dong, packageMonths: body.packageMonths } });
    return row;
  });
}
async function approve(row, actorId, transaction) {
  const detail = await YeuCauGiaHan.findByPk(row.ma_yeu_cau, { transaction, lock: transaction.LOCK.UPDATE });
  if (!detail) throw notFoundError();
  if (detail.goi_gia_han_thang == null) throw fail(409, "LEGACY_RENEWAL_PACKAGE_MISSING", "Yêu cầu cũ thiếu gói gia hạn; vui lòng từ chối để Khách thuê gửi lại");
  const contract = await HopDong.findByPk(detail.ma_hop_dong, { transaction, lock: transaction.LOCK.UPDATE });
  const config = await getPersistedSystemConfig();
  if (!contract || contract.ma_khach_thue !== row.ma_khach_thue || eligibility(contract, config) || !packages(contract).includes(detail.goi_gia_han_thang)) throw fail(409, "RENEWAL_NO_LONGER_ELIGIBLE", "Yêu cầu không còn đủ điều kiện gia hạn; vui lòng từ chối");
  await assertNoConflict(contract.ma_hop_dong, "GIA_HAN", { transaction });
  const oldEndDate = contract.ngay_ket_thuc;
  const newEndDate = lifecycle.addRenewalMonths(oldEndDate, detail.goi_gia_han_thang);
  await contract.update({ ngay_ket_thuc: newEndDate, trang_thai: "DANG_HIEU_LUC" }, { transaction });
  await lifecycle.recordRenewal({ contract, oldEndDate, newEndDate, months: detail.goi_gia_han_thang, actorId, transaction });
  return { type: "CONTRACT_RENEWED", contractId: contract.ma_hop_dong, endDate: newEndDate };
}
async function list(user) {
  const rows = await YeuCau.findAll({ where: user.vai_tro === "KHACH_THUE" ? { ma_khach_thue: user.ma_khach_thue } : {}, order: [["ngay_gui", "DESC"]] });
  const ids = rows.map((r) => r.ma_yeu_cau);
  const where = { ma_yeu_cau: { [Op.in]: ids } };
  const [renewals, moveOuts, proposals] = await Promise.all([YeuCauGiaHan.findAll({ where, raw: true }), YeuCauTraPhong.findAll({ where, raw: true }), DeXuatBanCungPhong.findAll({ where, attributes: ["ma_yeu_cau", "ma_phong"], raw: true })]);
  const contractIds = [...new Set([...renewals, ...moveOuts].map((d) => d.ma_hop_dong))];
  const contracts = await HopDong.findAll({ where: { ma_hop_dong: { [Op.in]: contractIds } }, attributes: ["ma_hop_dong", "ma_phong", "ma_khach_thue", "trang_thai"], raw: true });
  const result = attachRequestRooms(rows, renewals, moveOuts, proposals, contracts);
  const buildings = user.vai_tro === "CHU_TRO" ? await getOwnedBuildingIds(user) : null;
  const rooms = buildings ? await PhongTro.findAll({ where: { ma_can: { [Op.in]: buildings } }, attributes: ["ma_phong"], raw: true }) : [];
  const ownedRooms = new Set(rooms.map((r) => r.ma_phong));
  return result.filter((r) => !buildings || ownedRooms.has(r.ma_phong)).map((r) => {
    const d = renewals.find((v) => v.ma_yeu_cau === r.ma_yeu_cau);
    const m = moveOuts.find((v) => v.ma_yeu_cau === r.ma_yeu_cau);
    const c = m && contracts.find((v) => v.ma_hop_dong === m.ma_hop_dong);
    if (user.vai_tro === "KHACH_THUE" && m && (!c || c.ma_khach_thue !== user.ma_khach_thue)) return null;
    const extra = d ? { renewal: { contractId: d.ma_hop_dong, packageMonths: d.goi_gia_han_thang, expectedEndDate: d.ngay_ket_thuc_de_xuat, legacyPackageMissing: d.goi_gia_han_thang == null } } : m ? { moveOut: { contractId: m.ma_hop_dong, requestedDate: m.ngay_tra_du_kien, approvedDate: m.ngay_tra_da_duyet, earlyReturnReason: m.ly_do_tra_som, minimumNormalMoveOutDate: addBusinessDays(r.ngay_gui, 30), contractStatus: c?.trang_thai ?? null, settled: c?.trang_thai === "DA_THANH_LY" } } : {};
    if (user.vai_tro === "CHU_TRO") return { ...r, ...extra };
    return { ma_yeu_cau: r.ma_yeu_cau, loai_yeu_cau: r.loai_yeu_cau, noi_dung: r.noi_dung, trang_thai: r.trang_thai, ngay_gui: r.ngay_gui, ly_do_xu_ly: r.ly_do_xu_ly, ngay_duyet: r.ngay_duyet, ma_phong: r.ma_phong, ...extra };
  }).filter(Boolean);
}
module.exports = { packages, eligibility, validatePayload, context, create, approve, list };
