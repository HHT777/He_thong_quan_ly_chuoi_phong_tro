const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ChiSoDien, HopDong, PhongTro, CanTro, KhachThue, ThanhToan } = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const { getPersistedSystemConfig } = require("./systemConfig.service");
const { getUploadContext } = require("../config/uploadFilesystem");
const { businessMonth } = require("../utils/businessDate.util");
const meterReplacement = require("./meterReplacement.service");
const { notFoundError, getLandlordAccountForRoom, assertOwned } = require("./ownership.service");

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
function verifyUploadToken(token, actorId, tenantId, period, now = Date.now(), uploadContext = getUploadContext()) {
  try {
    const [encoded, signature, extra] = String(token || "").split(".");
    if (!encoded || !signature || extra) throw new Error("malformed");
    const expected = crypto.createHmac("sha256", tokenSecret()).update(encoded).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error("signature");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.sub !== actorId || payload.tenantId !== (tenantId || null) || payload.period !== period || Number(payload.exp) <= now) throw new Error("claims");
    const uploadDir = uploadContext.resolve("meter");
    const filePath = uploadContext.resolve("meter", payload.fileName);
    if (!filePath.startsWith(`${uploadDir}${path.sep}`)) throw new Error("path");
    return { ...payload, filePath };
  } catch (_) {
    throw { status: 422, code: "UPLOAD_TOKEN_EXPIRED", message: "Preview upload không hợp lệ hoặc đã hết hạn" };
  }
}
async function cleanupExpiredUploads(now = Date.now(), uploadContext = getUploadContext()) {
  const uploadDir = uploadContext.resolve("meter");
  if (!uploadContext.exists(uploadDir)) return 0;
  const rows = await ChiSoDien.findAll({ attributes: ["anh_cong_to_url"], raw: true });
  const pathKey = (value) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  const referenced = new Set(rows.filter((row) => row.anh_cong_to_url).map((row) => pathKey(row.anh_cong_to_url)));
  let removed = 0;
  for (const name of uploadContext.list(uploadDir)) {
    const filePath = path.resolve(uploadDir, name);
    if (referenced.has(pathKey(filePath))) continue;
    try { if (now - uploadContext.stat(filePath).mtimeMs > uploadTokenTtlMs) { uploadContext.unlink(filePath); removed += 1; } }
    catch (error) { if (error.code !== "ENOENT") throw error; }
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
    readingType: plain.loai_chi_so || "DINH_KY",
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
async function periodBaseline(roomId, period, transaction) {
  const { nam, thang } = parsePeriod(period);
  const row = await ChiSoDien.findOne({ where: { ma_phong: roomId, da_xoa: false, trang_thai_xac_nhan: "DA_XAC_NHAN",
    [Op.or]: [{ nam: { [Op.lt]: nam } }, { nam, thang: { [Op.lt]: thang } },
      { nam, thang, loai_chi_so: "DAU_HOP_DONG" }] },
  order: [["nam", "DESC"], ["thang", "DESC"], ["ngay_ghi_nhan", "DESC"], ["ma_chi_so", "DESC"]], transaction });
  return requirePreviousReading(row, period, roomId);
}
async function submissionMinimum(roomId, period, transaction) {
  const replacement = await meterReplacement.find(roomId, period, transaction);
  return replacement ? Number(replacement.chi_so_dau_moi) : previousReading(roomId, period, transaction);
}
const tenantError = (status, code, message) => Object.assign(new Error(message), { status, code });
const monthKey = (period) => { const { nam, thang } = parsePeriod(period); return nam * 12 + thang - 1; };
const monthName = (key) => `${Math.floor(key / 12)}-${String(key % 12 + 1).padStart(2, "0")}`;
async function tenantSelection(tenantId, requested, { transaction, now = new Date(), contract: supplied } = {}) {
  const contract = supplied || await HopDong.findOne({ where: { ma_khach_thue: tenantId, trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] } }, order: [["ngay_bat_dau", "DESC"]], transaction });
  if (!contract || contract.ma_khach_thue !== tenantId) throw notFoundError();
  const first = monthKey(String(contract.ngay_bat_dau).slice(0, 7)), last = monthKey(businessMonth(now));
  const [readings, bills] = await Promise.all([
    ChiSoDien.findAll({ where: { ma_phong: contract.ma_phong, loai_chi_so: "DINH_KY", da_xoa: false }, transaction }),
    ThanhToan.findAll({ where: { ma_hop_dong: contract.ma_hop_dong, loai_thanh_toan: "DINH_KY" }, attributes: ["nam", "thang", "trang_thai"], transaction }),
  ]);
  const keyOf = (row) => Number(row.nam) * 12 + Number(row.thang) - 1;
  const confirmed = new Set(readings.filter((r) => r.trang_thai_xac_nhan === "DA_XAC_NHAN").map(keyOf));
  // A persisted M+1 bill closes M and every earlier missing period for tenants.
  // The landlord's manual/correction flow handles any reading omitted before that bill.
  const lockedThrough = bills.length ? Math.max(...bills.map((r) => keyOf(r) - 1)) : -Infinity;
  let selected = null;
  for (let key = Math.max(first, lockedThrough + 1); key <= last; key += 1) { if (!confirmed.has(key)) { selected = key; break; } }
  if (requested != null) {
    const key = monthKey(requested);
    if (key < first || key > last) throw tenantError(409, "TENANT_READING_PERIOD_INVALID", "Kỳ nằm ngoài thời gian hợp đồng hoặc ở tương lai");
    if (confirmed.has(key)) throw tenantError(409, "READING_ALREADY_CONFIRMED", "Kỳ này đã được xác nhận");
    if (key <= lockedThrough) throw tenantError(409, "READING_PERIOD_CLOSED", "Kỳ này đã chốt, liên hệ chủ trọ.");
    if (key !== selected) throw tenantError(409, "TENANT_READING_PERIOD_MISMATCH", "Chỉ được gửi kỳ do hệ thống lựa chọn");
  }
  return { contract, period: selected == null ? null : monthName(selected), isLate: selected != null && selected < last,
    current: readings.find((r) => keyOf(r) === selected) || null };
}
async function tenantPrevious(contract, period, transaction) {
  const key = monthKey(period);
  const row = await ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, da_xoa: false, trang_thai_xac_nhan: "DA_XAC_NHAN",
    [Op.or]: [{ nam: { [Op.lt]: Math.floor(key / 12) } }, { nam: Math.floor(key / 12), thang: { [Op.lt]: key % 12 + 1 } },
      { nam: Math.floor(key / 12), thang: key % 12 + 1, loai_chi_so: "DAU_HOP_DONG" }] },
    order: [["nam", "DESC"], ["thang", "DESC"], ["ngay_ghi_nhan", "DESC"], ["ma_chi_so", "DESC"]], transaction });
  const previous = requirePreviousReading(row, period, contract.ma_phong);
  const replacement = await meterReplacement.find(contract.ma_phong, period, transaction);
  return { value: replacement ? Number(replacement.chi_so_dau_moi) : previous, recordedAt: row.ngay_ghi_nhan };
}
async function getContext(tenantId, requested, options = {}) {
  const selection = await tenantSelection(tenantId, requested, options);
  const [room, config] = await Promise.all([PhongTro.findByPk(selection.contract.ma_phong, { include: [{ model: CanTro, as: "canTro" }] }), getPersistedSystemConfig()]);
  if (!room?.canTro) throw notFoundError();
  const previous = selection.period ? await tenantPrevious(selection.contract, selection.period) : null;
  return { period: selection.period, submissionWindowOpen: Boolean(selection.period), isLate: selection.isLate,
    periodLabel: selection.period ? `${selection.period}${selection.isLate ? " (kỳ gửi muộn)" : ""}` : null,
    room: { id: room.ma_phong, code: room.so_phong, buildingName: room.canTro.ten_can }, previousReading: previous,
    current: selection.current ? toDto(selection.current) : null,
    imagePolicy: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: config.maxFileSizeBytes } };
}
async function callOcr(filePath) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.OCR_TIMEOUT_MS || 30000));
  try {
    const form = new FormData();
    form.append("file", new File([fs.readFileSync(filePath)], path.basename(filePath), { type: path.extname(filePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg" }));
    const response = await fetch(`${process.env.OCR_BASE_URL || "http://127.0.0.1:8000"}/ocr`, { method: "POST", body: form, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.success !== true || !/^\d+$/.test(body.ocr_value || "")) throw Object.assign(new Error("OCR_FAILED"), { code: "OCR_FAILED" });
    return { status: "RECOGNIZED", rawValue: body.ocr_value, numericValue: Number(body.ocr_value) };
  } catch (error) {
    const code = error.name === "AbortError" ? "OCR_TIMEOUT" : error.code === "OCR_FAILED" ? "OCR_FAILED" : "OCR_UNAVAILABLE";
    const message = code === "OCR_FAILED" ? "Không đọc được chỉ số từ ảnh. Vui lòng nhập tay hoặc thử ảnh rõ hơn." : "Dịch vụ OCR không sẵn sàng. Vui lòng nhập tay.";
    return { status: "MANUAL_REQUIRED", rawValue: null, numericValue: null, warning: { code, message } };
  } finally { clearTimeout(timer); }
}
async function createPreview(tenantId, period, file, roomId, actorId, uploadContext = getUploadContext()) {
  if (tenantId) return tenantPreview(tenantId, period, file, roomId, actorId);
  await assertOwned({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId }, "room", roomId);
  parsePeriod(period);
  const contract = tenantId ? await tenantContract(tenantId) : null;
  const targetRoomId = roomId || contract?.ma_phong;
  if (!targetRoomId) throw { status: 422, code: "ROOM_REQUIRED", message: "Chủ trọ phải chọn phòng khi OCR" };
  const previous = await submissionMinimum(targetRoomId, period);
  const ocr = await callOcr(file.path);
  await cleanupExpiredUploads(Date.now(), uploadContext);
  const expiresAt = new Date(Date.now() + uploadTokenTtlMs);
  const token = signUploadPayload({ sub: actorId, tenantId: tenantId || null, roomId: targetRoomId, period, fileName: path.basename(file.path), ocrValue: ocr.rawValue, ocrStatus: ocr.status, exp: expiresAt.getTime() });
  return { uploadToken: token, expiresAt: expiresAt.toISOString(), ocrStatus: ocr.status, ocrValue: ocr.rawValue, suggestedReading: ocr.numericValue, previousReading: previous, canSubmit: ocr.numericValue !== null && ocr.numericValue >= previous, warnings: ocr.warning ? [ocr.warning] : [] };
}
function resolvePreview(tenantId, period, token, actorId, uploadContext) {
  if (!token) return null;
  return verifyUploadToken(token, actorId, tenantId, period, Date.now(), uploadContext);
}
async function findReading(id, transaction) {
  const row = await ChiSoDien.findByPk(String(id).replace(/^mr_/, ""), { include, transaction });
  if (!row) throw { status: 404, code: "READING_NOT_FOUND", message: "Không tìm thấy chỉ số điện" };
  return row;
}
async function tenantPreview(tenantId, requested, file, roomId, actorId) {
  if (roomId != null) throw tenantError(400, "TENANT_SCOPE_OVERRIDE_FORBIDDEN", "Không được chọn phòng");
  const { contract, period } = await tenantSelection(tenantId, requested);
  if (!period) throw tenantError(409, "NO_READING_PERIOD_AVAILABLE", "Chưa có kỳ nào cần gửi chỉ số");
  const previous = await tenantPrevious(contract, period);
  const bytes = fs.readFileSync(file.path);
  const jpeg = bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!(jpeg && file.mimetype === "image/jpeg") && !(png && file.mimetype === "image/png")) throw tenantError(415, "UNSUPPORTED_MEDIA_TYPE", "Ảnh JPEG/PNG không hợp lệ");
  const ocr = await callOcr(file.path);
  const warnings = ocr.warning ? [{ code: ocr.warning.code, message: "Hiện chưa gửi được chỉ số, vui lòng liên hệ Chủ trọ" }] : [];
  const expiresAt = new Date(Date.now() + uploadTokenTtlMs);
  const uploadToken = ocr.status === "RECOGNIZED" ? signUploadPayload({ sub: actorId, tenantId, contractId: contract.ma_hop_dong,
    roomId: contract.ma_phong, period, fileName: path.basename(file.path), ocrValue: ocr.rawValue, ocrStatus: ocr.status, exp: expiresAt.getTime() }) : null;
  return { period, uploadToken, expiresAt: uploadToken ? expiresAt.toISOString() : null, ocrStatus: ocr.status, ocrValue: ocr.rawValue,
    suggestedReading: ocr.numericValue, previousReading: previous.value, canSubmit: ocr.status === "RECOGNIZED" && Number.isSafeInteger(ocr.numericValue) && ocr.numericValue >= previous.value, warnings };
}
async function submit(tenantId, payload, actorId, uploadContext = getUploadContext()) {
  if (Object.hasOwn(payload, "readingValue")) throw tenantError(400, "TENANT_MANUAL_READING_FORBIDDEN", "Khách thuê chỉ được gửi chỉ số qua ảnh/OCR");
  if (!payload.uploadToken) throw tenantError(400, "OCR_UPLOAD_REQUIRED", "Vui lòng nhận dạng ảnh trước khi gửi");
  // Verify actor before querying the contract; period/contract/room are checked again below.
  const encoded = String(payload.uploadToken).split(".")[0];
  let tokenPeriod;
  try { tokenPeriod = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")).period; } catch (_) { throw tenantError(422, "UPLOAD_TOKEN_EXPIRED", "Preview không hợp lệ"); }
  const preview = verifyUploadToken(payload.uploadToken, actorId, tenantId, tokenPeriod, Date.now(), uploadContext);
  if (payload.period != null && payload.period !== preview.period) throw tenantError(409, "TENANT_READING_PERIOD_MISMATCH", "Kỳ không khớp preview");
  const value = Number(preview.ocrValue);
  if (preview.ocrStatus !== "RECOGNIZED" || !/^\d+$/.test(preview.ocrValue || "") || !Number.isSafeInteger(value)) throw tenantError(400, "OCR_RECOGNITION_REQUIRED", "Hiện chưa gửi được chỉ số, vui lòng liên hệ Chủ trọ");
  if (!uploadContext.exists(preview.filePath)) throw tenantError(422, "UPLOAD_TOKEN_EXPIRED", "Ảnh preview đã hết hạn");
  try {
    return await sequelize.transaction(async (transaction) => {
      // Serialize two first submissions as well as replacements without a new table/index.
      const contract = await HopDong.findOne({ where: { ma_khach_thue: tenantId, trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] } }, order: [["ngay_bat_dau", "DESC"]], transaction, lock: transaction.LOCK.UPDATE });
      if (!contract || contract.ma_khach_thue !== tenantId || preview.contractId !== contract.ma_hop_dong || preview.roomId !== contract.ma_phong) throw notFoundError();
      const { period } = await tenantSelection(tenantId, preview.period, { contract, transaction });
      const parsed = parsePeriod(period);
      const previous = await tenantPrevious(contract, period, transaction);
      if (value < previous.value) throw tenantError(422, "READING_BELOW_PREVIOUS", "Chỉ số điện không được nhỏ hơn kỳ trước");
      const existing = await ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, ...parsed, loai_chi_so: "DINH_KY" }, transaction, lock: transaction.LOCK.UPDATE });
      if (existing?.trang_thai_xac_nhan === "DA_XAC_NHAN") throw tenantError(409, "READING_ALREADY_CONFIRMED", "Kỳ này đã được xác nhận");
      if (existing && existing.anh_cong_to_url === preview.filePath && Number(existing.chi_so_moi) === value) return { ...toDto(await existing.reload({ include, transaction })), previousReading: previous.value };
      const values = { ...parsed, ma_phong: contract.ma_phong, loai_chi_so: "DINH_KY", khoa_nghiep_vu: `DINH_KY:${period}`, chi_so_moi: value,
        anh_cong_to_url: preview.filePath, don_gia_ap_dung: contract.don_gia_dien, trang_thai_xac_nhan: "CHO_XAC_NHAN", ngay_ghi_nhan: new Date(), nguoi_ghi_nhan_id: actorId, da_xoa: false };
      const row = existing ? await existing.update(values, { transaction }) : await ChiSoDien.create(values, { transaction });
      await writeAuditLog({ transaction, actorId, action: "TENANT_METER_READING_SUBMITTED", entityType: "ChiSoDien", entityId: row.ma_chi_so, after: { period, value } });
      const recipient = await getLandlordAccountForRoom(contract.ma_phong, transaction);
      if (recipient) await require("./notification.service").createIdempotent({ ma_tai_khoan: recipient, loai_thong_bao: "CHI_SO_DIEN", noi_dung: `Có chỉ số điện kỳ ${period} cần kiểm tra`,
        khoa_su_kien: `TENANT_METER:${row.ma_chi_so}:${path.basename(preview.filePath)}`, da_doc: false, thoi_diem_tao: new Date() }, { transaction });
      return { ...toDto(await row.reload({ include, transaction })), previousReading: previous.value };
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" || error.original?.code === "ER_DUP_ENTRY" || error.original?.code === "ER_LOCK_DEADLOCK") throw tenantError(409, "READING_SUBMISSION_CONFLICT", "Kỳ đang được gửi, vui lòng tải lại trạng thái");
    throw error;
  }
}

async function submitForLandlord(payload, actorId, uploadContext = getUploadContext()) {
  const parsed = parsePeriod(payload.period);
  const preview = resolvePreview(null, payload.period, payload.uploadToken, actorId, uploadContext);
  if (!preview?.roomId) throw { status: 422, code: "UPLOAD_TOKEN_EXPIRED", message: "Preview upload không hợp lệ hoặc đã hết hạn" };
  const owner = { vai_tro: "CHU_TRO", ma_tai_khoan: actorId };
  await assertOwned(owner, "room", preview.roomId);
  const value = Number(payload.readingValue);
  if (!Number.isInteger(value) || value < 0) throw { status: 422, code: "INVALID_READING", message: "Chỉ số điện phải là số nguyên không âm" };
  const contract = await HopDong.findOne({ where: { ma_phong: preview.roomId, trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] } }, order: [["ngay_bat_dau", "DESC"]] });
  if (!contract) throw { status: 404, code: "ACTIVE_CONTRACT_NOT_FOUND", message: "Phòng chưa có hợp đồng hiệu lực" };
  return sequelize.transaction(async (transaction) => {
    await assertOwned(owner, "room", preview.roomId, { transaction });
    const previous = await submissionMinimum(contract.ma_phong, payload.period, transaction);
    if (value < previous) throw { status: 400, code: "READING_BELOW_PREVIOUS", message: "Chỉ số điện không được nhỏ hơn kỳ trước", details: { previousReading: previous } };
    const existing = await ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, ...parsed }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing?.trang_thai_xac_nhan === "DA_XAC_NHAN") throw { status: 409, code: "READING_ALREADY_CONFIRMED", message: "Kỳ này đã được xác nhận" };
    const values = { ...parsed, ma_phong: contract.ma_phong, loai_chi_so: "DINH_KY", khoa_nghiep_vu: `DINH_KY:${parsed.nam}-${String(parsed.thang).padStart(2, "0")}`, chi_so_moi: value, anh_cong_to_url: preview.filePath || existing?.anh_cong_to_url || null, don_gia_ap_dung: contract.don_gia_dien, trang_thai_xac_nhan: "DA_XAC_NHAN", ngay_ghi_nhan: new Date(), nguoi_ghi_nhan_id: actorId, nguoi_xac_nhan_id: actorId, ngay_xac_nhan: new Date(), da_xoa: false };
    const row = existing ? await existing.update(values, { transaction }) : await ChiSoDien.create(values, { transaction });
    await writeAuditLog({ transaction, actorId, action: "METER_READING_MANUAL_CREATED", entityType: "ChiSoDien", entityId: row.ma_chi_so, after: { value, period: payload.period, source: "LANDLORD_OCR" } });
    const result = toDto(await row.reload({ include, transaction })); result.previousReading = previous; return result;
  });
}

module.exports = { parsePeriod, toDto, include, getContext, createPreview, findReading, submit, submitForLandlord, tenantContract, requirePreviousReading, previousReading, periodBaseline, submissionMinimum, signUploadPayload, verifyUploadToken, cleanupExpiredUploads, callOcr, tenantSelection, tenantPrevious };
