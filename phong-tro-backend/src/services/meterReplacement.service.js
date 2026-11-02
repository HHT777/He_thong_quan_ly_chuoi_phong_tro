const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { PhongTro, HopDong, ThanhToan, ChiSoDien, ThayDongHoDien } = require("../models");
const { assertOwned } = require("./ownership.service");
const { writeAuditLog } = require("./auditLog.service");

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads", "meter-replacements");
const error = (status, code, message) => Object.assign(new Error(message), { status, code });

function periodParts(period) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(period || ""));
  if (!match) throw error(400, "INVALID_PERIOD", "Kỳ phải có dạng YYYY-MM");
  return { nam: Number(match[1]), thang: Number(match[2]) };
}

function nonNegative(value, label, required = true) {
  if (value === undefined || value === null || value === "") {
    if (!required) return null;
    throw error(422, "INVALID_METER_REPLACEMENT", `${label} là bắt buộc`);
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw error(422, "INVALID_METER_REPLACEMENT", `${label} phải là số nguyên không âm`);
  return result;
}

function validate(input, previous) {
  const { nam, thang } = periodParts(input.period);
  const date = String(input.replacementDate || "");
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date.slice(0, 7) !== input.period)
    throw error(422, "INVALID_REPLACEMENT_DATE", "Ngày thay phải thuộc kỳ đã chọn");
  const oldFinal = nonNegative(input.oldFinalReading, "Chỉ số cuối đồng hồ cũ", false);
  const oldEstimate = nonNegative(input.estimatedOldKwh, "Sản lượng ước tính", false);
  const newStart = nonNegative(input.newStartReading, "Chỉ số đầu đồng hồ mới");
  const reason = String(input.reason || "").trim();
  if ((oldFinal === null) === (oldEstimate === null)) throw error(422, "METER_REPLACEMENT_SOURCE_REQUIRED", "Chọn chỉ số cuối đồng hồ cũ hoặc sản lượng ước tính");
  if (oldFinal !== null && oldFinal < previous) throw error(422, "READING_BELOW_PREVIOUS", "Chỉ số cuối đồng hồ cũ nhỏ hơn kỳ trước");
  if (!reason || reason.length > 1000) throw error(422, "REASON_REQUIRED", "Lý do thay đồng hồ là bắt buộc (tối đa 1000 ký tự)");
  return { nam, thang, ngay_thay: date, chi_so_cuoi_cu: oldFinal, san_luong_cu_uoc_tinh: oldEstimate, chi_so_dau_moi: newStart, ly_do: reason };
}

function consumption(replacement, previous, finalReading) {
  const current = Number(finalReading);
  if (!replacement) return { oldKwh: null, newKwh: null, totalKwh: current - Number(previous) };
  const oldKwh = replacement.chi_so_cuoi_cu == null ? Number(replacement.san_luong_cu_uoc_tinh) : Number(replacement.chi_so_cuoi_cu) - Number(previous);
  const newKwh = current - Number(replacement.chi_so_dau_moi);
  if (!Number.isFinite(oldKwh) || !Number.isFinite(newKwh) || oldKwh < 0 || newKwh < 0)
    throw error(422, "INVALID_ELECTRICITY_AMOUNT", "Chỉ số cuối kỳ thấp hơn chỉ số đầu đồng hồ mới");
  return { oldKwh, newKwh, totalKwh: oldKwh + newKwh };
}

async function find(roomId, period, transaction) {
  return ThayDongHoDien.findOne({ where: { ma_phong: roomId, ...periodParts(period) }, transaction });
}

