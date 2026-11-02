const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");
const { Op } = require("sequelize");
const db = require("../config/database");
const { SuCo, HopDong, PhongTro, CanTro, DanhMucSuCo } = require("../models");
const { assertOwned, notFoundError, getLandlordAccountForRoom } = require("./ownership.service");
const { getUploadContext } = require("../config/uploadFilesystem");
const { getPersistedSystemConfig } = require("./systemConfig.service");
const { businessDate } = require("../utils/businessDate.util");
const { writeAuditLog } = require("./auditLog.service");
const notices = require("./notification.service");
const PRIORITIES = Object.freeze(["THAP", "TRUNG_BINH", "CAO", "KHAN_CAP"]);
const DEFAULT_CATEGORIES = Object.freeze([
  { ma: "THIET_BI", ten: "Thiết bị", thu_tu: 10 },
  { ma: "HONG_THIET_BI", ten: "Hỏng thiết bị", thu_tu: 20 },
  { ma: "DIEN", ten: "Điện", thu_tu: 30 },
  { ma: "NUOC", ten: "Nước", thu_tu: 40 },
  { ma: "VE_SINH", ten: "Vệ sinh", thu_tu: 50 },
  { ma: "AN_NINH", ten: "An ninh", thu_tu: 60 },
  { ma: "KHAC", ten: "Khác", thu_tu: 70 },
]);
const DUPLICATE_WINDOW_MS = 60_000;
function incidentIdForKey(accountId, key) {
  const hex = crypto.createHash("sha256").update(`tenant-incident:${accountId}:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}
function sameSubmission(row, reporterId, roomId, values, imageHash) {
  return row.ma_nguoi_gui === reporterId && row.ma_phong === roomId && row.loai_su_co === values.type
    && row.muc_do_uu_tien === values.priority && row.mo_ta === values.description
    && (imageHash ? path.basename(row.hinh_anh_url || "").startsWith(`${imageHash}-`) : !row.hinh_anh_url);
}
const roomInclude = [{ model: PhongTro, as: "phongTro", include: [{ model: CanTro, as: "canTro" }] }];
const fail = (status, code, message = "Dữ liệu sự cố không hợp lệ") => Object.assign(new Error(message), { status, code });
const activeWhere = (user) => ({ ma_khach_thue: user.ma_khach_thue, trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] }, ngay_bat_dau: { [Op.lte]: businessDate() }, ngay_ket_thuc: { [Op.gte]: businessDate() } });
async function policy() { return { mimeTypes: ["image/jpeg", "image/png"], maxBytes: Math.min(10 * 1024 * 1024, (await getPersistedSystemConfig()).maxFileSizeBytes), maxFiles: 1 }; }
function validate(body, editing = false) {
  const allowed = ["type", "priority", "description", ...(editing ? ["removeImage"] : ["contractId"])];
  if (!body || Object.keys(body).some(k => !allowed.includes(k))) throw fail(400, "INCIDENT_FIELDS_FORBIDDEN");
  if (!editing && (typeof body.contractId !== "string" || !body.contractId.trim())) throw notFoundError();
  if (typeof body.type !== "string" || !body.type.trim() || body.type.length > 50 || typeof body.description !== "string" || !body.description.trim() || body.description.length > 1000 || !PRIORITIES.includes(body.priority)) throw fail(400, "INVALID_INCIDENT_INPUT", "Vui lòng kiểm tra loại, ưu tiên và mô tả (tối đa 1000 ký tự)");
  if (editing && body.removeImage != null && ![true, false, "true", "false"].includes(body.removeImage)) throw fail(400, "INVALID_INCIDENT_INPUT");
  return { type: body.type.trim(), priority: body.priority, description: body.description.trim() };
}
function validateAdditionalNote(body) {
  if (!body || Object.keys(body).length !== 1 || typeof body.additionalNote !== "string" || !body.additionalNote.trim() || body.additionalNote.trim().length > 500) {
    throw fail(400, "INVALID_INCIDENT_NOTE", "Ghi chú bổ sung phải có từ 1 đến 500 ký tự");
  }
  return body.additionalNote.trim();
}
function validateImage(file, imagePolicy) {
  if (!file) return null;
  if (!file.originalname || /[\\/\x00]/.test(file.originalname) || file.originalname.includes("..")) throw fail(400, "INVALID_INCIDENT_FILENAME");
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length > imagePolicy.maxBytes || file.size !== file.buffer.length) throw fail(413, "FILE_TOO_LARGE");
  const b = file.buffer;
  const jpeg = b.length >= 100 && b[0] === 255 && b[1] === 216 && b[2] === 255 && b[b.length - 2] === 255 && b[b.length - 1] === 217 && b.includes(Buffer.from([255,218])) && [192,193,194].some(marker => b.includes(Buffer.from([255,marker])));
  const png = b.length >= 57 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.readUInt32BE(8) === 13 && b.subarray(12, 16).toString() === "IHDR" && b.readUInt32BE(16) > 0 && b.readUInt32BE(20) > 0 && b.includes(Buffer.from("IDAT")) && b.subarray(-8, -4).toString() === "IEND";
  if (!(jpeg && file.mimetype === "image/jpeg" && /\.jpe?g$/i.test(file.originalname)) && !(png && file.mimetype === "image/png" && /\.png$/i.test(file.originalname))) throw fail(415, "INVALID_INCIDENT_IMAGE");
  return crypto.createHash("sha256").update(b).digest("hex");
}
async function contracts(user, transaction, roomId) {
  return HopDong.findAll({ where: { ...activeWhere(user), ...(roomId ? { ma_phong: roomId } : {}) }, order: [["ma_hop_dong", "ASC"]], transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
}
async function context(user) {
  const rows = await contracts(user);
  const rooms = await PhongTro.findAll({ where: { ma_phong: { [Op.in]: rows.map(r => r.ma_phong) } }, include: [{ model: CanTro, as: "canTro" }] });
  const storedCategories = await DanhMucSuCo.findAll({ where: { dang_hoat_dong: true }, attributes: ["ma", "ten"], order: [["thu_tu", "ASC"]] });
  const categoryMap = new Map(DEFAULT_CATEGORIES.map(({ ma, ten }) => [ma, { ma, ten }]));
  for (const category of storedCategories) categoryMap.set(category.ma, { ma: category.ma, ten: category.ten });
  return { today: businessDate(), contracts: rows.map(c => { const r = rooms.find(r => r.ma_phong === c.ma_phong); return { contractId: c.ma_hop_dong, roomName: r?.so_phong, buildingName: r?.canTro?.ten_can }; }), categories: [...categoryMap.values()], priorities: PRIORITIES, imagePolicy: await policy() };
}
function dto(row, canEdit = false) {
  return { id: row.ma_su_co, type: row.loai_su_co, priority: row.muc_do_uu_tien, description: row.mo_ta, status: row.trang_thai, submittedAt: row.ngay_gui, updatedAt: row.ngay_chinh_sua, acceptedAt: row.ngay_tiep_nhan, completedAt: row.ngay_hoan_tat, roomName: row.phongTro?.so_phong ?? null, buildingName: row.phongTro?.canTro?.ten_can ?? null, response: row.trang_thai === "DA_XU_LY" ? row.ket_qua_xu_ly : null, imageUrl: row.hinh_anh_url ? `/v1/incidents/${encodeURIComponent(row.ma_su_co)}/image` : null, canEdit, canCancel: canEdit };
}
async function editable(user, row, transaction) {
  const current = await contracts(user, transaction, row.ma_phong);
  return !row.da_xoa && row.trang_thai === "CHO_TIEP_NHAN" && current.length > 0;
}
async function read(user, id, transaction) {
  await assertOwned(user, "incident", id, { transaction });
  const row = await SuCo.findByPk(id, { transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : { include: roomInclude }) });
  if (!row || row.da_xoa) throw notFoundError();
  return row;
}
async function detail(user, id) { const row = await read(user, id); return user.vai_tro === "KHACH_THUE" ? dto(row, await editable(user, row)) : row; }
async function list(user) {
  const rows = await SuCo.findAll({ where: { ma_nguoi_gui: user.ma_tai_khoan, da_xoa: false }, include: roomInclude, order: [["ngay_gui", "DESC"]] });
  return Promise.all(rows.map(async r => dto(r, await editable(user, r))));
}
async function image(user, id, upload = getUploadContext()) {
  const row = await read(user, id);
  if (!row.hinh_anh_url) throw notFoundError();
  let file;
  try { file = upload.check(row.hinh_anh_url); if (!upload.exists(file) || !path.relative(upload.resolve("incidents"), file) || !file.startsWith(upload.resolve("incidents") + path.sep)) throw notFoundError(); }
  catch { throw notFoundError(); }
  const head = fs.readFileSync(upload.check(file)).subarray(0, 8);
  return { path: file, mimeType: head[0] === 137 ? "image/png" : "image/jpeg" };
}
async function notifyOwner(row) {
  try {
    const owner = await getLandlordAccountForRoom(row.ma_phong);
    if (!owner) throw new Error("Missing incident owner");
    await notices.createIdempotent({ loai_thong_bao: "SU_CO_MOI", noi_dung: "Có báo cáo sự cố mới cần tiếp nhận.", ma_tai_khoan: owner, ma_su_co: row.ma_su_co, thoi_diem_tao: new Date(), khoa_su_kien: `SU_CO_MOI:${row.ma_su_co}` });
  } catch { console.error("[INCIDENT_NOTICE_FAILED]"); }
}
async function mutate(user, body, file, { id, cancel = false, idempotencyKey, upload = getUploadContext() } = {}) {
  const addingNote = Boolean(id && body && Object.hasOwn(body, "additionalNote"));
  const v = cancel ? null : addingNote ? { additionalNote: validateAdditionalNote(body) } : validate(body, Boolean(id));
  if (addingNote && file) throw fail(400, "INCIDENT_FIELDS_FORBIDDEN");
  const hash = file ? validateImage(file, await policy()) : null;
  if (file && (body.removeImage === true || body.removeImage === "true")) throw fail(400, "INVALID_INCIDENT_INPUT");
  if (!id && idempotencyKey != null && (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey))) throw fail(400, "INVALID_IDEMPOTENCY_KEY", "Khóa gửi sự cố không hợp lệ");
  const keyedId = !id && idempotencyKey ? incidentIdForKey(user.ma_tai_khoan, idempotencyKey) : null;
  let createdPath;
  let duplicate = false;
  let result;
  let requestRoomId;
  try {
    result = await db.transaction(async transaction => {
      // Lock contracts before room/incident, consistently across create/edit/cancel.
      let row;
      if (id) { await assertOwned(user, "incident", id, { transaction }); row = await SuCo.findByPk(id, { transaction }); if (!row || row.da_xoa) throw notFoundError(); }
      const cs = await contracts(user, transaction, row?.ma_phong);
      const contract = id ? cs[0] : cs.find(c => c.ma_hop_dong === body.contractId);
      if (!contract) { if (!id) throw notFoundError(); throw fail(409, "INCIDENT_NOT_EDITABLE", "Hợp đồng không còn hiệu lực; không thể sửa hoặc hủy sự cố"); }
      requestRoomId = contract.ma_phong;
      await PhongTro.findByPk(contract.ma_phong, { transaction, lock: transaction.LOCK.UPDATE });
      if (id) { row = await read(user, id, transaction); if (addingNote ? row.trang_thai !== "DANG_XU_LY" : row.trang_thai !== "CHO_TIEP_NHAN") throw fail(409, "INCIDENT_NOT_EDITABLE", "Trạng thái sự cố đã thay đổi; vui lòng tải lại"); }
      if (keyedId) {
        const existing = await SuCo.findByPk(keyedId, { transaction });
        if (existing) {
          if (!sameSubmission(existing, user.ma_tai_khoan, requestRoomId, v, hash)) throw fail(409, "IDEMPOTENCY_CONFLICT", "Khóa gửi sự cố đã được dùng cho nội dung khác");
          duplicate = true;
          return existing;
        }
      }
      if (!id) {
        const open = await SuCo.findOne({ where: { ma_nguoi_gui: user.ma_tai_khoan, ma_phong: requestRoomId, loai_su_co: v.type, trang_thai: { [Op.in]: ["CHO_TIEP_NHAN", "DANG_XU_LY"] }, da_xoa: false }, order: [["ngay_gui", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
        if (open) { duplicate = true; return open; }
      }
      if (!cancel && !addingNote) {
        let category = await DanhMucSuCo.findOne({ where: { ma: v.type, dang_hoat_dong: true }, transaction });
        if (!category) {
          const fallback = DEFAULT_CATEGORIES.find(({ ma }) => ma === v.type);
          if (fallback) {
            const result = await DanhMucSuCo.findOrCreate({
              where: { ma: fallback.ma },
              defaults: { ten: fallback.ten, thu_tu: fallback.thu_tu, dang_hoat_dong: true },
              transaction,
            });
            category = result[0]?.dang_hoat_dong ? result[0] : null;
          }
        }
        if (!category && !DEFAULT_CATEGORIES.some(({ ma }) => ma === v.type)) throw fail(400, "INVALID_INCIDENT_CATEGORY", "Loại sự cố không hợp lệ hoặc đã bị vô hiệu hóa");
      }
      if (!id) {
        const matches = await SuCo.findAll({ where: { ma_nguoi_gui: user.ma_tai_khoan, ma_phong: contract.ma_phong, trang_thai: "CHO_TIEP_NHAN", da_xoa: false, loai_su_co: v.type, muc_do_uu_tien: v.priority, mo_ta: v.description, ngay_gui: { [Op.gte]: new Date(Date.now() - DUPLICATE_WINDOW_MS) } }, transaction, lock: transaction.LOCK.UPDATE });
        const same = matches.find(r => r.mo_ta === v.description && (hash ? path.basename(r.hinh_anh_url || "").startsWith(hash + "-") : !r.hinh_anh_url));
        if (same) { duplicate = true; return same; }
      }
      if (file) { upload.mkdir(upload.resolve("incidents")); createdPath = upload.resolve("incidents", `${hash}-${crypto.randomBytes(16).toString("hex")}`); upload.writeFile(createdPath, file.buffer); }
      const noteDescription = addingNote ? `${row.mo_ta}\n\nBổ sung: ${v.additionalNote}` : null;
      if (addingNote && noteDescription.length > 1000) throw fail(400, "INCIDENT_NOTE_TOO_LONG", "Mô tả và ghi chú bổ sung vượt 1000 ký tự");
      const patch = cancel ? { trang_thai: "DA_HUY", ngay_chinh_sua: new Date() } : addingNote ? { mo_ta: noteDescription, ngay_chinh_sua: new Date() } : { loai_su_co: v.type, muc_do_uu_tien: v.priority, mo_ta: v.description, ...(createdPath ? { hinh_anh_url: createdPath } : body.removeImage === true || body.removeImage === "true" ? { hinh_anh_url: null } : {}), ...(id ? { ngay_chinh_sua: new Date() } : {}) };
      if (row) await row.update(patch, { transaction });
      else row = await SuCo.create({ ...patch, ...(keyedId ? { ma_su_co: keyedId } : {}), ma_nguoi_gui: user.ma_tai_khoan, ma_phong: contract.ma_phong, trang_thai: "CHO_TIEP_NHAN" }, { transaction });
      await writeAuditLog({ transaction, actorId: user.ma_tai_khoan, action: cancel ? "INCIDENT_CANCELLED" : id ? "INCIDENT_EDITED" : "INCIDENT_CREATED", entityType: "SuCo", entityId: row.ma_su_co, after: { status: row.trang_thai } });
      return row;
    });
  } catch (error) {
    if (createdPath) { try { upload.unlink(createdPath); } catch { console.error("[INCIDENT_TEMP_CLEANUP_FAILED]"); } }
    if (keyedId && notices.isDuplicate(error)) {
      const existing = await read(user, keyedId);
      if (!sameSubmission(existing, user.ma_tai_khoan, requestRoomId, v, hash)) throw fail(409, "IDEMPOTENCY_CONFLICT", "Khóa gửi sự cố đã được dùng cho nội dung khác");
      return { incident: dto(existing, await editable(user, existing)), duplicate: true };
    }
    throw error;
  }
  // Evidence previously referenced is intentionally retained; no timer cleanup.
  if (!id && !duplicate) await notifyOwner(result);
  return { incident: dto(result, !cancel && result.trang_thai === "CHO_TIEP_NHAN"), duplicate };
}
module.exports = { PRIORITIES, DUPLICATE_WINDOW_MS, DEFAULT_CATEGORIES, activeWhere, validate, validateImage, policy, context, dto, detail, list, image, mutate, incidentIdForKey };
