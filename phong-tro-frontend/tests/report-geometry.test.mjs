import test from "node:test";
import assert from "node:assert/strict";
import { areaPath, donutSlicePath, groupBars, groupTypes, linePath, linePoints, moneyScale, niceStep, pieArcLengths, stepPath } from "../src/modules/finance/report.geometry.mjs";

test("thang tiền có âm, có đường không và tick dễ đọc", () => {
  const scale = moneyScale([-4_000_000, 0, 12_000_000]);
  assert.ok(scale.min <= -4_000_000);
  assert.ok(scale.max >= 12_000_000);
  assert.ok(scale.ticks.includes(0));
  assert.ok(scale.y(-4_000_000) > scale.zero);
  assert.ok(scale.y(12_000_000) < scale.zero);
  assert.equal(niceStep(0), 1);
  const empty = moneyScale([0, 0]);
  assert.ok(Number.isFinite(empty.y(0)));
  assert.ok(empty.max > empty.min);
});

test("bố cục cột nhóm, một điểm, đường, vùng và bậc thang đều hữu hạn", () => {
  const bars = groupBars([{ a: 10, b: 3 }, { a: 4, b: 2 }], ["a", "b"]);
  assert.ok(bars[0].bars[0].x < bars[0].bars[1].x);
  assert.ok(bars[0].bars[1].x < bars[1].bars[0].x);
  const scale = moneyScale([5]);
  const points = linePoints([{ profit: 5 }], "profit", scale);
  assert.equal(points.length, 1);
  assert.match(linePath(points), /^M\d+,/);
  assert.match(areaPath(points, scale.zero), / Z$/);
  assert.equal(stepPath(points), linePath(points));
  assert.match(stepPath([{ x: 1, y: 2 }, { x: 3, y: 4 }]), /H3 V4/);
});

test("cung tròn luôn cộng đúng chu vi và hơn sáu loại gom vào Khác", () => {
  const arcs = pieArcLengths([1, 1, 1]);
  assert.ok(Math.abs(arcs.reduce((sum, arc) => sum + arc.length, 0) - arcs[0].circumference) < 1e-8);
  assert.deepEqual(pieArcLengths([0, 0]).map((arc) => arc.length), [0, 0]);
  const grouped = groupTypes(Array.from({ length: 8 }, (_, index) => ({ type: `T${index}`, amount: 8 - index })));
  assert.equal(grouped.length, 6);
  assert.equal(grouped.at(-1).type, "OTHER");
  assert.equal(grouped.at(-1).amount, 6);
});

test("lát donut dùng đường bao khép kín, không chồng nét đứt ở điểm nối", () => {
  assert.equal(donutSlicePath(0, 0), "");
  assert.match(donutSlicePath(0, 0.858), / A85,85 0 1 1 /);
  assert.match(donutSlicePath(0.858, 1), / A85,85 0 0 1 /);
  assert.equal((donutSlicePath(0, 1).match(/ A85,85 /g) || []).length, 2);
  assert.ok(donutSlicePath(0, 1).endsWith(" Z"));
});
