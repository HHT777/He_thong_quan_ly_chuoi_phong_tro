const sequelize = require("../config/database");
const { HopDong, PhongTro, ChiSoDien, ThanhVienPhong, KhachThue, ThongBao, LichSuChuyenPhong } = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const lifecycle = require("./contractLifecycle.service");
const { assertOwned } = require("./ownership.service");
const { businessDate } = require("../utils/businessDate.util");

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const dateOnly = (value) => businessDate(value || new Date());

function positiveReading(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw fail(422, `${field} không hợp lệ`, "INVALID_TRANSFER_READING");
  return number;
}

async function closeOrCreateReading({ roomId, date, value, unitPrice, actorId, transaction, initial, contractId }) {
  const parsed = new Date(`${date}T00:00:00Z`);
  const period = { nam: parsed.getUTCFullYear(), thang: parsed.getUTCMonth() + 1 };
  const businessKey = `${contractId}:${date}:${initial ? "MOI" : "CU"}`;
  const existing = await ChiSoDien.findOne({ where: { ma_phong: roomId, loai_chi_so: "CHUYEN_PHONG", khoa_nghiep_vu: businessKey, da_xoa: false }, transaction, lock: transaction.LOCK.UPDATE });
  if (existing) {
    if (Number(existing.chi_so_moi) !== value) {
      throw fail(409, initial ? "Phòng đích đã có chỉ số khác trong kỳ chuyển" : "Phòng cũ đã có chỉ số khác trong kỳ chuyển", "TRANSFER_METER_PERIOD_CONFLICT");
    }
    if (existing.trang_thai_xac_nhan !== "DA_XAC_NHAN") {
      await existing.update({ trang_thai_xac_nhan: "DA_XAC_NHAN", nguoi_xac_nhan_id: actorId, ngay_xac_nhan: new Date() }, { transaction });
    }
    return existing;
  }
  return ChiSoDien.create({
    ...period,
    loai_chi_so: "CHUYEN_PHONG",
    khoa_nghiep_vu: businessKey,
    chi_so_moi: value,
    don_gia_ap_dung: unitPrice,
    trang_thai_xac_nhan: "DA_XAC_NHAN",
    ngay_ghi_nhan: new Date(`${date}T12:00:00Z`),
    nguoi_ghi_nhan_id: actorId,
    nguoi_xac_nhan_id: actorId,
    ngay_xac_nhan: new Date(),
    ma_phong: roomId,
    da_xoa: false,
  }, { transaction });
}

