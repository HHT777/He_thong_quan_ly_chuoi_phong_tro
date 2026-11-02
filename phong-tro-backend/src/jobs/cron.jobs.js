const cron = require("node-cron");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { HopDong, KhachThue } = require("../models");
const { getLandlordAccountForRoom } = require("../services/ownership.service");
const { getPersistedSystemConfig } = require("../services/systemConfig.service");
const { withNamedLock } = require("../services/dbNamedLock.service");
const reservationService = require("../services/reservation.service");
const moveOutRequestService = require("../services/moveOutRequest.service");
const billingCronService = require("../services/billingCron.service");
const debtLifecycleService = require("../services/debtLifecycle.service");
const { businessDate, addBusinessDays } = require("../utils/businessDate.util");

async function updateContractStates({ now = new Date() } = {}) {
  const config = await getPersistedSystemConfig();
  const today = businessDate(now, config.timezone);
  const warningDate = addBusinessDays(today, config.contractWarningDays);
  const expiring = await HopDong.findAll({
    where: { trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] }, ngay_ket_thuc: { [Op.lte]: warningDate } },
    include: [{ model: KhachThue, as: "khachThue" }],
  });
  for (const contract of expiring) {
    await sequelize.transaction(async (transaction) => {
      const locked = await HopDong.findByPk(contract.ma_hop_dong, { transaction, lock: transaction.LOCK.UPDATE });
      const expired = String(locked.ngay_ket_thuc) < today;
      const nextState = expired ? "HET_HAN" : "SAP_HET_HAN";
      if (locked.trang_thai !== nextState) await locked.update({ trang_thai: nextState }, { transaction });
      const landlordAccountId = await getLandlordAccountForRoom(locked.ma_phong, transaction);
      if (!landlordAccountId) throw new Error(`Missing landlord for contract ${locked.ma_hop_dong}`);
      const recipients = [...new Set([contract.khachThue?.ma_tai_khoan, landlordAccountId].filter(Boolean))];
      for (const accountId of recipients) {
        const content = `Hợp đồng ${locked.ma_hop_dong} ${expired ? "đã hết hạn" : "sắp hết hạn"} ngày ${locked.ngay_ket_thuc}`;
        await require("../services/notification.service").createIdempotent({ ma_tai_khoan: accountId, loai_thong_bao: "HOP_DONG", noi_dung: content, khoa_su_kien: `HOP_DONG:${contract.ma_hop_dong}:${localDate(now, config.timezone)}`, thoi_diem_tao: now, da_doc: false }, { transaction });
      }
    });
  }
  return expiring.length;
}

function localHour(now, timezone) { return Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(now)); }
const localDate = businessDate;
async function scheduled(name, hourKey, work, now = new Date()) {
  const config = await getPersistedSystemConfig();
  if (localHour(now, config.timezone) !== config[hourKey]) return { due: false };
  return withNamedLock(`qlpt:${name}:${localDate(now, config.timezone)}`, work, { timeoutSeconds: config.namedLockTimeoutSeconds });
}

const initCronJobs = () => {
  cron.schedule("0 * * * *", () => scheduled("contracts", "contractJobHour", updateContractStates).catch((error) => console.error("[CRON] Contract status job failed:", error)));
  cron.schedule("0 * * * *", () => scheduled("reservations", "reservationJobHour", reservationService.notifyExpired).catch((error) => console.error("[CRON] Reservation expiry job failed:", error)));
  cron.schedule("5 * * * *", () => scheduled("move-outs", "moveOutJobHour", moveOutRequestService.processDueMoveOuts).catch((error) => console.error("[CRON] Move-out due job failed:", error)));
  cron.schedule("0 * * * *", () => billingCronService.run().catch((error) => console.error("[CRON] Billing job failed:", error)), { timezone: "Asia/Ho_Chi_Minh" });
  cron.schedule("15 * * * *", () => scheduled("debt", "debtLifecycleHour", debtLifecycleService.run).catch((error) => console.error("[CRON] Debt lifecycle job failed:", error)));
  console.log("✓ Cron jobs initialized successfully");
};

module.exports = { initCronJobs, updateContractStates, scheduled, processDueMoveOuts: moveOutRequestService.processDueMoveOuts, runBilling: billingCronService.run, runDebtLifecycle: debtLifecycleService.run };
