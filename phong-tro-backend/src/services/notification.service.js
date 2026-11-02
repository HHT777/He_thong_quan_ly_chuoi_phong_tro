const { ThongBao } = require("../models");
const sequelize = require("../config/database");

const { Op } = require("sequelize");
const { assertOwned, notFoundError } = require("./ownership.service");
const { writeAuditLog } = require("./auditLog.service");

const fields = ["ma_thong_bao", "loai_thong_bao", "noi_dung", "thoi_diem_tao", "da_doc", "ma_su_co", "khoa_su_kien"];
const invalid = () => Object.assign(new Error("Tham số thông báo không hợp lệ"), { status: 400, code: "INVALID_NOTIFICATION_QUERY" });
function principal(user) {
  if (!user?.ma_tai_khoan || !["KHACH_THUE", "CHU_TRO"].includes(user.vai_tro)) throw Object.assign(new Error("Quyền truy cập bị từ chối"), { status: 403, code: "FORBIDDEN" });
  return user.ma_tai_khoan;
}
function emptyInput(query = {}, body = {}) { if (Object.keys(query).length || Object.keys(body).length) throw invalid(); }
function queryOptions(query = {}, body = {}) {
  if (Object.keys(body).length || Object.keys(query).some(k => !["page", "limit", "status", "q"].includes(k))) throw invalid();
  const number = (value, fallback, max) => { if (value == null) return fallback; if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw invalid(); return Number(value); };
  const page = number(query.page, 1, 1_000_000), limit = number(query.limit, 25, 100);
  if (query.status != null && !["ALL", "UNREAD", "READ"].includes(query.status)) throw invalid();
  if (query.q != null && (typeof query.q !== "string" || query.q.length > 100)) throw invalid();
  return { page, limit, status: query.status || "ALL", q: query.q?.trim() || "" };
}
// Redact labelled private identity/contact fields in legacy free-form notices.
// Producer values, request details and transaction boundaries are unchanged.
function safeContent(value) {
  return String(value || "").slice(0, 1000)
    .replace(/\b(?:CCCD|CMND|passport|identity|birthDate|address|phone)\s*[:=][^;\n]+/giu, "[Thông tin riêng tư đã ẩn]")
    .replace(/(?:ngày sinh|địa chỉ|số điện thoại|SĐT|giấy tờ)\s*[:=][^;\n]+/giu, "[Thông tin riêng tư đã ẩn]")
    .replace(/(?:\+84|\b0)[\d .-]{8,15}\d\b/g, "[Liên hệ đã ẩn]");
}
async function ownerInboxItem(user, row) {
  const item = typeof row.get === "function" ? row.get({ plain: true }) : { ...row };
  if (user?.vai_tro !== "CHU_TRO" || String(item.ma_tai_khoan) !== String(user.ma_tai_khoan)
    || item.loai_thong_bao !== "YEU_CAU_DAT_LAI_MAT_KHAU") return item;
  const match = /^YEU_CAU_DAT_LAI_MAT_KHAU:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(String(item.khoa_su_kien || ""));
  if (!match) return item;
  try {
    const request = await assertOwned(user, "request", match[1]);
    if (request.loai_yeu_cau !== "DAT_LAI_MAT_KHAU" || !request.ma_khach_thue) return item;
    return { ...item, target: { route: `/residents-contracts/accounts?tenantId=${encodeURIComponent(request.ma_khach_thue)}`, resourceType: "tenantAccount", verified: true } };
  } catch (error) {
    if ([403, 404].includes(error.status)) return item;
    throw error;
  }
}
async function dto(user, row) {
  let target = null;
  const incidentTypes = ["SU_CO", "SU_CO_MOI", "KET_QUA_SU_CO"];
  const eventIncidentId = incidentTypes.includes(row.loai_thong_bao)
    ? /^(?:SU_CO|SU_CO_MOI|KET_QUA_SU_CO):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(String(row.khoa_su_kien || ""))?.[1]
    : null;
  const incidentId = row.ma_su_co || eventIncidentId;
  if (incidentTypes.includes(row.loai_thong_bao) && incidentId) {
    try {
      const incident = await assertOwned(user, "incident", incidentId);
      if (!incident.da_xoa) {
        const route = user.vai_tro === "KHACH_THUE" ? "/tenant/incidents" : "/operations/incidents";
        target = { route: `${route}?incidentId=${encodeURIComponent(incidentId)}`, resourceType: "incident", verified: true };
      }
    } catch (error) { if (![403, 404].includes(error.status)) throw error; }
  }
  return { ma_thong_bao: row.ma_thong_bao, loai_thong_bao: row.loai_thong_bao, noi_dung: safeContent(row.noi_dung), thoi_diem_tao: row.thoi_diem_tao, da_doc: Boolean(row.da_doc), target: row.target || target };
}
async function list(user, query = {}, body = {}) {
  const id = principal(user), options = queryOptions(query, body);
  const where = { ma_tai_khoan: id, da_an: false };
  if (options.status !== "ALL") where.da_doc = options.status === "READ";
  if (options.q) where.noi_dung = { [Op.like]: `%${options.q}%` };
  const result = await ThongBao.findAndCountAll({ where, attributes: fields, order: [["thoi_diem_tao", "DESC"], ["ma_thong_bao", "DESC"]], offset: (options.page - 1) * options.limit, limit: options.limit });
  return { data: await Promise.all(result.rows.map(async row => dto(user, await ownerInboxItem(user, row)))), pagination: { page: options.page, limit: options.limit, total: result.count, hasNext: options.page * options.limit < result.count } };
}
async function unreadCount(user, query = {}, body = {}) {
  const id = principal(user); emptyInput(query, body);
  return { unreadCount: await ThongBao.count({ where: { ma_tai_khoan: id, da_doc: false, da_an: false } }) };
}
async function markRead(user, id, query = {}, body = {}) {
  const accountId = principal(user); emptyInput(query, body);
  await assertOwned(user, "notification", id);
  // Recipient predicate is repeated on the mutation, including concurrent reads.
  await ThongBao.update({ da_doc: true }, { where: { ma_thong_bao: id, ma_tai_khoan: accountId, da_doc: false, da_an: false } });
  const row = await ThongBao.findOne({ where: { ma_thong_bao: id, ma_tai_khoan: accountId, da_an: false }, attributes: fields });
  if (!row) throw notFoundError();
  return dto(user, row);
}
async function markAllRead(user, query = {}, body = {}) {
  const id = principal(user); emptyInput(query, body);
  const [changed] = await ThongBao.update({ da_doc: true }, { where: { ma_tai_khoan: id, da_doc: false, da_an: false } });
  return { changed, ...(await unreadCount(user)) };
}
async function hide(user, id, query = {}, body = {}) {
  const accountId = principal(user); emptyInput(query, body);
  if (user.vai_tro !== "CHU_TRO") throw Object.assign(new Error("Chỉ Chủ trọ được xóa thông báo"), { status: 403, code: "FORBIDDEN" });
  return sequelize.transaction(async transaction => {
    await assertOwned(user, "notification", id, { transaction });
    const [changed] = await ThongBao.update({ da_an: true }, { where: { ma_thong_bao: id, ma_tai_khoan: accountId, da_an: false }, transaction });
    if (changed) await writeAuditLog({ transaction, actorId: accountId, action: "NOTIFICATION_HIDDEN", entityType: "ThongBao", entityId: id, after: { hidden: true } });
    return { hidden: true };
  });
}

function isDuplicate(error) {
  return error?.original?.code === "ER_DUP_ENTRY" || error?.parent?.code === "ER_DUP_ENTRY" || error?.code === "ER_DUP_ENTRY";
}

async function createIdempotent(values, { transaction } = {}) {
  try {
    return { created: true, row: await ThongBao.create(values, transaction ? { transaction } : undefined) };
  } catch (error) {
    if (values.khoa_su_kien && isDuplicate(error)) return { created: false, row: null };
    throw error;
  }
}

module.exports = { createIdempotent, isDuplicate, list, unreadCount, markRead, markAllRead, hide, safeContent, queryOptions, ownerInboxItem };
