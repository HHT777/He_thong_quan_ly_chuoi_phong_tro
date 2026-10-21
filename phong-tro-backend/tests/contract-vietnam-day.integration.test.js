const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { HopDong, TaiKhoan, ChuTro } = require("../src/models");
const cronJobs = require("../src/jobs/cron.jobs");
const hopDongService = require("../src/services/hopDong.service");
const { DEFAULTS, getPersistedSystemConfig } = require("../src/services/systemConfig.service");
const { addBusinessDays, businessDate } = require("../src/utils/businessDate.util");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

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

test("FR-040 expiring list includes SAP_HET_HAN and excludes ended or out-of-window contracts", async () => {
  const landlord = await login(integration.landlord);
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const today = "2026-11-01";
  const cases = [
    { label: "active-10", end: addBusinessDays(today, 10), state: "DANG_HIEU_LUC", included: true },
    { label: "active-45", end: addBusinessDays(today, 45), state: "DANG_HIEU_LUC", included: false },
    { label: "soon-10", end: addBusinessDays(today, 10), state: "SAP_HET_HAN", included: true },
    { label: "expired-10", end: addBusinessDays(today, 10), state: "HET_HAN", included: false },
    { label: "settled-10", end: addBusinessDays(today, 10), state: "DA_THANH_LY", included: false },
    { label: "today", end: today, state: "DANG_HIEU_LUC", included: true },
    { label: "day-30", end: addBusinessDays(today, 30), state: "DANG_HIEU_LUC", included: true },
    { label: "day-31", end: addBusinessDays(today, 31), state: "DANG_HIEU_LUC", included: false },
  ];
  for (const entry of cases) {
    const rental = await createFreshRental(landlord, `expiring-${entry.label}`, { createAccount: false });
    entry.id = rental.contract.ma_hop_dong;
    await HopDong.update({ ngay_ket_thuc: entry.end, trang_thai: entry.state, ngay_thanh_ly: entry.state === "DA_THANH_LY" ? "2026-11-01" : null }, { where: { ma_hop_dong: entry.id } });
  }
  for (const now of [new Date("2026-10-31T16:30:00.000Z"), new Date("2026-10-31T17:30:00.000Z")]) {
    const date = businessDate(now);
    const rows = await hopDongService.getExpiringContracts(30, actor, { now });
    const found = new Set(rows.map((row) => row.ma_hop_dong));
    for (const entry of cases) {
      const expected = entry.included && entry.end >= date && entry.end <= addBusinessDays(date, 30);
      assert.equal(found.has(entry.id), expected, `${entry.label} at ${date}`);
    }
    const dates = rows.map((row) => String(row.ngay_ket_thuc));
    assert.deepEqual(dates, [...dates].sort(), "The expiring list must sort by contract end date");
  }
});

test("FR-040 cron-promoted SAP_HET_HAN contract remains visible through the endpoint and only to its owner", async () => {
  const ownerA = await login(integration.landlord);
  const now = new Date();
  const end = addBusinessDays(businessDate(now), 10);
  const rentalA = await createFreshRental(ownerA, "expiring-cron-a", { createAccount: false });
  await HopDong.update({ ngay_ket_thuc: end }, { where: { ma_hop_dong: rentalA.contract.ma_hop_dong } });
  const accountB = await TaiKhoan.create({
    ten_dang_nhap: `e${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("test-only-password", 10),
    vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false,
  });
  await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "Expiring owner B", so_dien_thoai: "0987654303" });
  const ownerB = jwt.sign({ ma_tai_khoan: accountB.ma_tai_khoan, ten_dang_nhap: accountB.ten_dang_nhap, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const rentalB = await createFreshRental(ownerB, "expiring-cron-b", { createAccount: false });
  await HopDong.update({ ngay_ket_thuc: end }, { where: { ma_hop_dong: rentalB.contract.ma_hop_dong } });

  await cronJobs.updateContractStates({ now });
  assert.equal((await HopDong.findByPk(rentalA.contract.ma_hop_dong)).trang_thai, "SAP_HET_HAN");
  assert.equal((await HopDong.findByPk(rentalB.contract.ma_hop_dong)).trang_thai, "SAP_HET_HAN");
  const a = await request("/api/hop-dong/expiring", { headers: headers(ownerA) });
  const b = await request("/api/hop-dong/expiring", { headers: headers(ownerB) });
  assert.equal(a.response.status, 200);
  assert.equal(b.response.status, 200);
  assert.equal(a.body.data.some((row) => row.ma_hop_dong === rentalA.contract.ma_hop_dong), true);
  assert.equal(a.body.data.some((row) => row.ma_hop_dong === rentalB.contract.ma_hop_dong), false);
  assert.equal(b.body.data.some((row) => row.ma_hop_dong === rentalB.contract.ma_hop_dong), true);
  assert.equal(b.body.data.some((row) => row.ma_hop_dong === rentalA.contract.ma_hop_dong), false);
});
