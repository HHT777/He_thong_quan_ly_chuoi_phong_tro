const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { DatGiuPhong, LichSuGiaHanGiuPhong, PhongTro, KhoanThu, ThongBao, TaiKhoan } = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const { assertLandlordOwnsRoom } = require("./propertyAccess.service");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const dateOnly = (value) => new Date(value).toISOString().slice(0, 10);
function cents(value) {
  const text = String(value ?? "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw fail(422, "INVALID_REFUND_AMOUNT", "Số tiền hoàn không hợp lệ");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
const vnd = (value) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
function calculateCancellation(reservation, requestedRefund) {
  const held = cents(reservation.so_tien_giu);
  const refund = cents(requestedRefund);
  if (refund > held) throw fail(422, "REFUND_EXCEEDS_HOLD", "Số hoàn không được vượt tiền giữ chỗ");
  return { refundAmount: vnd(refund), nonRefundAmount: vnd(held - refund), basis: "Theo số tiền hoàn Chủ trọ đề xuất; phần còn lại của tiền giữ chỗ không hoàn" };
}
async function activeReservationForOwner(id, user) {
  const reservation = await DatGiuPhong.findByPk(id);
  if (!reservation) throw fail(404, "RESERVATION_NOT_FOUND", "Không tìm thấy hồ sơ giữ phòng");
  await assertLandlordOwnsRoom(user, reservation.ma_phong);
  if (reservation.trang_thai !== "DANG_GIU") throw fail(409, "RESERVATION_NOT_ACTIVE", "Giữ phòng không còn hiệu lực");
  return reservation;
}
async function extensionHistory(id, user) {
  await activeReservationForOwner(id, user);
  const rows = await LichSuGiaHanGiuPhong.findAll({ where: { ma_dat_giu: id }, order: [["thoi_diem_tao", "ASC"]] });
  return rows.map((row) => ({ id: row.ma_lich_su, extendedAt: row.thoi_diem_tao, oldExpiry: row.han_cu, newExpiry: row.han_moi, actorId: row.nguoi_thuc_hien_id, reason: row.ly_do }));
}
async function cancellationQuote(id, requestedRefund, user) {
  const reservation = await activeReservationForOwner(id, user);
  return { reservationId: id, ...calculateCancellation(reservation, requestedRefund) };
}
function validate(payload) {
  const name = String(payload.holderName || payload.hoTenNguoiGiu || "").trim();
  const phone = String(payload.phone || payload.soDienThoai || "").trim();
  const amount = Number(payload.amount ?? payload.soTienGiu);
  const receivedOn = payload.receivedOn || payload.ngayNhan;
  const expiresOn = payload.expiresOn || payload.hanGiu;
  const terms = String(payload.terms || payload.dieuKien || "").trim();
  if (!name || !phone || !receivedOn || !expiresOn || !terms || !Number.isFinite(amount) || amount < 0) throw fail(422, "INVALID_RESERVATION", "Thiếu hoặc sai thông tin giữ phòng");
  if (String(expiresOn) <= String(receivedOn)) throw fail(422, "INVALID_RESERVATION_EXPIRY", "Hạn giữ phải sau ngày nhận");
  return { name, phone, amount, receivedOn, expiresOn, terms };
}

async function create(payload, actorId) {
  const roomId = payload.roomId || payload.maPhong;
  const value = validate(payload);
  if (!roomId) throw fail(422, "ROOM_REQUIRED", "Phòng là bắt buộc");
  return sequelize.transaction(async (transaction) => {
    const room = await PhongTro.findByPk(roomId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!room) throw fail(404, "ROOM_NOT_FOUND", "Phòng không tồn tại");
    if (room.trang_thai !== "TRONG") throw fail(409, "ROOM_NOT_AVAILABLE", "Chỉ được giữ phòng trống");
    const reservation = await DatGiuPhong.create({ ho_ten_nguoi_giu: value.name, so_dien_thoai: value.phone, so_tien_giu: value.amount, ngay_nhan: value.receivedOn, han_giu: value.expiresOn, dieu_kien: value.terms, ghi_chu: payload.note || payload.ghiChu || null, ma_phong: roomId, nguoi_thuc_hien_id: actorId }, { transaction });
    await room.update({ trang_thai: "DA_GIU" }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "ROOM_RESERVED", entityType: "DatGiuPhong", entityId: reservation.ma_dat_giu, after: { roomId, expiresOn: value.expiresOn, amount: value.amount } });
    return reservation;
  });
}

async function extend(id, payload, actorId) {
  const expiresOn = payload.expiresOn || payload.hanGiu;
  if (!expiresOn) throw fail(422, "RESERVATION_EXPIRY_REQUIRED", "Hạn giữ mới là bắt buộc");
  return sequelize.transaction(async (transaction) => {
    const reservation = await DatGiuPhong.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!reservation || reservation.trang_thai !== "DANG_GIU") throw fail(409, "RESERVATION_NOT_ACTIVE", "Giữ phòng không còn hiệu lực");
    if (String(expiresOn) <= String(reservation.han_giu)) throw fail(422, "INVALID_RESERVATION_EXPIRY", "Hạn mới phải sau hạn hiện tại");
    const previousExpiry = reservation.han_giu;
    await LichSuGiaHanGiuPhong.create({ ma_dat_giu: id, han_cu: previousExpiry, han_moi: expiresOn, ly_do: payload.reason || payload.lyDo || null, nguoi_thuc_hien_id: actorId }, { transaction });
    await reservation.update({ han_giu: expiresOn }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "ROOM_RESERVATION_EXTENDED", entityType: "DatGiuPhong", entityId: id, before: { expiresOn: previousExpiry }, after: { expiresOn }, reason: payload.reason || null });
    return reservation;
  });
}

