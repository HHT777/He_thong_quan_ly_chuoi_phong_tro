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

export function donutSlicePath(startFraction, endFraction, outerRadius = 85, innerRadius = 51) {
  const start = Math.max(0, Math.min(1, Number(startFraction)));
  const end = Math.max(start, Math.min(1, Number(endFraction)));
  if (end === start) return "";
  const point = (radius, fraction) => {
    const angle = fraction * Math.PI * 2 - Math.PI / 2;
    return `${100 + radius * Math.cos(angle)},${100 + radius * Math.sin(angle)}`;
  };
  const section = (from, to) => {
    const large = to - from > 0.5 ? 1 : 0;
    return `M${point(outerRadius, from)} A${outerRadius},${outerRadius} 0 ${large} 1 ${point(outerRadius, to)} L${point(innerRadius, to)} A${innerRadius},${innerRadius} 0 ${large} 0 ${point(innerRadius, from)} Z`;
  };
  return end - start >= 1 ? `${section(0, 0.5)} ${section(0.5, 1)}` : section(start, end);
}

export function groupTypes(rows, limit = 6) {
  const sorted = [...rows].sort((a, b) => finite(b.amount) - finite(a.amount));
  if (sorted.length <= limit) return sorted;
  return [...sorted.slice(0, limit - 1), { type: "OTHER", amount: sorted.slice(limit - 1).reduce((sum, row) => sum + finite(row.amount), 0) }];
}
