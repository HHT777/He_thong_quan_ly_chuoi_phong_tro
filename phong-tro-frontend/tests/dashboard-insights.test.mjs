import test from "node:test";
import assert from "node:assert/strict";
import { billSegments, cashflowScale, donutSegments, donutStrokes, formatBusinessDate, formatVnd, readInsights } from "../src/modules/overview/dashboard.insights.mjs";
import { insightsResponse } from "./fixtures/dashboard-insights.sample.mjs";

const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const fixture = () => ({ data: {
  period: "2026-10", cashflow6m: months.map((month, index) => ({ month, totalRevenue: index * 100, totalExpenses: index * 40, profit: index * 60,
    unassignedExpenses: { count: 0, total: 0 } })), revenueChangePct: 25,
  occupancyByBuilding: [{ buildingId: "building-a", buildingName: "Căn A", total: 3, rented: 2, pct: 66.67, inComparison: true },
    { buildingId: "building-b", buildingName: "Căn B", total: 1, rented: 0, pct: 0, inComparison: false }],
  billBuckets: { paid: 1, outstanding: 2, overdue: 3, total: 6 }, contractForecast: { d30: 1, d60: 2, d90: 3 },
  tasks: ["OVERDUE_BILLS", "EXPIRED_RESERVATIONS", "NEW_INCIDENTS", "PENDING_REQUESTS", "PENDING_METER_READINGS", "EXPIRING_CONTRACTS", "VACANT_ROOMS"]
    .map((type, index) => ({ type, count: index + 1 })), contractWarningDays: 30,
} });

test("UI-2a-2 insights contract reads exact server fields and orders nonzero tasks", () => {
  const value = readInsights(fixture());
  assert.equal(value.cashflow6m[5].totalRevenue, 500);
  assert.equal(value.cashflow6m[5].profit, 300);
  assert.equal(value.occupancyByBuilding[1].inComparison, false);
  assert.deepEqual(value.billBuckets, { paid: 1, outstanding: 2, overdue: 3, total: 6 });
  assert.deepEqual(value.contractForecast, { d30: 1, d60: 2, d90: 3 });
  assert.deepEqual(value.tasks.map((row) => row.type), fixture().data.tasks.map((row) => row.type));
  assert.equal(value.contractWarningDays, 30);
  const changed = fixture(); delete changed.data.cashflow6m[5].totalRevenue;
  assert.throws(() => readInsights(changed), /totalRevenue/);
  changed.data.cashflow6m[5].totalRevenue = 0.5;
  assert.throws(() => readInsights(changed), /totalRevenue/);
});

test("UI-2a-2 maps the captured owner-scoped API fixture without recalculating money", () => {
  const sample = readInsights(insightsResponse);
  assert.equal(sample.cashflow6m[5].totalRevenue, 29475661);
  assert.equal(sample.cashflow6m[5].totalExpenses, 4380000);
  assert.equal(sample.cashflow6m[5].profit, 25095661);
  assert.equal(sample.revenueChangePct, -45.67);
  assert.deepEqual(sample.billBuckets, { paid: 5, outstanding: 0, overdue: 11, total: 16 });
  assert.deepEqual(sample.contractForecast, { d30: 1, d60: 1, d90: 1 });
  assert.equal(sample.occupancyByBuilding.length, 3);
  assert.equal(sample.tasks[0].count, 11);
});

test("UI-2a-2 donut and bill segments conserve totals and omit zero without NaN", () => {
  const segments = donutSegments({ DANG_THUE: 2, TRONG: 1, DA_GIU: 0 }, 3, ["DANG_THUE", "TRONG", "DA_GIU"]);
  assert.equal(segments.length, 2);
  assert.ok(Math.abs(segments.reduce((sum, row) => sum + row.length, 0) - 2 * Math.PI * 62) < 1e-9);
  assert.deepEqual(donutSegments({ TRONG: 0 }, 0, ["TRONG"]), []);
  assert.deepEqual(billSegments({ paid: 0, outstanding: 0, overdue: 0, total: 0 }), []);
  assert.equal(billSegments({ paid: 2, outstanding: 1, overdue: 1, total: 4 }).reduce((sum, row) => sum + row.width, 0), 100);
});

test("UI-2a-2 donut joins overlap subtly without changing room proportions", () => {
  const counts = { DANG_THUE: 15, TRONG: 12, DA_GIU: 0, DANG_XU_LY_TRA_PHONG: 1, NGUNG_SU_DUNG: 2, KHAC: 0 };
  const states = Object.keys(counts);
  const circumference = 2 * Math.PI * 62;
  const segments = donutSegments(counts, 30, states);
  const strokes = donutStrokes(segments, circumference);
  assert.deepEqual(strokes.map((row) => row.state), ["DANG_THUE", "TRONG", "DANG_XU_LY_TRA_PHONG", "NGUNG_SU_DUNG"]);
  assert.equal(segments[0].length / circumference, 0.5);
  assert.ok(Math.abs(segments[1].length / circumference - 0.4) < 1e-12);
  for (const [index, stroke] of strokes.entries()) {
    assert.equal(stroke.offset, segments[index].offset);
    assert.ok(stroke.dashLength > segments[index].length, "join must cover subpixel seam");
    assert.ok(stroke.dashLength - segments[index].length <= 0.5, "join must not visibly change proportion");
    assert.ok(stroke.gapLength >= 0);
    assert.ok(Math.abs(stroke.dashLength + stroke.gapLength - circumference) < 1e-9);
  }
});

test("UI-2a-2 cashflow scale includes negative profit and survives six zero months", () => {
  const value = cashflowScale([{ totalRevenue: 10, totalExpenses: 30, profit: -20 }]);
  assert.ok(value.min < -20 && value.max >= 30);
  assert.ok(value.y(-20) > value.y(0));
  assert.ok(value.y(30) < value.y(0));
  const zero = cashflowScale(Array.from({ length: 6 }, () => ({ totalRevenue: 0, totalExpenses: 0, profit: 0 })));
  assert.equal(zero.y(0), 110);
  assert.equal(Number.isFinite(zero.y(0)), true);
});

test("UI-2a-2 formats Vietnamese money and business dates without machine timezone", () => {
  assert.equal(formatVnd(25095661), "25.095.661 đ");
  assert.equal(formatVnd(-1000), "-1.000 đ");
  assert.equal(formatBusinessDate("2026-11-01T00:00:00"), "01/11/2026");
  assert.equal(formatBusinessDate("not-a-date"), "—");
});
