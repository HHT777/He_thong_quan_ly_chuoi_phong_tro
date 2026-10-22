// GET /api/v1/dashboard/insights?period=2026-10 on qlpt_authz_test,
// owner_ci, captured 22/10/2026. No account credentials are stored here.
export const insightsResponse = { data: {
  period: "2026-10",
  cashflow6m: [
    { month: "2026-05", totalRevenue: 0, totalExpenses: 0, profit: 0, unassignedExpenses: { count: 0, total: 0 } },
    { month: "2026-06", totalRevenue: 0, totalExpenses: 0, profit: 0, unassignedExpenses: { count: 0, total: 0 } },
    { month: "2026-07", totalRevenue: 0, totalExpenses: 0, profit: 0, unassignedExpenses: { count: 0, total: 0 } },
    { month: "2026-08", totalRevenue: 0, totalExpenses: 0, profit: 0, unassignedExpenses: { count: 0, total: 0 } },
    { month: "2026-09", totalRevenue: 54256250, totalExpenses: 0, profit: 54256250, unassignedExpenses: { count: 0, total: 0 } },
    { month: "2026-10", totalRevenue: 29475661, totalExpenses: 4380000, profit: 25095661, unassignedExpenses: { count: 0, total: 0 } },
  ],
  revenueChangePct: -45.67,
  occupancyByBuilding: [
    { buildingId: "c5c294c5-65c3-508e-ae56-3a4f28755fb9", buildingName: "Căn trọ An Bình", total: 10, rented: 5, pct: 50, inComparison: true },
    { buildingId: "f497891e-cb02-590b-bd80-de874320290f", buildingName: "Căn trọ Bình Minh", total: 10, rented: 5, pct: 50, inComparison: true },
    { buildingId: "f8e9ba5c-1161-5b50-8b66-98dc672cc646", buildingName: "Căn trọ Hoa Sen", total: 10, rented: 5, pct: 50, inComparison: true },
  ],
  billBuckets: { paid: 5, outstanding: 0, overdue: 11, total: 16 },
  contractForecast: { d30: 1, d60: 1, d90: 1 },
  tasks: [
    { type: "OVERDUE_BILLS", count: 11 }, { type: "EXPIRED_RESERVATIONS", count: 0 },
    { type: "NEW_INCIDENTS", count: 1 }, { type: "PENDING_REQUESTS", count: 3 },
    { type: "PENDING_METER_READINGS", count: 10 }, { type: "EXPIRING_CONTRACTS", count: 0 },
    { type: "VACANT_ROOMS", count: 12 },
  ],
  contractWarningDays: 30,
} };