async function cancel(id, payload, actorId, user) {
  const requestedRefund = payload.refundAmount ?? payload.soTienHoan;
  const reason = String(payload.reason || payload.lyDoHuy || "").trim();
  if (!reason) throw fail(422, "INVALID_RESERVATION_CANCELLATION", "Cần số tiền hoàn hợp lệ và lý do hủy");
  return sequelize.transaction(async (transaction) => {
    const reservation = await DatGiuPhong.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!reservation || reservation.trang_thai !== "DANG_GIU") throw fail(409, "RESERVATION_NOT_ACTIVE", "Giữ phòng không còn hiệu lực");
    await assertLandlordOwnsRoom(user, reservation.ma_phong);
    const amounts = calculateCancellation(reservation, requestedRefund);
    if (payload.expectedRefundAmount !== undefined && cents(payload.expectedRefundAmount) !== cents(amounts.refundAmount)) throw fail(409, "RESERVATION_REFUND_QUOTE_CHANGED", "Báo giá hoàn đã thay đổi; vui lòng xem lại trước khi hủy");
    const room = await PhongTro.findByPk(reservation.ma_phong, { transaction, lock: transaction.LOCK.UPDATE });
    const refund = amounts.refundAmount;
    const retained = amounts.nonRefundAmount;
    if (cents(retained) > 0n) await KhoanThu.create({ loai_khoan_thu: "GIU_PHONG_KHONG_HOAN", so_tien: retained, ngay_ghi_nhan: new Date(), ghi_chu: `Hủy giữ phòng: ${reason}`, trang_thai_ghi_nhan: "HIEU_LUC", ma_can: room.ma_can }, { transaction });
    await reservation.update({ trang_thai: "DA_HUY", so_tien_hoan: refund, ly_do_huy: reason, ngay_huy: new Date(), nguoi_thuc_hien_id: actorId }, { transaction });
    await room.update({ trang_thai: "TRONG" }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "ROOM_RESERVATION_CANCELLED", entityType: "DatGiuPhong", entityId: id, after: { refund, retained }, reason });
    return reservation;
  });
}

async function notifyExpired({ now = new Date() } = {}) {
  return sequelize.transaction(async (transaction) => {
    const overdue = await DatGiuPhong.findAll({ where: { trang_thai: "DANG_GIU", han_giu: { [Op.lt]: dateOnly(now) } }, transaction, lock: transaction.LOCK.UPDATE });
    const landlords = await TaiKhoan.findAll({ where: { vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG" }, transaction, lock: transaction.LOCK.UPDATE });
    let created = 0;
    for (const item of overdue) {
      for (const landlord of landlords) {
      const content = `Giữ phòng ${item.ma_dat_giu} đã quá hạn ${item.han_giu}.`;
      const result = await require("./notification.service").createIdempotent({ ma_tai_khoan: landlord.ma_tai_khoan, loai_thong_bao: "GIU_PHONG_QUA_HAN", noi_dung: content, khoa_su_kien: `GIU_PHONG_HET_HAN:${item.ma_dat_giu}:${dateOnly(now)}`, thoi_diem_tao: new Date() }, { transaction });
      if (result.created) created += 1;
      }
    }
    return { overdue: overdue.length, created };
  });
}

module.exports = { create, extend, cancel, notifyExpired, validate, calculateCancellation, extensionHistory, cancellationQuote };
