const test = require("node:test");
const assert = require("node:assert/strict");
const { HopDong, TaiKhoan } = require("../src/models");
const cronJobs = require("../src/jobs/cron.jobs");
const hopDongService = require("../src/services/hopDong.service");
const { DEFAULTS, getPersistedSystemConfig } = require("../src/services/systemConfig.service");
const { addBusinessDays } = require("../src/utils/businessDate.util");
const { integration, login, createFreshRental } = require("./helpers/integration-api");

const earlyNovember = new Date("2026-10-31T19:00:00.000Z"); // November 1, 02:00 in Vietnam.
const lateNovember = new Date("2026-11-01T16:59:00.000Z"); // November 1, 23:59 in Vietnam.
const nextDay = new Date("2026-11-01T17:00:00.000Z"); // November 2, 00:00 in Vietnam.

test("FR-040 contract remains SAP_HET_HAN through its Vietnam end date and expires next day", async () => {
  const landlord = await login(integration.landlord);
  const rental = await createFreshRental(landlord, "contract-end-vietnam", { createAccount: false });
  const contractId = rental.contract.ma_hop_dong;
  await HopDong.update({ ngay_ket_thuc: "2026-11-01" }, { where: { ma_hop_dong: contractId } });

  await cronJobs.updateContractStates({ now: earlyNovember });
  assert.equal((await HopDong.findByPk(contractId)).trang_thai, "SAP_HET_HAN");
  await cronJobs.updateContractStates({ now: lateNovember });
  assert.equal((await HopDong.findByPk(contractId)).trang_thai, "SAP_HET_HAN");
  await cronJobs.updateContractStates({ now: nextDay });
  assert.equal((await HopDong.findByPk(contractId)).trang_thai, "HET_HAN");
});

test("FR-158 expiring-contract list includes today and exact configured upper boundary", async () => {
  const landlord = await login(integration.landlord);
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const warningDays = (await getPersistedSystemConfig()).contractWarningDays;
  assert.equal(DEFAULTS.contractWarningDays, 30);
  const dates = ["2026-11-01", addBusinessDays("2026-11-01", warningDays), addBusinessDays("2026-11-01", warningDays + 1)];
  const ids = [];
  for (const [index, endDate] of dates.entries()) {
    const rental = await createFreshRental(landlord, `contract-expiring-boundary-${index}`, { createAccount: false });
    ids.push(rental.contract.ma_hop_dong);
    await HopDong.update({ ngay_ket_thuc: endDate }, { where: { ma_hop_dong: rental.contract.ma_hop_dong } });
  }
  for (const now of [earlyNovember, lateNovember]) {
    const rows = await hopDongService.getExpiringContracts(warningDays, actor, { now });
    const found = new Set(rows.map((row) => row.ma_hop_dong));
    assert.equal(found.has(ids[0]), true, "Today must be included");
    assert.equal(found.has(ids[1]), true, "Exact warning boundary must be included");
    assert.equal(found.has(ids[2]), false, "Day after warning boundary must be excluded");
  }
});
