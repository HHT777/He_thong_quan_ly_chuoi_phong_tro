const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ChiSoDien, HopDong, PhongTro, CanTro, KhachThue } = require("../models");
const { getPersistedSystemConfig } = require("./systemConfig.service");

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads", "meter");
const uploadTokenTtlMs = 15 * 60 * 1000;
function tokenSecret() {
  const value = process.env.UPLOAD_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!value) throw Object.assign(new Error("Thiếu khóa ký upload token"), { status: 500, code: "UPLOAD_TOKEN_SECRET_MISSING" });
  return value;
}
function signUploadPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", tokenSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}
function verifyUploadToken(token, actorId, tenantId, period, now = Date.now()) {
  try {
    const [encoded, signature, extra] = String(token || "").split(".");
    if (!encoded || !signature || extra) throw new Error("malformed");
    const expected = crypto.createHmac("sha256", tokenSecret()).update(encoded).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error("signature");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.sub !== actorId || payload.tenantId !== (tenantId || null) || payload.period !== period || Number(payload.exp) <= now) throw new Error("claims");
    const filePath = path.resolve(uploadDir, payload.fileName);
    if (!filePath.startsWith(`${uploadDir}${path.sep}`)) throw new Error("path");
    return { ...payload, filePath };
  } catch (_) {
    throw { status: 422, code: "UPLOAD_TOKEN_EXPIRED", message: "Preview upload không hợp lệ hoặc đã hết hạn" };
  }
}
function cleanupExpiredUploads(now = Date.now()) {
  if (!fs.existsSync(uploadDir)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(uploadDir)) {
    const filePath = path.resolve(uploadDir, name);
    try { if (now - fs.statSync(filePath).mtimeMs > uploadTokenTtlMs) { fs.unlinkSync(filePath); removed += 1; } } catch (_) { /* file raced with another worker */ }
  }
  return removed;
}
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
async function previousReading(roomId, period, transaction, beforeDate) {
  const { nam, thang } = parsePeriod(period);
  const periodEnd = new Date(Date.UTC(nam, thang, 1));
  const row = await ChiSoDien.findOne({
    where: {
      ma_phong: roomId,
      da_xoa: false,
      trang_thai_xac_nhan: "DA_XAC_NHAN",
      ngay_ghi_nhan: { [Op.lt]: beforeDate || periodEnd },
    },
    order: [["ngay_ghi_nhan", "DESC"], ["ma_chi_so", "DESC"]], transaction,
  });
  return requirePreviousReading(row, period, roomId);
}
async function getContext(tenantId, period) {
  const parsed = parsePeriod(period);
  const contract = await tenantContract(tenantId);
  const [room, current, config] = await Promise.all([
    PhongTro.findByPk(contract.ma_phong, { include: [{ model: CanTro, as: "canTro" }] }),
    ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, ...parsed }, include }),
    getPersistedSystemConfig(),
  ]);
  const previous = await previousReading(contract.ma_phong, period, undefined, current?.ngay_ghi_nhan);
  return { period, submissionWindowOpen: true, room: { id: room.ma_phong, code: room.so_phong, buildingName: room.canTro?.ten_can || null }, previousReading: { value: previous, recordedAt: null }, current: current ? toDto(current) : null, imagePolicy: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: config.maxFileSizeBytes } };
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
async function createPreview(tenantId, period, file, roomId, actorId) {
  parsePeriod(period);
  const contract = tenantId ? await tenantContract(tenantId) : null;
  const targetRoomId = roomId || contract?.ma_phong;
  if (!targetRoomId) throw { status: 422, code: "ROOM_REQUIRED", message: "Chủ trọ phải chọn phòng khi OCR" };
  const previous = await previousReading(targetRoomId, period);
  const ocr = await callOcr(file.path);
  cleanupExpiredUploads();
  const expiresAt = new Date(Date.now() + uploadTokenTtlMs);
  const token = signUploadPayload({ sub: actorId, tenantId: tenantId || null, roomId: targetRoomId, period, fileName: path.basename(file.path), ocrValue: ocr.rawValue, ocrStatus: ocr.status, exp: expiresAt.getTime() });
  return { uploadToken: token, expiresAt: expiresAt.toISOString(), ocrStatus: ocr.status, ocrValue: ocr.rawValue, suggestedReading: ocr.numericValue, previousReading: previous, canSubmit: ocr.numericValue !== null && ocr.numericValue >= previous, warnings: ocr.warning ? [ocr.warning] : [] };
}
function resolvePreview(tenantId, period, token, actorId) {
  if (!token) return null;
  return verifyUploadToken(token, actorId, tenantId, period);
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
  const preview = resolvePreview(tenantId, payload.period, payload.uploadToken, actorId);
  return sequelize.transaction(async (transaction) => {
    const existing = await ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, ...parsed }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing?.trang_thai_xac_nhan === "DA_XAC_NHAN") throw { status: 409, code: "READING_ALREADY_CONFIRMED", message: "Kỳ này đã được xác nhận" };
    const previous = await previousReading(contract.ma_phong, payload.period, transaction, existing?.ngay_ghi_nhan);
    if (value < previous) throw { status: 422, code: "READING_BELOW_PREVIOUS", message: "Chỉ số điện không được nhỏ hơn kỳ trước", details: { previousReading: previous } };
    const values = { ...parsed, ma_phong: contract.ma_phong, loai_chi_so: "DINH_KY", khoa_nghiep_vu: `DINH_KY:${parsed.nam}-${String(parsed.thang).padStart(2, "0")}`, chi_so_moi: value, anh_cong_to_url: preview?.filePath || existing?.anh_cong_to_url || null, don_gia_ap_dung: contract.don_gia_dien, trang_thai_xac_nhan: "CHO_XAC_NHAN", ngay_ghi_nhan: new Date(), nguoi_ghi_nhan_id: actorId };
    const row = existing ? await existing.update(values, { transaction }) : await ChiSoDien.create(values, { transaction });
    const result = toDto(await row.reload({ include, transaction }));
    result.previousReading = previous;
    return result;
  });
}

module.exports = { parsePeriod, toDto, include, getContext, createPreview, findReading, submit, tenantContract, requirePreviousReading, previousReading, signUploadPayload, verifyUploadToken, cleanupExpiredUploads };
