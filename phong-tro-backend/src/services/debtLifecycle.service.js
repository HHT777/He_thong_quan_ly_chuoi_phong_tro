const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ThanhToan, HopDong, KhachThue, PhongTro, TaiKhoan, ThongBao } = require("../models");
const { getPersistedSystemConfig } = require("./systemConfig.service");
const { withNamedLock } = require("./dbNamedLock.service");
const { writeAuditLog } = require("./auditLog.service");
const { getOwnedBuildingIds } = require("./ownership.service");

function localParts(now, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}
function periodKey(year, month) { return year * 12 + month; }
function actionDue(bill, local, config) {
  const billKey = periodKey(bill.nam, bill.thang); const nowKey = periodKey(local.year, local.month);
  if (billKey > nowKey) return { remind: false, overdue: false, close: false };
  const old = billKey < nowKey;
  return {
    remind: old || local.day >= config.dueReminderDay,
    overdue: old || local.day >= config.overdueDay,
    close: old || local.day > config.debtCloseDay,
  };
}
function earliestPeriod(local, lookback) {
  const date = new Date(Date.UTC(local.year, local.month - lookback, 1));
  return periodKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}
async function actorId(explicit) {
  if (explicit) return explicit;
  return (await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG" }, order: [["ma_tai_khoan", "ASC"]] }))?.ma_tai_khoan;
}
async function notify(bill, type, content, now, transaction) {
  const contract = await HopDong.findByPk(bill.ma_hop_dong, { include: [{ model: KhachThue, as: "khachThue" }], transaction });
  const accountId = contract?.khachThue?.ma_tai_khoan;
  if (!accountId) return false;
  const result = await require("./notification.service").createIdempotent({ ma_tai_khoan: accountId, loai_thong_bao: type, noi_dung: content, thoi_diem_tao: now, da_doc: false, khoa_su_kien: `CONG_NO:${type}:${bill.ma_thanh_toan}:${bill.nam}-${String(bill.thang).padStart(2, "0")}` }, { transaction });
  return result.created;
}
async function processOne(id, local, config, now, userId) {
  return sequelize.transaction(async (transaction) => {
    const bill = await ThanhToan.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!bill || bill.loai_thanh_toan !== "DINH_KY") return { skipped: true };
    const due = actionDue(bill, local, config); const remaining = Number(bill.so_tien_con_no); const changes = {}; const events = [];
    if (due.remind && !bill.da_nhac_han) {
      changes.da_nhac_han = true; changes.ngay_nhac_han = now; events.push("REMINDER");
      if (remaining > 0) await notify(bill, "NHAC_THANH_TOAN", `Phiếu kỳ ${bill.nam}-${String(bill.thang).padStart(2, "0")} còn ${remaining}đ`, now, transaction);
    }
    if (due.overdue && !bill.qua_han) { changes.qua_han = true; changes.ngay_qua_han = now; events.push("OVERDUE"); }
    if (due.close && !bill.da_chot_cong_no) {
      changes.da_chot_cong_no = true; changes.ngay_chot_cong_no = now; changes.so_tien_chot_cong_no = remaining; events.push("DEBT_CLOSED");
      if (remaining > 0) await notify(bill, "CONG_NO", `Đã chốt công nợ kỳ ${bill.nam}-${String(bill.thang).padStart(2, "0")}: ${remaining}đ`, now, transaction);
    }
    if (!events.length) return { skipped: true };
    await bill.update(changes, { transaction });
    await writeAuditLog({ transaction, actorId: userId, action: "DEBT_LIFECYCLE_PROCESSED", entityType: "ThanhToan", entityId: id, after: { events, remaining } });
    return { billId: id, events };
  });
}
async function run({ now = new Date(), actorId: explicitActor } = {}) {
  const config = await getPersistedSystemConfig(); const local = localParts(now, config.timezone); const userId = await actorId(explicitActor);
  if (!userId) throw Object.assign(new Error("Không có tài khoản chủ trọ cho tác vụ"), { status: 409, code: "CRON_ACTOR_NOT_FOUND" });
  return withNamedLock(`qlpt:debt:${local.year}-${local.month}-${local.day}`, async () => {
    const rows = await ThanhToan.findAll({ where: { loai_thanh_toan: "DINH_KY" }, attributes: ["ma_thanh_toan", "nam", "thang"] });
    const minimum = earliestPeriod(local, config.billingCronLookbackMonths); const eligible = rows.filter((row) => periodKey(row.nam, row.thang) >= minimum && periodKey(row.nam, row.thang) <= periodKey(local.year, local.month));
    const processed = []; const errors = [];
    for (const row of eligible) {
      try { const result = await processOne(row.ma_thanh_toan, local, config, now, userId); if (!result.skipped) processed.push(result); }
      catch (error) { errors.push({ billId: row.ma_thanh_toan, code: error.code || "DEBT_LIFECYCLE_FAILED" }); }
    }
    return { lockAcquired: true, processed, errors };
  }, { timeoutSeconds: config.namedLockTimeoutSeconds });
}

async function listDebt({ tenantId, requester, now = new Date() } = {}) {
  const where = { so_tien_con_no: { [Op.gt]: 0 } };
  const contractWhere = tenantId ? { ma_khach_thue: tenantId } : undefined;
  const ownedBuildings = requester?.vai_tro === "CHU_TRO" ? await getOwnedBuildingIds(requester) : null;
  const rows = await ThanhToan.findAll({ where, include: [{ model: HopDong, as: "hopDong", required: Boolean(tenantId) || Boolean(ownedBuildings), where: contractWhere, include: [{ model: KhachThue, as: "khachThue", attributes: ["ma_khach_thue", "ho_ten"] }, { model: PhongTro, as: "phongTro", attributes: ["ma_phong", "ma_can", "so_phong"], ...(ownedBuildings ? { required: true, where: { ma_can: { [Op.in]: ownedBuildings } } } : {}) }] }], order: [["loai_thanh_toan", "ASC"], ["nam", "ASC"], ["thang", "ASC"]] });
  return rows.map((row) => {
    const item = row.toJSON(); const start = Date.UTC(item.nam, item.thang - 1, 1); const ageDays = Math.max(0, Math.floor((now.getTime() - start) / 86400000));
    return { ...item, isOverdue: Boolean(item.qua_han && Number(item.so_tien_con_no) > 0), debtAgeDays: ageDays, debtGroup: { type: item.loai_thanh_toan === "SAU_THANH_LY" ? "SAU_THANH_LY" : "DINH_KY", buildingId: item.hopDong?.phongTro?.ma_can || null, roomId: item.hopDong?.phongTro?.ma_phong || null, tenantId: item.hopDong?.khachThue?.ma_khach_thue || null } };
  }).sort((left, right) => {
    const group = (item) => [item.debtGroup.type, item.debtGroup.buildingId, item.debtGroup.roomId, item.debtGroup.tenantId].map((value) => value || "").join(":");
    return group(left).localeCompare(group(right)) || left.nam - right.nam || left.thang - right.thang;
  });
}

module.exports = { localParts, actionDue, run, listDebt };
