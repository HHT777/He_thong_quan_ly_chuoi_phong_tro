const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function niceStep(span, segments = 4) {
  if (!(span > 0)) return 1;
  const raw = span / segments;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((unit) => unit * magnitude).find((unit) => unit >= raw) || 10 * magnitude;
}

export function moneyScale(values, height = 180) {
  const numbers = values.map(finite);
  const rawMin = Math.min(0, ...numbers);
  const rawMax = Math.max(0, ...numbers);
  const step = niceStep(rawMax - rawMin || 1);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.max(step, Math.ceil(rawMax / step) * step);
  const y = (value) => 24 + (max - finite(value)) / (max - min) * height;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => min + index * step);
  return { min, max, step, ticks, y, zero: y(0) };
}

export function groupBars(rows, keys, { left = 76, width = 640, barWidth = 22 } = {}) {
  const slot = width / Math.max(1, rows.length);
  return rows.map((row, index) => ({
    center: left + slot * (index + .5),
    bars: keys.map((key, barIndex) => ({ key, value: finite(row[key]), x: left + slot * (index + .5) + (barIndex - (keys.length - 1) / 2) * (barWidth + 4) - barWidth / 2, width: barWidth })),
  }));
}

export function linePoints(rows, key, scale, { left = 76, width = 640 } = {}) {
  const slot = width / Math.max(1, rows.length);
  return rows.map((row, index) => ({ x: left + slot * (index + .5), y: scale.y(row[key]) }));
}

export function linePath(points) {
  return points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
}

export function areaPath(points, baseline) {
  if (!points.length) return "";
  return `${linePath(points)} L${points.at(-1).x},${baseline} L${points[0].x},${baseline} Z`;
}

export function stepPath(points) {
  if (!points.length) return "";
  return points.slice(1).reduce((path, point, index) => `${path} H${point.x} V${point.y}`, `M${points[0].x},${points[0].y}`);
}

export function pieArcLengths(values, radius = 68) {
  const safe = values.map((value) => Math.max(0, finite(value)));
  const total = safe.reduce((sum, value) => sum + value, 0);
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return safe.map((value) => {
    const length = total ? value / total * circumference : 0;
    const arc = { length, offset, circumference };
    offset += length;
    return arc;
  });
}

export function groupTypes(rows, limit = 6) {
  const sorted = [...rows].sort((a, b) => finite(b.amount) - finite(a.amount));
  if (sorted.length <= limit) return sorted;
  return [...sorted.slice(0, limit - 1), { type: "OTHER", amount: sorted.slice(limit - 1).reduce((sum, row) => sum + finite(row.amount), 0) }];
}
