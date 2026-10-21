// One allowlist supplies the API, validation, defaults and the configuration UI.
// contractStatusJobCron is intentionally excluded: the scheduled worker does not consume it.
const TIMEZONES = Object.freeze(["Asia/Ho_Chi_Minh", "Asia/Saigon"]); // Same Vietnam civil time.
const CONFIG_CATALOG = Object.freeze({
  timezone: { type: "timezone", defaultValue: "Asia/Ho_Chi_Minh", options: TIMEZONES, group: "Vùng giờ", description: "Múi giờ nghiệp vụ Việt Nam", env: "SYSTEM_TIMEZONE", affectsMoney: true, affectsCron: true },
  maxFileSizeBytes: { type: "integer", defaultValue: 10 * 1024 * 1024, min: 1, max: 100 * 1024 * 1024, group: "Ảnh", description: "Dung lượng tối đa của ảnh chỉ số điện (byte)", env: "MAX_FILE_SIZE" },
  contractWarningDays: { type: "integer", defaultValue: 30, min: 1, max: 365, group: "Hợp đồng", description: "Số ngày trước hạn để cảnh báo hợp đồng", env: "CONTRACT_WARNING_DAYS", affectsCron: true },
  dueReminderDay: { type: "integer", defaultValue: 5, min: 1, max: 28, group: "Công nợ", description: "Ngày nhắc thanh toán trong tháng", env: "DUE_REMINDER_DAY", affectsMoney: true, affectsCron: true },
  overdueDay: { type: "integer", defaultValue: 6, min: 1, max: 28, group: "Công nợ", description: "Ngày bắt đầu hiển thị quá hạn", env: "OVERDUE_DAY", affectsMoney: true, affectsCron: true },
  debtCloseDay: { type: "integer", defaultValue: 10, min: 1, max: 28, group: "Công nợ", description: "Hết ngày này sẽ ghi công nợ còn lại", env: "DEBT_CLOSE_DAY", affectsMoney: true, affectsCron: true },
  billScheduleDay: { type: "integer", defaultValue: 2, min: 1, max: 28, group: "Phiếu thu", description: "Ngày chạy tác vụ lập và gửi phiếu tự động", env: "BILL_SCHEDULE_DAY", affectsMoney: true, affectsCron: true },
  billScheduleHour: { type: "integer", defaultValue: 8, min: 0, max: 23, group: "Phiếu thu", description: "Giờ chạy tác vụ phiếu tự động (giờ Việt Nam)", env: "BILL_SCHEDULE_HOUR", affectsMoney: true, affectsCron: true },
  billingCronLookbackMonths: { type: "integer", defaultValue: 3, min: 1, max: 24, group: "Công nợ", description: "Số tháng kỳ cũ được tác vụ công nợ rà soát", env: "BILLING_CRON_LOOKBACK_MONTHS", affectsMoney: true, affectsCron: true },
  contractJobHour: { type: "integer", defaultValue: 8, min: 0, max: 23, group: "Lịch tự động", description: "Giờ chạy tác vụ trạng thái hợp đồng", env: "CONTRACT_JOB_HOUR", affectsCron: true },
  reservationJobHour: { type: "integer", defaultValue: 8, min: 0, max: 23, group: "Lịch tự động", description: "Giờ nhắc giữ phòng quá hạn", env: "RESERVATION_JOB_HOUR", affectsCron: true },
  moveOutJobHour: { type: "integer", defaultValue: 0, min: 0, max: 23, group: "Lịch tự động", description: "Giờ chuyển phòng theo ngày trả đã duyệt", env: "MOVE_OUT_JOB_HOUR", affectsCron: true },
  debtLifecycleHour: { type: "integer", defaultValue: 0, min: 0, max: 23, group: "Công nợ", description: "Giờ chạy tác vụ công nợ", env: "DEBT_LIFECYCLE_HOUR", affectsCron: true },
  namedLockTimeoutSeconds: { type: "integer", defaultValue: 0, min: 0, max: 60, group: "Lịch tự động", description: "Thời gian chờ khóa chống chạy trùng (giây)", env: "NAMED_LOCK_TIMEOUT_SECONDS", affectsCron: true },
});
const DEFAULTS = Object.freeze({ ...Object.fromEntries(Object.entries(CONFIG_CATALOG).map(([key, item]) => [key, item.defaultValue])), contractStatusJobCron: "0 8 * * *" });
const RANGES = Object.freeze(Object.fromEntries(Object.entries(CONFIG_CATALOG).filter(([, item]) => item.type === "integer").map(([key, item]) => [key, [item.min, item.max]])));
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
  const values = Object.fromEntries(Object.entries(CONFIG_CATALOG).map(([key, item]) => [key,
    item.type === "integer" ? readPositiveInteger(item.env, item.defaultValue, { min: item.min, max: item.max })
      : String(process.env[item.env] || process.env.TZ || item.defaultValue),
  ]));
  return Object.freeze({ ...values, contractStatusJobCron: String(process.env.CONTRACT_STATUS_JOB_CRON || DEFAULTS.contractStatusJobCron) });
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
  cache = Object.freeze({ ...fallback, ...Object.fromEntries(Object.entries(CONFIG_CATALOG).map(([key, item]) => [key,
    item.type === "integer" ? number(key, fallback[key], item.min, item.max)
      : (values[key] === undefined ? fallback[key] : validateSystemConfigValue(key, decodeScalar(values[key]))),
  ])) });
  cacheExpiresAt = Date.now() + 15_000;
  return cache;
}

