const DEFAULTS = Object.freeze({
  timezone: "Asia/Ho_Chi_Minh",
  maxFileSizeBytes: 10 * 1024 * 1024,
  contractWarningDays: 30,
  contractStatusJobCron: "0 8 * * *",
  dueReminderDay: 5,
  overdueDay: 6,
  debtCloseDay: 10,
  billScheduleDay: 2,
  billScheduleHour: 8,
  billingCronLookbackMonths: 3,
  contractJobHour: 8,
  reservationJobHour: 8,
  moveOutJobHour: 0,
  debtLifecycleHour: 0,
  namedLockTimeoutSeconds: 0,
});
const RANGES = Object.freeze({
  maxFileSizeBytes: [1, 100 * 1024 * 1024], contractWarningDays: [1, 365],
  dueReminderDay: [1, 28], overdueDay: [1, 28], debtCloseDay: [1, 28], billScheduleDay: [1, 28],
  billScheduleHour: [0, 23], billingCronLookbackMonths: [1, 24], contractJobHour: [0, 23],
  reservationJobHour: [0, 23], moveOutJobHour: [0, 23], debtLifecycleHour: [0, 23], namedLockTimeoutSeconds: [0, 60],
});
let cache = null;
let cacheExpiresAt = 0;

function readPositiveInteger(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw Object.assign(new Error(`${name} phải là số nguyên từ ${min} đến ${max}`), {
      status: 500,
      code: "INVALID_SYSTEM_CONFIG",
    });
  }
  return parsed;
}

function getSystemConfig() {
  return Object.freeze({
    timezone: String(process.env.SYSTEM_TIMEZONE || process.env.TZ || DEFAULTS.timezone),
    maxFileSizeBytes: readPositiveInteger("MAX_FILE_SIZE", DEFAULTS.maxFileSizeBytes),
    contractWarningDays: readPositiveInteger("CONTRACT_WARNING_DAYS", DEFAULTS.contractWarningDays, { max: 365 }),
    contractStatusJobCron: String(process.env.CONTRACT_STATUS_JOB_CRON || DEFAULTS.contractStatusJobCron),
    dueReminderDay: readPositiveInteger("DUE_REMINDER_DAY", DEFAULTS.dueReminderDay, { max: 31 }),
    overdueDay: readPositiveInteger("OVERDUE_DAY", DEFAULTS.overdueDay, { max: 31 }),
    debtCloseDay: readPositiveInteger("DEBT_CLOSE_DAY", DEFAULTS.debtCloseDay, { max: 31 }),
    billScheduleDay: readPositiveInteger("BILL_SCHEDULE_DAY", DEFAULTS.billScheduleDay, { max: 28 }),
    billScheduleHour: readPositiveInteger("BILL_SCHEDULE_HOUR", DEFAULTS.billScheduleHour, { min: 0, max: 23 }),
    billingCronLookbackMonths: readPositiveInteger("BILLING_CRON_LOOKBACK_MONTHS", DEFAULTS.billingCronLookbackMonths, { max: 24 }),
    contractJobHour: readPositiveInteger("CONTRACT_JOB_HOUR", DEFAULTS.contractJobHour, { min: 0, max: 23 }),
    reservationJobHour: readPositiveInteger("RESERVATION_JOB_HOUR", DEFAULTS.reservationJobHour, { min: 0, max: 23 }),
    moveOutJobHour: readPositiveInteger("MOVE_OUT_JOB_HOUR", DEFAULTS.moveOutJobHour, { min: 0, max: 23 }),
    debtLifecycleHour: readPositiveInteger("DEBT_LIFECYCLE_HOUR", DEFAULTS.debtLifecycleHour, { min: 0, max: 23 }),
    namedLockTimeoutSeconds: readPositiveInteger("NAMED_LOCK_TIMEOUT_SECONDS", DEFAULTS.namedLockTimeoutSeconds, { min: 0, max: 60 }),
  });
}

// Database values override environment/defaults when the configuration table is available.
async function getPersistedSystemConfig() {
  if (cache && Date.now() < cacheExpiresAt) return cache;
  const { CauHinhHeThong } = require("../models");
  const fallback = getSystemConfig();
  const rows = await CauHinhHeThong.findAll();
  const values = Object.fromEntries(rows.map((row) => [row.khoa, row.gia_tri]));
  const number = (key, fallbackValue, min, max) => {
    let value = values[key] ?? fallbackValue;
    // MariaDB may return a JSON scalar as its serialized representation (for
    // example `"3"`) while MySQL/other drivers return the scalar directly.
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch (_) { /* plain string */ }
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw Object.assign(new Error(`Cấu hình ${key} không hợp lệ`), { status: 422, code: "INVALID_SYSTEM_CONFIG" });
    return parsed;
  };
  cache = Object.freeze({ ...fallback, ...Object.fromEntries(Object.entries(RANGES).map(([key, [min, max]]) => [key, number(key, fallback[key], min, max)])) });
  cacheExpiresAt = Date.now() + 15_000;
  return cache;
}

function validateSystemConfigValue(key, value) {
  if (!Object.hasOwn(RANGES, key)) throw Object.assign(new Error("Khóa cấu hình không được hỗ trợ"), { status: 422, code: "UNKNOWN_SYSTEM_CONFIG" });
  const parsed = Number(value); const [min, max] = RANGES[key];
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw Object.assign(new Error(`Cấu hình ${key} phải là số nguyên từ ${min} đến ${max}`), { status: 422, code: "INVALID_SYSTEM_CONFIG" });
  return parsed;
}
function invalidateSystemConfigCache() { cache = null; cacheExpiresAt = 0; }

module.exports = { DEFAULTS, RANGES, readPositiveInteger, getSystemConfig, getPersistedSystemConfig, validateSystemConfigValue, invalidateSystemConfigCache };
