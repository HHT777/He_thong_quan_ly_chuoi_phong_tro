const cron = require("node-cron");
const { Op } = require("sequelize");
const { HopDong, KhachThue, TaiKhoan, ThongBao } = require("../models");
const { getSystemConfig } = require("../services/systemConfig.service");
const reservationService = require("../services/reservation.service");
const moveOutRequestService = require("../services/moveOutRequest.service");
const billingCronService = require("../services/billingCron.service");
const debtLifecycleService = require("../services/debtLifecycle.service");

async function updateContractStates() {
  const now = new Date();
  const warningDate = new Date(now);
  warningDate.setDate(warningDate.getDate() + getSystemConfig().contractWarningDays);
  const expiring = await HopDong.findAll({
    where: { trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] }, ngay_ket_thuc: { [Op.lte]: warningDate } },
    include: [{ model: KhachThue, as: "khachThue" }],
  });
  const landlord = await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG" } });
  for (const contract of expiring) {
    const expired = new Date(contract.ngay_ket_thuc) < now;
    const nextState = expired ? "HET_HAN" : "SAP_HET_HAN";
    if (contract.trang_thai !== nextState) await contract.update({ trang_thai: nextState });
    const recipients = [contract.khachThue?.ma_tai_khoan, landlord?.ma_tai_khoan].filter(Boolean);
    for (const accountId of recipients) {
      const content = `Hợp đồng ${contract.ma_hop_dong} ${expired ? "đã hết hạn" : "sắp hết hạn"} ngày ${contract.ngay_ket_thuc}`;
      const exists = await ThongBao.findOne({ where: { ma_tai_khoan: accountId, loai_thong_bao: "HOP_DONG", noi_dung: content } });
      if (!exists) await ThongBao.create({ ma_tai_khoan: accountId, loai_thong_bao: "HOP_DONG", noi_dung: content, thoi_diem_tao: new Date(), da_doc: false });
    }
  }
  return expiring.length;
}

const initCronJobs = () => {
  cron.schedule(getSystemConfig().contractStatusJobCron, () => updateContractStates().catch((error) => console.error("[CRON] Contract status job failed:", error)));
  cron.schedule(getSystemConfig().contractStatusJobCron, () => reservationService.notifyExpired().catch((error) => console.error("[CRON] Reservation expiry job failed:", error)));
  cron.schedule("5 0 * * *", () => moveOutRequestService.processDueMoveOuts().catch((error) => console.error("[CRON] Move-out due job failed:", error)), { timezone: "Asia/Ho_Chi_Minh" });
  cron.schedule("0 * * * *", () => billingCronService.run().catch((error) => console.error("[CRON] Billing job failed:", error)), { timezone: "Asia/Ho_Chi_Minh" });
  cron.schedule("15 * * * *", () => debtLifecycleService.run().catch((error) => console.error("[CRON] Debt lifecycle job failed:", error)), { timezone: "Asia/Ho_Chi_Minh" });
  console.log("✓ Cron jobs initialized successfully");
};

module.exports = { initCronJobs, updateContractStates, processDueMoveOuts: moveOutRequestService.processDueMoveOuts, runBilling: billingCronService.run, runDebtLifecycle: debtLifecycleService.run };