async function transfer(contractId, payload, actorId) {
  const targetRoomId = String(payload.targetRoomId || payload.ma_phong_moi || "").trim();
  const reason = String(payload.reason || "").trim();
  const transferDate = dateOnly(payload.transferDate || payload.ngay_chuyen);
  const finalReading = positiveReading(payload.finalElectricityReading ?? payload.chi_so_dien_cuoi, "Chỉ số điện cuối phòng cũ");
  const initialReading = positiveReading(payload.initialElectricityReading ?? payload.chi_so_dien_dau, "Chỉ số điện đầu phòng mới");
  const newRent = Number(payload.newRent ?? payload.gia_thue_moi);
  if (!targetRoomId || !reason) throw fail(422, "Phòng đích và lý do chuyển là bắt buộc", "INVALID_ROOM_TRANSFER");
  if (!Number.isFinite(newRent) || newRent <= 0) throw fail(422, "Giá thuê mới không hợp lệ", "INVALID_ROOM_TRANSFER_RENT");

  return sequelize.transaction(async (transaction) => {
    const contract = await HopDong.findByPk(contractId, { transaction, lock: transaction.LOCK.UPDATE });
    const actor = { vai_tro: "CHU_TRO", ma_tai_khoan: actorId };
    await assertOwned(actor, "contract", contractId, { transaction });
    await assertOwned(actor, "room", targetRoomId, { transaction });
    if (!contract || !["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai)) throw fail(409, "Hợp đồng không còn hiệu lực để chuyển phòng", "CONTRACT_NOT_TRANSFERABLE");
    if (String(contract.ma_phong) === targetRoomId) throw fail(409, "Phòng đích phải khác phòng hiện tại", "SAME_TRANSFER_ROOM");
    const [sourceRoom, targetRoom] = await Promise.all([
      PhongTro.findByPk(contract.ma_phong, { transaction, lock: transaction.LOCK.UPDATE }),
      PhongTro.findByPk(targetRoomId, { transaction, lock: transaction.LOCK.UPDATE }),
    ]);
    if (!targetRoom) throw fail(404, "Phòng đích không tồn tại", "TARGET_ROOM_NOT_FOUND");
    if (targetRoom.trang_thai !== "TRONG") throw fail(409, "Phòng đích phải đang trống", "TARGET_ROOM_NOT_EMPTY");
    const occupants = await ThanhVienPhong.count({ where: { ma_hop_dong: contractId, trang_thai_cu_tru: "DANG_O" }, transaction });
    if (occupants > Number(targetRoom.so_nguoi_toi_da)) throw fail(409, "Phòng đích không đủ sức chứa", "TARGET_ROOM_CAPACITY_EXCEEDED");
    const latestSource = await ChiSoDien.findOne({ where: { ma_phong: sourceRoom.ma_phong, da_xoa: false }, order: [["ngay_ghi_nhan", "DESC"], ["ma_chi_so", "DESC"]], transaction });
    if (latestSource && finalReading < Number(latestSource.chi_so_moi)) throw fail(422, "Chỉ số điện cuối nhỏ hơn chỉ số gần nhất", "TRANSFER_READING_DECREASED");

    await closeOrCreateReading({ roomId: sourceRoom.ma_phong, date: transferDate, value: finalReading, unitPrice: contract.don_gia_dien, actorId, transaction, initial: false, contractId });
    await closeOrCreateReading({ roomId: targetRoom.ma_phong, date: transferDate, value: initialReading, unitPrice: contract.don_gia_dien, actorId, transaction, initial: true, contractId });

    const before = contract.get({ plain: true });
    await contract.update({ ma_phong: targetRoom.ma_phong, gia_thue: newRent }, { transaction });
    await ThanhVienPhong.update({ ma_phong: targetRoom.ma_phong }, { where: { ma_hop_dong: contractId, trang_thai_cu_tru: "DANG_O" }, transaction });
    await sourceRoom.update({ trang_thai: "TRONG" }, { transaction });
    await targetRoom.update({ trang_thai: "DANG_THUE" }, { transaction });
    const history = await LichSuChuyenPhong.create({
      ma_hop_dong: contractId, ma_phong_cu: sourceRoom.ma_phong, ma_phong_moi: targetRoom.ma_phong, ngay_chuyen: transferDate,
      gia_thue_cu: before.gia_thue, gia_thue_moi: newRent, chi_so_dien_cuoi_phong_cu: finalReading,
      chi_so_dien_dau_phong_moi: initialReading, nguoi_thuc_hien_id: actorId,
    }, { transaction });
    await lifecycle.recordChange({ contract, before, after: contract, reason, actorId, transaction, action: "ROOM_TRANSFERRED" });
    await writeAuditLog({ transaction, actorId, action: "ROOM_TRANSFERRED", entityType: "LichSuChuyenPhong", entityId: history.ma_lich_su, before: { roomId: sourceRoom.ma_phong }, after: { roomId: targetRoom.ma_phong }, reason });
    const tenant = await KhachThue.findByPk(contract.ma_khach_thue, { transaction });
    if (tenant?.ma_tai_khoan) await require("./notification.service").createIdempotent({ ma_tai_khoan: tenant.ma_tai_khoan, loai_thong_bao: "CHUYEN_PHONG", noi_dung: `Hợp đồng đã chuyển sang phòng ${targetRoom.so_phong} từ ngày ${transferDate}.`, thoi_diem_tao: new Date(), khoa_su_kien: `CHUYEN_PHONG:${contract.ma_hop_dong}:${transferDate}` }, { transaction });
    return { contract, history };
  });
}

module.exports = { transfer, positiveReading };
