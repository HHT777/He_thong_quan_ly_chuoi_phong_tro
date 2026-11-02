const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

function businessDate(value = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  if (value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new RangeError("Invalid business date");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addBusinessDays(value, days) {
  const [year, month, day] = businessDate(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const businessMonth = (value = new Date(), timeZone = BUSINESS_TIME_ZONE) => businessDate(value, timeZone).slice(0, 7);

module.exports = { BUSINESS_TIME_ZONE, businessDate, businessMonth, addBusinessDays };
