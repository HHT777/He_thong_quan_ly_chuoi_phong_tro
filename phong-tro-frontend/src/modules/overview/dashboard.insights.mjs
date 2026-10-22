const MONEY = new Intl.NumberFormat("vi-VN");
const TASK_ORDER = ["OVERDUE_BILLS", "EXPIRED_RESERVATIONS", "NEW_INCIDENTS", "PENDING_REQUESTS",
  "PENDING_METER_READINGS", "EXPIRING_CONTRACTS", "VACANT_ROOMS"];

export const TASK_DETAILS = {
  OVERDUE_BILLS: ["Phiếu thu quá hạn", "Phiếu định kỳ còn nợ"],
  EXPIRED_RESERVATIONS: ["Giữ phòng quá hạn", "Cần kiểm tra thỏa thuận giữ phòng"],
  NEW_INCIDENTS: ["Sự cố chờ tiếp nhận", "Cần xem và phân công xử lý"],
  PENDING_REQUESTS: ["Yêu cầu chờ xử lý", "Cần xem và phản hồi khách thuê"],
  PENDING_METER_READINGS: ["Chỉ số điện chờ xác nhận", "Cần kiểm tra chỉ số đã gửi"],
  EXPIRING_CONTRACTS: ["Hợp đồng sắp hết hạn", "Cần xem xét gia hạn"],
  VACANT_ROOMS: ["Phòng trống", "Cần chuẩn bị cho thuê"],
};

const integer = (value, name, { negative = false } = {}) => {
  if (!Number.isSafeInteger(value) || (!negative && value < 0)) throw new TypeError(`Invalid ${name}`);
  return value;
};

export function formatVnd(value) { return `${MONEY.format(integer(value, "VND", { negative: true }))} đ`; }
export function formatBusinessDate(value) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])/.test(value)) return "—";
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

export function readInsights(response) {
  const data = response?.data;
  if (!data || !/^\d{4}-(0[1-9]|1[0-2])$/.test(data.period || "") ||
      !Array.isArray(data.cashflow6m) || data.cashflow6m.length !== 6 ||
      !Array.isArray(data.occupancyByBuilding) || !Array.isArray(data.tasks) || data.tasks.length !== TASK_ORDER.length) throw new TypeError("Invalid dashboard insights");
  const cashflow6m = data.cashflow6m.map((row) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month || "")) throw new TypeError("Invalid cashflow month");
    return { month: row.month, totalRevenue: integer(row.totalRevenue, "totalRevenue"),
      totalExpenses: integer(row.totalExpenses, "totalExpenses"), profit: integer(row.profit, "profit", { negative: true }),
      unassignedExpenses: row.unassignedExpenses };
  });
  if (cashflow6m[5].month !== data.period || new Set(cashflow6m.map((row) => row.month)).size !== 6) throw new TypeError("Invalid cashflow period");
  const revenueChangePct = data.revenueChangePct;
  if (revenueChangePct !== null && (typeof revenueChangePct !== "number" || !Number.isFinite(revenueChangePct))) throw new TypeError("Invalid revenueChangePct");
  const occupancyByBuilding = data.occupancyByBuilding.map((row) => {
    if (typeof row.buildingId !== "string" || typeof row.buildingName !== "string" || typeof row.inComparison !== "boolean" ||
        typeof row.pct !== "number" || !Number.isFinite(row.pct) || row.pct < 0 || row.pct > 100) throw new TypeError("Invalid building occupancy");
    const total = integer(row.total, "building.total"); const rented = integer(row.rented, "building.rented");
    if (rented > total) throw new TypeError("Invalid building occupancy");
    return { buildingId: row.buildingId, buildingName: row.buildingName, total, rented, pct: row.pct, inComparison: row.inComparison };
  });
  const billBuckets = Object.fromEntries(["paid", "outstanding", "overdue", "total"].map((key) => [key, integer(data.billBuckets?.[key], `billBuckets.${key}`)]));
  if (billBuckets.paid + billBuckets.outstanding + billBuckets.overdue !== billBuckets.total) throw new TypeError("Invalid bill partition");
  const contractForecast = Object.fromEntries(["d30", "d60", "d90"].map((key) => [key, integer(data.contractForecast?.[key], `contractForecast.${key}`)]));
  if (contractForecast.d30 > contractForecast.d60 || contractForecast.d60 > contractForecast.d90) throw new TypeError("Invalid contract forecast");
  const found = new Map(data.tasks.map((task) => [task.type, integer(task.count, `tasks.${task.type}`)]));
  if (found.size !== TASK_ORDER.length || TASK_ORDER.some((type) => !found.has(type))) throw new TypeError("Invalid dashboard tasks");
  const tasks = TASK_ORDER.map((type) => ({ type, count: found.get(type) })).filter((task) => task.count > 0);
  const contractWarningDays = integer(data.contractWarningDays, "contractWarningDays");
  if (contractWarningDays < 1 || contractWarningDays > 365) throw new TypeError("Invalid contractWarningDays");
  return { period: data.period, cashflow6m, revenueChangePct, occupancyByBuilding, billBuckets,
    contractForecast, tasks, contractWarningDays };
}

export function donutSegments(byStatus, total, states, circumference = 2 * Math.PI * 62) {
  integer(total, "rooms.total");
  let used = 0;
  const nonzero = states.filter((state) => integer(byStatus[state], `rooms.${state}`) > 0);
  return nonzero.map((state, index) => {
    const length = total ? (index === nonzero.length - 1 ? circumference - used : byStatus[state] / total * circumference) : 0;
    const segment = { state, length, offset: used };
    used += length;
    return segment;
  });
}

export function billSegments(bills) {
  return ["paid", "outstanding", "overdue"].filter((key) => bills[key] > 0)
    .map((key) => ({ key, count: bills[key], width: bills.total ? bills[key] * 100 / bills.total : 0 }));
}

export function cashflowScale(rows) {
  const bound = Math.max(1, ...rows.flatMap((row) => [Math.abs(row.totalRevenue), Math.abs(row.totalExpenses), Math.abs(row.profit)]));
  return { min: -bound, max: bound, y: (value, top = 20, height = 180) => top + (bound - value) * height / (2 * bound) };
}
