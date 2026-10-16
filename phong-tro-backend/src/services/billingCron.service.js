const sequelize = require("../config/database");
const { ThanhToan, HopDong, KhachThue, TaiKhoan, ThongBao } = require("../models");
const billGenerationService = require("./billGeneration.service");
const { getPersistedSystemConfig } = require("./systemConfig.service");
const { withNamedLock } = require("./dbNamedLock.service");
const { writeAuditLog } = require("./auditLog.service");

function localParts(now, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour") };
}

async function sendOne(billId, actorId, now) {
  return sequelize.transaction(async (transaction) => {
    const bill = await ThanhToan.findByPk(billId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!bill || bill.loai_thanh_toan !== "DINH_KY" || bill.da_gui) return false;
    const contract = await HopDong.findByPk(bill.ma_hop_dong, { transaction });
    const tenant = contract && await KhachThue.findByPk(contract.ma_khach_thue, { transaction });
    if (!tenant?.ma_tai_khoan) return false;
    await ThongBao.create({ ma_tai_khoan: tenant.ma_tai_khoan, loai_thong_bao: "PHIEU_THU", noi_dung: `Phiếu thu kỳ ${bill.nam}-${String(bill.thang).padStart(2, "0")} có tổng ${bill.tong_phai_tra}đ.`, thoi_diem_tao: now, da_doc: false }, { transaction });
    await bill.update({ da_gui: true, ngay_gui: now }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "BILL_SENT", entityType: "ThanhToan", entityId: bill.ma_thanh_toan, after: { sentAt: now } });
    return true;
  });
}

async function run({ now = new Date(), actorId, force = false } = {}) {
  const config = await getPersistedSystemConfig(); const local = localParts(now, config.timezone);
  if (!force && (local.day !== config.billScheduleDay || local.hour !== config.billScheduleHour)) return { due: false, created: 0, sent: 0, skipped: [] };
  const systemActor = actorId || (await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG" }, order: [["ma_tai_khoan", "ASC"]] }))?.ma_tai_khoan;
  if (!systemActor) throw Object.assign(new Error("Không có tài khoản chủ trọ cho tác vụ"), { status: 409, code: "CRON_ACTOR_NOT_FOUND" });
  const period = `${local.year}-${String(local.month).padStart(2, "0")}`;
  return withNamedLock(`qlpt:billing:${period}`, async () => {
    const generated = await billGenerationService.generate(period, systemActor);
    const unsent = await ThanhToan.findAll({ where: { nam: local.year, thang: local.month, loai_thanh_toan: "DINH_KY", da_gui: false }, attributes: ["ma_thanh_toan"], order: [["ma_thanh_toan", "ASC"]] });
    let sent = 0; for (const bill of unsent) if (await sendOne(bill.ma_thanh_toan, systemActor, now)) sent += 1;
    return { lockAcquired: true, due: true, period, created: generated.created.length, sent, skipped: generated.skipped };
  }, { timeoutSeconds: config.namedLockTimeoutSeconds });
}

module.exports = { localParts, sendOne, run };
