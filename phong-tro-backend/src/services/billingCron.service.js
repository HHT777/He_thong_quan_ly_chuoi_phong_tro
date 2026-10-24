const crypto = require("crypto");
const sequelize = require("../config/database");
const { ThanhToan, HopDong, KhachThue, PhongTro, TaiKhoan, NhatKyLapPhieu, ChiTietNhatKyLapPhieu } = require("../models");
const billGenerationService = require("./billGeneration.service");
const { getPersistedSystemConfig } = require("./systemConfig.service");
const { withNamedLock } = require("./dbNamedLock.service");
const { writeAuditLog } = require("./auditLog.service");
const { assertOwned, getOwnedBuildingIds } = require("./ownership.service");

function localParts(now, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour") };
}

function nextRun(now, config) {
  const local = localParts(now, config.timezone);
  let year = local.year; let month = local.month;
  if (local.day > config.billScheduleDay || (local.day === config.billScheduleDay && local.hour >= config.billScheduleHour)) {
    month += 1; if (month === 13) { month = 1; year += 1; }
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(config.billScheduleDay).padStart(2, "0")} ${String(config.billScheduleHour).padStart(2, "0")}:00 Asia/Ho_Chi_Minh`;
}

async function sendOne(billId, actorId, now = new Date(), { resend = false, key } = {}) {
  if (resend && (!key || !/^[\w-]{8,128}$/.test(key))) throw Object.assign(new Error("Gửi lại cần khóa yêu cầu hợp lệ"), { status: 400, code: "IDEMPOTENCY_KEY_REQUIRED" });
  return sequelize.transaction(async (transaction) => {
    if (actorId) await assertOwned({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId }, "bill", billId, { transaction });
    const bill = await ThanhToan.findByPk(billId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!bill || bill.loai_thanh_toan !== "DINH_KY") throw Object.assign(new Error("Không tìm thấy phiếu thu"), { status: 404, code: "RESOURCE_NOT_FOUND" });
    if (resend && !bill.da_gui) throw Object.assign(new Error("Phiếu chưa được gửi lần đầu"), { status: 409, code: "BILL_NOT_SENT" });
    if (bill.da_gui && !resend) return { sent: false, reason: "ALREADY_SENT" };
    const contract = await HopDong.findByPk(bill.ma_hop_dong, { transaction });
    const tenant = contract && await KhachThue.findByPk(contract.ma_khach_thue, { transaction });
    const account = tenant?.ma_tai_khoan && await TaiKhoan.findByPk(tenant.ma_tai_khoan, { transaction });
    if (!account || account.trang_thai !== "HOAT_DONG") throw Object.assign(new Error("Khách chưa có tài khoản đang hoạt động"), { status: 422, code: "RECIPIENT_UNAVAILABLE" });
    const eventKey = resend ? `PHIEU_THU:RESEND:${billId}:${crypto.createHash("sha256").update(key).digest("hex").slice(0, 24)}` : `PHIEU_THU:${billId}`;
    const notification = await require("./notification.service").createIdempotent({ ma_tai_khoan: account.ma_tai_khoan, loai_thong_bao: "PHIEU_THU", noi_dung: `Phiếu thu kỳ ${bill.nam}-${String(bill.thang).padStart(2, "0")} có tổng ${bill.tong_phai_tra}đ.`, khoa_su_kien: eventKey, thoi_diem_tao: now, da_doc: false }, { transaction });
    if (!notification.created) return { sent: false, reason: "ALREADY_PROCESSED" };
    await bill.update({ da_gui: true, ngay_gui: now, nguoi_gui_id: actorId || null, so_lan_gui: Number(bill.so_lan_gui || 0) + 1 }, { transaction });
    await writeAuditLog({ transaction, actorId, action: resend ? "BILL_RESENT" : "BILL_SENT", entityType: "ThanhToan", entityId: billId, after: { sentAt: now, count: bill.so_lan_gui } });
    return { sent: true };
  });
}

async function sendBatch(ids, actorId, now = new Date(), options = {}) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some((id) => typeof id !== "string")) throw Object.assign(new Error("Danh sách phiếu không hợp lệ"), { status: 400, code: "INVALID_BILL_IDS" });
  const results = [];
  for (const id of new Set(ids)) {
    try { results.push({ billId: id, ...await sendOne(id, actorId, now, options) }); }
    catch (error) { results.push({ billId: id, sent: false, reason: error.code || "SEND_FAILED" }); }
  }
  return { results, sent: results.filter((row) => row.sent).length };
}

async function sendPreview(ids, actorId) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some((id) => typeof id !== "string")) throw Object.assign(new Error("Danh sách phiếu không hợp lệ"), { status: 400, code: "INVALID_BILL_IDS" });
  const rows = [];
  for (const id of new Set(ids)) {
    await assertOwned({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId }, "bill", id);
    const bill = await ThanhToan.findByPk(id);
    if (!bill || bill.loai_thanh_toan !== "DINH_KY") throw Object.assign(new Error("Không tìm thấy phiếu thu"), { status: 404, code: "RESOURCE_NOT_FOUND" });
    const contract = await HopDong.findByPk(bill.ma_hop_dong);
    const room = await PhongTro.findByPk(contract.ma_phong);
    const tenant = await KhachThue.findByPk(contract.ma_khach_thue);
    const account = tenant?.ma_tai_khoan && await TaiKhoan.findByPk(tenant.ma_tai_khoan);
    rows.push({ billId: id, roomId: contract.ma_phong, roomName: room?.so_phong || null, tenantName: tenant?.ho_ten || null, total: Number(bill.tong_phai_tra), alreadySent: Boolean(bill.da_gui), recipientAvailable: account?.trang_thai === "HOAT_DONG", reasonCode: account?.trang_thai === "HOAT_DONG" ? null : "RECIPIENT_UNAVAILABLE" });
  }
  return { rows };
}

async function scheduleStatus(now = new Date(), actorId) {
  const config = await getPersistedSystemConfig();
  const latest = await NhatKyLapPhieu.findOne({ order: [["bat_dau", "DESC"]], include: [{ model: ChiTietNhatKyLapPhieu, as: "chiTiets", include: [{ model: PhongTro, as: "phongTro", attributes: ["so_phong", "ma_can"] }] }] });
  if (!actorId) return { enabled: config.billScheduleEnabled, day: config.billScheduleDay, hour: config.billScheduleHour, buildingIds: config.billScheduleBuildingIds, nextRun: config.billScheduleEnabled ? nextRun(now, config) : null, latestRun: latest };
  const owned = await getOwnedBuildingIds({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId });
  const scopedBuildings = config.billScheduleBuildingIds.filter((id) => owned.includes(id));
  const details = (latest?.chiTiets || []).filter((item) => item.phongTro && owned.includes(item.phongTro.ma_can));
  const visibleLog = latest ? { ...latest.toJSON(), chiTiets: details.map((item) => item.toJSON()), so_phieu_lap: details.filter((item) => item.ket_qua === "DA_LAP").length, so_phong_bo_qua: details.filter((item) => item.ket_qua === "BO_QUA").length, so_phong_loi: details.filter((item) => item.ket_qua === "LOI").length } : null;
  return { enabled: config.billScheduleEnabled, day: config.billScheduleDay, hour: config.billScheduleHour, buildingIds: scopedBuildings, nextRun: config.billScheduleEnabled ? nextRun(now, config) : null, latestRun: visibleLog };
}

async function run({ now = new Date(), actorId, force = false } = {}) {
  const config = await getPersistedSystemConfig(); const local = localParts(now, config.timezone);
  if (!force && (!config.billScheduleEnabled || local.day !== config.billScheduleDay || local.hour !== config.billScheduleHour)) return { due: false, created: 0, sent: 0, skipped: [] };
  const actors = force && actorId ? [actorId] : (await TaiKhoan.findAll({ where: { vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG" }, order: [["ma_tai_khoan", "ASC"]] })).map((row) => row.ma_tai_khoan);
  if (!actors.length) throw Object.assign(new Error("Không có tài khoản chủ trọ cho tác vụ"), { status: 409, code: "CRON_ACTOR_NOT_FOUND" });
  const period = `${local.year}-${String(local.month).padStart(2, "0")}`;
  return withNamedLock(`qlpt:billing:${period}`, async () => {
    let log = await NhatKyLapPhieu.findOne({ where: { ky: period } });
    if (log?.trang_thai === "HOAN_TAT") return { lockAcquired: true, due: true, period, created: 0, sent: 0, skipped: [], alreadyRan: true };
    if (!log) log = await NhatKyLapPhieu.create({ ky: period, thoi_diem_hen: now, bat_dau: now, trang_thai: "DANG_CHAY", pham_vi_json: config.billScheduleBuildingIds });
    try {
      const batches = [];
      for (const ownerId of actors) {
        const owned = await getOwnedBuildingIds({ vai_tro: "CHU_TRO", ma_tai_khoan: ownerId });
        const scope = config.billScheduleBuildingIds.length ? config.billScheduleBuildingIds.filter((id) => owned.includes(id)) : owned;
        if (scope.length) batches.push(await billGenerationService.generate(period, ownerId, undefined, scope));
      }
      const generated = { created: batches.flatMap((item) => item.created), skipped: batches.flatMap((item) => item.skipped), rooms: batches.flatMap((item) => item.rooms) };
      const createdIds = new Set(generated.created.map((bill) => bill.ma_hop_dong));
      const skippedByRoom = new Map(generated.skipped.map((item) => [item.roomId, item]));
      const outcomes = (generated.rooms || []).map((room) => {
        const skipped = skippedByRoom.get(room.roomId);
        return { roomId: room.roomId, contractId: room.contractId, result: room.contractId && createdIds.has(room.contractId) ? "DA_LAP" : skipped?.stage === "GENERATE" ? "LOI" : "BO_QUA", reason: skipped?.reason || room.reasonCode };
      });
      for (const item of outcomes) {
        const contract = item.contractId && await HopDong.findByPk(item.contractId);
        const roomId = item.roomId || contract?.ma_phong;
        if (!roomId) continue;
        await ChiTietNhatKyLapPhieu.findOrCreate({ where: { ma_lan_chay: log.ma_lan_chay, ma_phong: roomId }, defaults: { ma_hop_dong: item.contractId, ket_qua: item.result, ma_ly_do: item.reason } });
      }
      await log.update({ ket_thuc: new Date(), trang_thai: "HOAN_TAT", so_phieu_lap: generated.created.length, so_phong_bo_qua: outcomes.filter((x) => x.result === "BO_QUA").length, so_phong_loi: outcomes.filter((x) => x.result === "LOI").length });
      return { lockAcquired: true, due: true, period, created: generated.created.length, sent: 0, skipped: generated.skipped };
    } catch (error) {
      await log.update({ ket_thuc: new Date(), trang_thai: "LOI" });
      throw error;
    }
  }, { timeoutSeconds: config.namedLockTimeoutSeconds });
}

module.exports = { localParts, nextRun, sendOne, sendBatch, sendPreview, scheduleStatus, run };
