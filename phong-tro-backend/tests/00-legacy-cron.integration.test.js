const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Op } = require("sequelize");
const { integration } = require("./helpers/integration-api");
const sequelize = require("../src/config/database");
const { TaiKhoan, HopDong, PhongTro, ThanhToan, ThongBao } = require("../src/models");
const cronJobs = require("../src/jobs/cron.jobs");
const reservationService = require("../src/services/reservation.service");

test("F.0 legacy seed runs every cron twice without old-period records", async () => {
  assert.equal(await HopDong.count(), 18);
  assert.equal(await PhongTro.count(), 30);
  assert.equal(await TaiKhoan.count(), 21);
  const now = new Date("2026-10-16T08:00:00+07:00");
  const oldBillsBefore = await ThanhToan.count({ where: { [Op.or]: [{ nam: { [Op.lt]: 2026 } }, { nam: 2026, thang: { [Op.lt]: 10 } }] } });
  const oldNotificationsBefore = await ThongBao.count({ where: { thoi_diem_tao: { [Op.lt]: new Date("2026-10-01T00:00:00Z") } } });
  const runAll = async () => {
    await cronJobs.updateContractStates();
    await reservationService.notifyExpired({ now });
    await cronJobs.processDueMoveOuts({ now });
    await cronJobs.runBilling({ now, force: true });
    await cronJobs.runDebtLifecycle({ now });
  };
  await runAll();
  const first = {
    oldBills: await ThanhToan.count({ where: { [Op.or]: [{ nam: { [Op.lt]: 2026 } }, { nam: 2026, thang: { [Op.lt]: 10 } }] } }),
    oldNotifications: await ThongBao.count({ where: { thoi_diem_tao: { [Op.lt]: new Date("2026-10-01T00:00:00Z") } } }),
  };
  await runAll();
  const second = {
    oldBills: await ThanhToan.count({ where: { [Op.or]: [{ nam: { [Op.lt]: 2026 } }, { nam: 2026, thang: { [Op.lt]: 10 } }] } }),
    oldNotifications: await ThongBao.count({ where: { thoi_diem_tao: { [Op.lt]: new Date("2026-10-01T00:00:00Z") } } }),
  };
  assert.deepEqual(first, { oldBills: oldBillsBefore, oldNotifications: oldNotificationsBefore });
  assert.deepEqual(second, first);
  await sequelize.query("SELECT 1");
  assert.ok(integration);
});