function validateSystemConfigValue(key, value) {
  const item = CONFIG_CATALOG[key];
  if (!item) throw Object.assign(new Error("Khóa cấu hình không được hỗ trợ"), { status: 400, code: "UNKNOWN_SYSTEM_CONFIG", details: { key } });
  if (item.type === "timezone") {
    if (typeof value === "string" && item.options.includes(value)) return value;
    throw Object.assign(new Error(`Cấu hình ${key} phải là múi giờ Việt Nam được hỗ trợ`), { status: 400, code: "INVALID_SYSTEM_CONFIG", details: { key, options: item.options } });
  }
  const validShape = typeof value === "number" || (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value));
  const parsed = validShape ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < item.min || parsed > item.max) throw Object.assign(new Error(`Cấu hình ${key} phải là số nguyên từ ${item.min} đến ${item.max}`), { status: 400, code: "INVALID_SYSTEM_CONFIG", details: { key, min: item.min, max: item.max } });
  return parsed;
}
function invalidateSystemConfigCache() { cache = null; cacheExpiresAt = 0; }

function decodeScalar(raw) {
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch (_) { return raw; }
}

async function listSystemConfig() {
  const { CauHinhHeThong, TaiKhoan } = require("../models");
  const rows = await CauHinhHeThong.findAll({ where: { khoa: Object.keys(CONFIG_CATALOG) } });
  const byKey = new Map(rows.map((row) => [row.khoa, row]));
  const actorIds = [...new Set(rows.map((row) => row.nguoi_cap_nhat_id).filter(Boolean))];
  const actors = actorIds.length ? await TaiKhoan.findAll({ where: { ma_tai_khoan: actorIds }, attributes: ["ma_tai_khoan", "ten_dang_nhap"] }) : [];
  const actorNames = new Map(actors.map((row) => [row.ma_tai_khoan, row.ten_dang_nhap]));
  const fallback = getSystemConfig();
  return Object.entries(CONFIG_CATALOG).map(([key, item]) => {
    const row = byKey.get(key);
    const value = row ? decodeScalar(row.gia_tri) : fallback[key];
    return {
      key, value, type: item.type, domain: item.type === "integer" ? { min: item.min, max: item.max } : { options: item.options },
      defaultValue: item.defaultValue, description: item.description, group: item.group,
      affectsMoney: Boolean(item.affectsMoney), affectsCron: Boolean(item.affectsCron),
      updatedBy: row ? { id: row.nguoi_cap_nhat_id, username: actorNames.get(row.nguoi_cap_nhat_id) || null } : null,
      updatedAt: row?.ngay_cap_nhat || null,
      // Preserve the fields consumed by the existing meter-reading screen.
      khoa: key, gia_tri: value,
    };
  });
}

async function saveSystemConfig(key, rawValue, actorId, { restore = false } = {}) {
  const value = validateSystemConfigValue(key, restore ? CONFIG_CATALOG[key]?.defaultValue : rawValue);
  const sequelize = require("../config/database");
  const { CauHinhHeThong } = require("../models");
  const { writeAuditLog } = require("./auditLog.service");
  const saved = await sequelize.transaction(async (transaction) => {
    const existing = await CauHinhHeThong.findOne({ where: { khoa: key }, transaction, lock: transaction.LOCK.UPDATE });
    const before = existing ? { key, value: decodeScalar(existing.gia_tri) } : null;
    const fields = { gia_tri: value, mo_ta: CONFIG_CATALOG[key].description, ngay_cap_nhat: new Date(), nguoi_cap_nhat_id: actorId };
    const row = existing ? await existing.update(fields, { transaction }) : await CauHinhHeThong.create({ khoa: key, ...fields }, { transaction });
    await writeAuditLog({ transaction, actorId, action: restore ? "SYSTEM_CONFIG_RESET" : "SYSTEM_CONFIG_UPDATED", entityType: "CauHinhHeThong", entityId: row.ma_cau_hinh, before, after: { key, value } });
    return row;
  });
  invalidateSystemConfigCache();
  return saved;
}

module.exports = { CONFIG_CATALOG, DEFAULTS, RANGES, readPositiveInteger, getSystemConfig, getPersistedSystemConfig, validateSystemConfigValue, invalidateSystemConfigCache, listSystemConfig, saveSystemConfig };
