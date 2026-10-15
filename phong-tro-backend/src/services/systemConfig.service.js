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
});

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
  });
}

// Database values override environment/defaults when the configuration table is available.
async function getPersistedSystemConfig() {
  const { CauHinhHeThong } = require("../models");
  const fallback = getSystemConfig();
  const rows = await CauHinhHeThong.findAll();
  const values = Object.fromEntries(rows.map((row) => [row.khoa, row.gia_tri]));
  const number = (key, fallbackValue, min, max) => {
    const value = values[key] ?? fallbackValue; const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw Object.assign(new Error(`Cấu hình ${key} không hợp lệ`), { status: 422, code: "INVALID_SYSTEM_CONFIG" });
    return parsed;
  };
  return Object.freeze({ ...fallback, dueReminderDay: number("dueReminderDay", fallback.dueReminderDay, 1, 31), overdueDay: number("overdueDay", fallback.overdueDay, 1, 31), debtCloseDay: number("debtCloseDay", fallback.debtCloseDay, 1, 31), billScheduleDay: number("billScheduleDay", fallback.billScheduleDay, 1, 28), billScheduleHour: number("billScheduleHour", fallback.billScheduleHour, 0, 23), contractWarningDays: number("contractWarningDays", fallback.contractWarningDays, 1, 365), maxFileSizeBytes: number("maxFileSizeBytes", fallback.maxFileSizeBytes, 1, Number.MAX_SAFE_INTEGER) });
}

module.exports = { DEFAULTS, readPositiveInteger, getSystemConfig, getPersistedSystemConfig };
