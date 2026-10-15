const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ChiSoDien, HopDong, PhongTro, CanTro, KhachThue } = require("../models");

const previews = new Map();
const include = [{ model: PhongTro, as: "phongTro", include: [{ model: CanTro, as: "canTro" }] }];
function parsePeriod(period) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period || "");
  if (!match) throw { status: 400, code: "INVALID_PERIOD", message: "Kỳ phải có định dạng YYYY-MM" };
  return { nam: Number(match[1]), thang: Number(match[2]) };
}
function toDto(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const room = plain.phongTro || {};
  return {
    id: plain.ma_chi_so,
    period: `${plain.nam}-${String(plain.thang).padStart(2, "0")}`,
    room: { id: room.ma_phong || plain.ma_phong, code: room.so_phong || null, buildingId: room.ma_can || null, buildingName: room.canTro?.ten_can || null },
    previousReading: plain.previousReading ?? null,
    readingValue: Number(plain.chi_so_moi),
    status: plain.trang_thai_xac_nhan,
    unitPriceVnd: Number(plain.don_gia_ap_dung),
    evidenceImage: plain.anh_cong_to_url ? { id: plain.ma_chi_so, downloadUrl: `/api/v1/private-files/${plain.ma_chi_so}` } : null,
    submittedAt: plain.ngay_ghi_nhan,
    confirmedAt: plain.ngay_xac_nhan,
    confirmedBy: plain.nguoi_xac_nhan_id ? { id: plain.nguoi_xac_nhan_id } : null,
    consumption: plain.previousReading == null ? null : Number(plain.chi_so_moi) - Number(plain.previousReading),
    electricityTotalVnd: plain.previousReading == null ? null : (Number(plain.chi_so_moi) - Number(plain.previousReading)) * Number(plain.don_gia_ap_dung),
  };
}
async function tenantContract(tenantId) {
  const contract = await HopDong.findOne({
    where: {
      ma_khach_thue: tenantId,
      trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] },
    },
    order: [["ngay_bat_dau", "DESC"]],
  });
  if (!contract) throw { status: 404, code: "ACTIVE_CONTRACT_NOT_FOUND", message: "Khách thuê chưa có hợp đồng hiệu lực" };
  return contract;
}
function requirePreviousReading(row, period, roomId) {
  if (!row) {
    throw {
      status: 422,
      code: "INITIAL_READING_REQUIRED",
      message: "Chưa có chỉ số điện đầu kỳ hoặc chỉ số kỳ trước đã xác nhận",
      details: { roomId, period },
    };
  }
  return Number(row.chi_so_moi);
}
async function previousReading(roomId, period, transaction) {
  const { nam, thang } = parsePeriod(period);
  const row = await ChiSoDien.findOne({
    where: { ma_phong: roomId, trang_thai_xac_nhan: "DA_XAC_NHAN", [Op.or]: [{ nam: { [Op.lt]: nam } }, { nam, thang: { [Op.lt]: thang } }] },
    order: [["nam", "DESC"], ["thang", "DESC"]], transaction,
  });
  return requirePreviousReading(row, period, roomId);
}
async function getContext(tenantId, period) {
  const parsed = parsePeriod(period);
  const contract = await tenantContract(tenantId);
  const [room, current, previous] = await Promise.all([
    PhongTro.findByPk(contract.ma_phong, { include: [{ model: CanTro, as: "canTro" }] }),
    ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, ...parsed }, include }),
    previousReading(contract.ma_phong, period),
  ]);
  return { period, submissionWindowOpen: true, room: { id: room.ma_phong, code: room.so_phong, buildingName: room.canTro?.ten_can || null }, previousReading: { value: previous, recordedAt: null }, current: current ? toDto(current) : null, imagePolicy: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: Number(process.env.MAX_FILE_SIZE || 10485760) } };
}
async function callOcr(filePath) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const form = new FormData();
    form.append("file", new File([fs.readFileSync(filePath)], path.basename(filePath), { type: path.extname(filePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg" }));
    const response = await fetch(`${process.env.OCR_BASE_URL || "http://127.0.0.1:8000"}/ocr`, { method: "POST", body: form, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.success !== true || !/^\d+$/.test(body.ocr_value || "")) throw new Error("OCR_FAILED");
    return { status: "RECOGNIZED", rawValue: body.ocr_value, numericValue: Number(body.ocr_value) };
  } catch (error) {
    return { status: "MANUAL_REQUIRED", rawValue: null, numericValue: null, warning: { code: error.name === "AbortError" ? "OCR_TIMEOUT" : "OCR_UNAVAILABLE", message: "OCR không sẵn sàng. Vui lòng nhập tay." } };
  } finally { clearTimeout(timer); }
}
async function createPreview(tenantId, period, file, roomId) {
  parsePeriod(period);
  const contract = tenantId ? await tenantContract(tenantId) : null;
  const targetRoomId = roomId || contract?.ma_phong;
  if (!targetRoomId) throw { status: 422, code: "ROOM_REQUIRED", message: "Chủ trọ phải chọn phòng khi OCR" };
  const previous = await previousReading(targetRoomId, period);
  const ocr = await callOcr(file.path);
  const token = `upl_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  previews.set(token, { tenantId, roomId: targetRoomId, period, filePath: file.path, ocrValue: ocr.rawValue, ocrStatus: ocr.status, expiresAt });
  return { uploadToken: token, expiresAt: expiresAt.toISOString(), ocrStatus: ocr.status, ocrValue: ocr.rawValue, suggestedReading: ocr.numericValue, previousReading: previous, canSubmit: ocr.numericValue !== null && ocr.numericValue >= previous, warnings: ocr.warning ? [ocr.warning] : [] };
}
function resolvePreview(tenantId, period, token) {
  if (!token) return null;
  const value = previews.get(token);
  if (!value || value.tenantId !== tenantId || value.period !== period || value.expiresAt < new Date()) throw { status: 422, code: "UPLOAD_TOKEN_EXPIRED", message: "Preview upload đã hết hạn" };
  return value;
}
async function findReading(id, transaction) {
  const row = await ChiSoDien.findByPk(String(id).replace(/^mr_/, ""), { include, transaction });
  if (!row) throw { status: 404, code: "READING_NOT_FOUND", message: "Không tìm thấy chỉ số điện" };
  return row;
}
async function submit(tenantId, payload, actorId) {
  const parsed = parsePeriod(payload.period);
  const contract = await tenantContract(tenantId);
  const value = Number(payload.readingValue);
  if (!Number.isInteger(value) || value < 0) throw { status: 422, code: "INVALID_READING", message: "Chỉ số điện phải là số nguyên không âm" };
  const preview = resolvePreview(tenantId, payload.period, payload.uploadToken);
  return sequelize.transaction(async (transaction) => {
    const existing = await ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, ...parsed }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing?.trang_thai_xac_nhan === "DA_XAC_NHAN") throw { status: 409, code: "READING_ALREADY_CONFIRMED", message: "Kỳ này đã được xác nhận" };
    const previous = await previousReading(contract.ma_phong, payload.period, transaction);
    if (value < previous) throw { status: 422, code: "READING_BELOW_PREVIOUS", message: "Chỉ số điện không được nhỏ hơn kỳ trước", details: { previousReading: previous } };
    const values = { ...parsed, ma_phong: contract.ma_phong, chi_so_moi: value, anh_cong_to_url: preview?.filePath || existing?.anh_cong_to_url || null, don_gia_ap_dung: contract.don_gia_dien, trang_thai_xac_nhan: "CHO_XAC_NHAN", ngay_ghi_nhan: new Date(), nguoi_ghi_nhan_id: actorId };
    const row = existing ? await existing.update(values, { transaction }) : await ChiSoDien.create(values, { transaction });
    if (payload.uploadToken) previews.delete(payload.uploadToken);
    const result = toDto(await row.reload({ include, transaction }));
    result.previousReading = previous;
    return result;
  });
}

module.exports = { parsePeriod, toDto, include, getContext, createPreview, findReading, submit, tenantContract, requirePreviousReading, previousReading };