function imageExtension(file) {
  if (!file) return null;
  const bytes = file.buffer;
  if (file.mimetype === "image/jpeg" && bytes?.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ".jpg";
  if (file.mimetype === "image/png" && bytes?.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ".png";
  throw error(415, "UNSUPPORTED_MEDIA_TYPE", "Ảnh JPEG/PNG không hợp lệ");
}

async function create(input, files, user) {
  const roomId = String(input.roomId || "");
  if (!roomId) throw error(422, "ROOM_REQUIRED", "Chọn phòng cần thay đồng hồ");
  const saved = [];
  try {
    return await sequelize.transaction(async (transaction) => {
      await assertOwned(user, "room", roomId, { transaction });
      await PhongTro.findByPk(roomId, { transaction, lock: transaction.LOCK.UPDATE });
      const { nam, thang } = periodParts(input.period);
      if (await find(roomId, input.period, transaction)) throw error(409, "METER_ALREADY_REPLACED", "Phòng đã thay đồng hồ trong kỳ này");
      const next = new Date(Date.UTC(nam, thang, 1));
      const contracts = await HopDong.findAll({ where: { ma_phong: roomId }, attributes: ["ma_hop_dong"], order: [["ma_hop_dong", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
      if (contracts.length && await ThanhToan.findOne({ where: { ma_hop_dong: { [Op.in]: contracts.map((row) => row.ma_hop_dong) }, nam: next.getUTCFullYear(), thang: next.getUTCMonth() + 1, loai_thanh_toan: "DINH_KY" }, transaction }))
        throw error(409, "METER_PERIOD_BILLED", "Kỳ điện này đã được dùng để lập phiếu");
      const previous = await require("./meterReading.service").periodBaseline(roomId, input.period, transaction);
      const values = validate(input, previous);
      const current = await ChiSoDien.findOne({ where: { ma_phong: roomId, nam, thang, loai_chi_so: "DINH_KY", da_xoa: false }, transaction, lock: transaction.LOCK.UPDATE });
      if (current?.trang_thai_xac_nhan === "DA_XAC_NHAN")
        throw error(409, "METER_READING_ALREADY_CONFIRMED", "Chỉ số cuối kỳ đã xác nhận; không thể thay đồng hồ cho kỳ này");
      if (current) await current.update({ da_xoa: true, ly_do_xoa: "Chỉ số cũ không còn hợp lệ sau khi thay đồng hồ", ngay_xoa: new Date(), nguoi_xoa_id: user.ma_tai_khoan }, { transaction });
      const oldExt = imageExtension(files?.oldImage?.[0]);
      const newExt = imageExtension(files?.newImage?.[0]);
      if (oldExt || newExt) await fs.promises.mkdir(uploadDir, { recursive: true });
      const save = async (file, ext) => {
        if (!ext) return null;
        const target = path.join(uploadDir, `${crypto.randomUUID()}${ext}`);
        await fs.promises.writeFile(target, file.buffer, { flag: "wx" });
        saved.push(target);
        return target;
      };
      const oldPath = await save(files?.oldImage?.[0], oldExt);
      const newPath = await save(files?.newImage?.[0], newExt);
      const row = await ThayDongHoDien.create({ ...values, ma_phong: roomId, anh_dong_ho_cu_url: oldPath, anh_dong_ho_moi_url: newPath, nguoi_tao_id: user.ma_tai_khoan }, { transaction });
      await writeAuditLog({ transaction, actorId: user.ma_tai_khoan, action: "METER_REPLACED", entityType: "ThayDongHoDien", entityId: row.ma_thay_dong_ho, after: { roomId, period: input.period, oldFinalReading: values.chi_so_cuoi_cu, estimatedOldKwh: values.san_luong_cu_uoc_tinh, newStartReading: values.chi_so_dau_moi, supersededReadingId: current?.ma_chi_so || null }, reason: values.ly_do });
      return toDto(row, previous);
    });
  } catch (cause) {
    await Promise.all(saved.map((target) => fs.promises.unlink(target).catch(() => {})));
    if (cause.name === "SequelizeUniqueConstraintError" || cause.original?.code === "ER_DUP_ENTRY") throw error(409, "METER_ALREADY_REPLACED", "Phòng đã thay đồng hồ trong kỳ này");
    throw cause;
  }
}

function toDto(row, previous) {
  const item = row.get ? row.get({ plain: true }) : row;
  return { id: item.ma_thay_dong_ho, roomId: item.ma_phong, period: `${item.nam}-${String(item.thang).padStart(2, "0")}`,
    replacementDate: item.ngay_thay, oldFinalReading: item.chi_so_cuoi_cu == null ? null : Number(item.chi_so_cuoi_cu),
    estimatedOldKwh: item.san_luong_cu_uoc_tinh == null ? null : Number(item.san_luong_cu_uoc_tinh),
    newStartReading: Number(item.chi_so_dau_moi),
    oldKwh: item.san_luong_cu_uoc_tinh == null && previous != null ? Number(item.chi_so_cuoi_cu) - Number(previous) : item.san_luong_cu_uoc_tinh == null ? null : Number(item.san_luong_cu_uoc_tinh),
    reason: item.ly_do,
    oldImageUrl: item.anh_dong_ho_cu_url ? `/api/v1/meter-replacements/${item.ma_thay_dong_ho}/images/old` : null,
    newImageUrl: item.anh_dong_ho_moi_url ? `/api/v1/meter-replacements/${item.ma_thay_dong_ho}/images/new` : null };
}

module.exports = { create, find, validate, consumption, toDto, periodParts };
