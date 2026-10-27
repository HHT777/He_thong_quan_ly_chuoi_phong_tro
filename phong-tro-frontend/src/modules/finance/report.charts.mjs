import { escapeHtml } from "../../shared/components/view.js";
import { areaPath, donutSlicePath, groupBars, groupTypes, linePath, linePoints, moneyScale, pieArcLengths, stepPath } from "./report.geometry.mjs";
import { expenseLabel, reportMoney, revenueLabel, sharesToOneDecimal } from "./report.model.mjs";

const safe = escapeHtml;
const keyFor = (metric) => ({ revenue: "totalRevenue", expenses: "totalExpenses", profit: "profit" })[metric];
const titleFor = (metric) => ({ revenue: "Doanh thu thực nhận", expenses: "Chi phí", profit: "Lợi nhuận" })[metric];
const graphicClass = (metric) => ({ revenue: "report-graphic--revenue", expenses: "report-graphic--expenses", profit: "report-graphic--profit" })[metric];
const shortMoney = (value) => {
  const amount = Number(value);
  const abs = Math.abs(amount);
  const formatted = (unit) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(amount / unit);
  return abs >= 1_000_000 ? `${formatted(1_000_000)} tr` : abs >= 1_000 ? `${formatted(1_000)} nghìn` : `${Math.round(amount)} đ`;
};
const monthLabel = (month) => `${Number(month.slice(5))}/${month.slice(0, 4)}`;
const hiddenTable = (caption, heads, rows) => `<div class="report-sr-only"><table><caption>${safe(caption)}</caption><thead><tr>${heads.map((label) => `<th scope="col">${safe(label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${safe(cell)}</th>` : `<td>${safe(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const readout = () => '<p class="report-chart-readout" data-chart-readout aria-live="polite"></p>';
const legend = (items, note = "") => `<div class="report-symbol-legend" aria-label="Chú thích biểu đồ">${items.map(([symbol, label]) => `<span><i class="report-legend-symbol report-legend-symbol--${symbol}" aria-hidden="true"></i>${safe(label)}</span>`).join("")}${note ? `<small>${safe(note)}</small>` : ""}</div>`;

function grid(scale) {
  return `${scale.ticks.map((tick) => `<line class="report-grid-line" x1="76" x2="718" y1="${scale.y(tick)}" y2="${scale.y(tick)}"/><text x="6" y="${scale.y(tick) + 4}">${shortMoney(tick)}</text>`).join("")}<line class="report-zero-line" x1="76" x2="718" y1="${scale.zero}" y2="${scale.zero}"/>`;
}

export function timeChart(rows, metric, kind = "bar", selectedMonth = "") {
  const key = keyFor(metric);
  const values = rows.map((row) => Number(row[key] || 0));
  const scale = moneyScale(values);
  const bars = groupBars(rows, [key]);
  const points = linePoints(rows, key, scale);
  const title = `${titleFor(metric)} theo thời gian`;
  const labels = rows.map((row, index) => `<text class="report-x-label ${row.month === selectedMonth ? "is-selected" : ""}" x="${points[index].x}" y="235" text-anchor="middle">${safe(monthLabel(row.month))}</text>`).join("");
  const focus = rows.map((row, index) => {
    const detail = `Tháng ${monthLabel(row.month)}: ${titleFor(metric).toLowerCase()} ${reportMoney(row[key])}`;
    return `<rect class="report-focus-target" tabindex="0" x="${points[index].x - Math.min(30, 300 / Math.max(1, rows.length))}" y="18" width="${Math.min(60, 600 / Math.max(1, rows.length))}" height="198" aria-label="${safe(detail)}" data-chart-detail="${safe(detail)}"><title>${safe(detail)}</title></rect>`;
  }).join("");
  let marks = "";
  if (kind === "bar") marks = bars.map(({ bars: columns }, index) => columns.map((bar) => `<rect class="report-series-mark" x="${bar.x}" y="${Math.min(scale.zero, scale.y(bar.value))}" width="${bar.width}" height="${Math.max(1, Math.abs(scale.y(bar.value) - scale.zero))}" stroke-width="2"/>${rows.length <= 6 ? `<text class="report-value-label" x="${bar.x + bar.width / 2}" y="${Math.max(15, Math.min(scale.zero, scale.y(bar.value)) - 5)}" text-anchor="middle">${shortMoney(bar.value)}</text>` : ""}`).join("")).join("");
  else {
    if (kind === "area") marks += `<path class="report-series-area" d="${areaPath(points, scale.zero)}"/>`;
    marks += `<path class="report-series-line" d="${linePath(points)}"/>`;
    marks += points.map((point, index) => `<circle class="report-series-point" cx="${point.x}" cy="${point.y}" r="3.5"/>${rows.length <= 6 ? `<text class="report-value-label" x="${point.x}" y="${Math.max(15, point.y - 10)}" text-anchor="middle">${shortMoney(values[index])}</text>` : ""}`).join("");
  }
  const table = hiddenTable(title, ["Tháng", titleFor(metric)], rows.map((row) => [monthLabel(row.month), reportMoney(row[key])]));
  return `${legend([[`${metric}-${kind}`, `${kind === "bar" ? "Cột" : kind === "line" ? "Đường" : "Vùng"}: ${titleFor(metric)}`]], "Đơn vị: đồng")}<div class="report-chart-scroll"><svg class="report-graphic ${graphicClass(metric)}" viewBox="0 0 740 250" role="img" aria-label="${safe(title)}; số chính xác ở bảng đi kèm">${grid(scale)}${marks}${focus}${labels}</svg></div>${readout()}${table}`;
}

export function overviewChart(rows, selectedMonth = "") {
  if (!rows.length) return '<p class="report-empty">Chưa có dữ liệu xu hướng.</p>';
  const values = rows.flatMap((row) => [row.totalRevenue, row.totalExpenses, row.profit]);
  const scale = moneyScale(values);
  const groups = groupBars(rows, ["totalRevenue", "totalExpenses"], { barWidth: rows.length > 6 ? 14 : 22 });
  const profit = linePoints(rows, "profit", scale);
  const marks = groups.map((group, index) => group.bars.map((bar) => `<rect class="${bar.key === "totalRevenue" ? "report-overview-revenue" : "report-overview-expenses"}" x="${bar.x}" y="${Math.min(scale.zero, scale.y(bar.value))}" width="${bar.width}" height="${Math.max(1, Math.abs(scale.y(bar.value) - scale.zero))}"/>${rows.length <= 6 ? `<text class="report-value-label" x="${bar.x + bar.width / 2}" y="${Math.max(15, Math.min(scale.zero, scale.y(bar.value)) - 5)}" text-anchor="middle">${shortMoney(bar.value)}</text>` : ""}`).join("") + `<text class="report-x-label ${rows[index].month === selectedMonth ? "is-selected" : ""}" x="${group.center}" y="235" text-anchor="middle">${safe(monthLabel(rows[index].month))}</text>`).join("");
  const focus = rows.map((row, index) => {
    const detail = `Tháng ${monthLabel(row.month)}: thu ${reportMoney(row.totalRevenue)}, chi ${reportMoney(row.totalExpenses)}, lợi nhuận ${reportMoney(row.profit)}`;
    return `<rect class="report-focus-target" tabindex="0" x="${profit[index].x - 30}" y="18" width="60" height="198" aria-label="${safe(detail)}" data-chart-detail="${safe(detail)}"><title>${safe(detail)}</title></rect>`;
  }).join("");
  return `${legend([["revenue", "Cột đậm: tiền thu về"], ["expenses", "Cột nhạt: tiền chi ra"], ["profit", "Đường vàng: lợi nhuận"]])}<div class="report-chart-scroll"><svg class="report-graphic report-overview-graphic" viewBox="0 0 740 250" role="img" aria-label="Thu, chi và lợi nhuận theo tháng; số chính xác ở bảng đi kèm">${grid(scale)}${marks}<path class="report-overview-profit-line" d="${linePath(profit)}"/>${profit.map((point) => `<circle class="report-overview-profit-point" cx="${point.x}" cy="${point.y}" r="3.5"/>`).join("")}${focus}</svg></div>${readout()}${hiddenTable("Thu chi lợi nhuận", ["Tháng", "Thực nhận", "Chi phí", "Lợi nhuận"], rows.map((row) => [monthLabel(row.month), reportMoney(row.totalRevenue), reportMoney(row.totalExpenses), reportMoney(row.profit)]))}`;
}

export function typeChart(rows, metric, kind = "horizontal") {
  const label = metric === "revenue" ? revenueLabel : expenseLabel;
  const shown = groupTypes(rows.filter((row) => Number(row.amount) > 0));
  if (!shown.length) return '<p class="report-empty">Chưa có dữ liệu theo loại trong kỳ.</p>';
  const names = shown.map((row) => row.type === "OTHER" ? "Khác" : label(row.type));
  const shares = sharesToOneDecimal(shown.map((row) => row.amount));
  const exact = shown.map((row, index) => `${names[index]}: ${reportMoney(row.amount)} (${shares[index].toFixed(1).replace(".", ",")}%)`);
  const table = hiddenTable("Cơ cấu theo loại", ["Loại", "Số tiền", "Tỷ trọng"], shown.map((row, index) => [names[index], reportMoney(row.amount), `${shares[index].toFixed(1).replace(".", ",")}%`]));
  if (kind === "pie") {
    const arcs = pieArcLengths(shown.map((row) => row.amount));
    const circles = arcs.map((arc, index) => `<path class="report-pie-slice report-pie-arc--${index % 6}" d="${donutSlicePath(arc.offset / arc.circumference, (arc.offset + arc.length) / arc.circumference)}" tabindex="0" aria-label="${safe(exact[index])}" data-chart-detail="${safe(exact[index])}"><title>${safe(exact[index])}</title></path>`).join("");
    return `${legend([[metric, "Lát tròn: tỷ trọng theo loại"]], "Tổng tỷ trọng: 100,0%")}<div class="report-pie-layout"><svg class="report-pie" viewBox="0 0 200 200" role="img" aria-label="Cơ cấu theo loại; số chính xác ở bảng đi kèm">${circles}</svg><ul>${shown.map((row, index) => `<li><i class="report-pie-key report-pie-arc--${index % 6}"></i>${safe(names[index])}: ${reportMoney(row.amount)} · ${shares[index].toFixed(1).replace(".", ",")}%</li>`).join("")}</ul></div>${readout()}${table}`;
  }
  const scale = moneyScale(shown.map((row) => row.amount));
  if (kind === "column") {
    const bars = groupBars(shown, ["amount"]);
    return `${legend([["revenue", "Cột: số tiền từng loại"]], "Đơn vị: đồng")}<div class="report-chart-scroll"><svg class="report-graphic report-graphic--revenue" viewBox="0 0 740 250" role="img" aria-label="Số tiền theo loại; số chính xác ở bảng đi kèm">${grid(scale)}${bars.map((group, index) => `<rect class="report-series-mark" x="${group.bars[0].x}" y="${scale.y(shown[index].amount)}" width="${group.bars[0].width}" height="${Math.max(1, scale.zero - scale.y(shown[index].amount))}" tabindex="0" aria-label="${safe(exact[index])}" data-chart-detail="${safe(exact[index])}"><title>${safe(exact[index])}</title></rect><text class="report-value-label" x="${group.center}" y="${Math.max(15, scale.y(shown[index].amount) - 5)}" text-anchor="middle">${shortMoney(shown[index].amount)}</text><text class="report-x-label" x="${group.center}" y="235" text-anchor="middle">${safe(names[index])}</text>`).join("")}</svg></div>${readout()}${table}`;
  }
  const max = Math.max(...shown.map((row) => Number(row.amount)));
  return `${legend([[metric, "Thanh ngang: số tiền theo loại"]], "Đơn vị: đồng")}<div class="report-type-bars">${shown.map((row, index) => `<div class="report-type-bar" tabindex="0" data-chart-detail="${safe(exact[index])}" aria-label="${safe(exact[index])}"><span>${safe(names[index])}</span><span class="report-type-track"><i style="width:${max ? Math.max(1, Number(row.amount) / max * 100) : 0}%"></i></span><strong>${reportMoney(row.amount)}</strong><small>${shares[index].toFixed(1).replace(".", ",")}%</small></div>`).join("")}</div>${readout()}${table}`;
}

export function profitBridgeChart(data, kind = "bar") {
  const revenue = Number(data.totalRevenue);
  const expenses = Number(data.totalExpenses);
  const profit = Number(data.profit);
  const rows = [{ month: "Thu", value: revenue }, { month: "Chi", value: expenses }, { month: "Lãi", value: profit }];
  const labels = ["Thực nhận", "Chi phí", profit < 0 ? "Lỗ" : "Lợi nhuận"];
  const details = [reportMoney(revenue), reportMoney(expenses), reportMoney(profit)];
  const table = hiddenTable("Từ thu đến lãi", ["Chỉ tiêu", "Số tiền"], labels.map((label, index) => [label, details[index]]));
  if (kind === "pie") {
    if (profit < 0 || revenue <= 0) return '<p class="report-empty">Biểu đồ tròn chỉ dùng khi lợi nhuận không âm và thực nhận lớn hơn 0.</p>';
    const arcs = pieArcLengths([expenses, profit]);
    return `${legend([["expenses", "Lát xanh: chi phí"], ["profit-bar", "Lát vàng: lợi nhuận"]])}<div class="report-pie-layout"><svg class="report-pie" viewBox="0 0 200 200" role="img" aria-label="Chi phí và lợi nhuận từ thực nhận; số chính xác ở bảng đi kèm">${arcs.map((arc, index) => `<path class="report-pie-slice ${index ? "report-pie-profit" : "report-pie-arc--1"}" d="${donutSlicePath(arc.offset / arc.circumference, (arc.offset + arc.length) / arc.circumference)}" tabindex="0" aria-label="${labels[index + 1]}: ${details[index + 1]}" data-chart-detail="${labels[index + 1]}: ${details[index + 1]}"/>`).join("")}</svg><ul><li>Chi phí: ${details[1]}</li><li>Lợi nhuận: ${details[2]}</li></ul></div>${readout()}${table}`;
  }
  const scale = moneyScale([revenue, expenses, profit]);
  const points = linePoints(rows.map((row) => ({ value: row.value })), "value", scale);
  const bars = groupBars(rows, ["value"], { barWidth: 48 });
  const graphic = kind === "step" ? `<path class="report-bridge-step" d="${stepPath([points[0], { x: points[1].x, y: points[2].y }, points[2]])}"/>${points.map((point, index) => `<circle class="${index === 2 ? "report-overview-profit-point" : "report-bridge-point"}" cx="${point.x}" cy="${index === 1 ? points[2].y : point.y}" r="3.5"/>`).join("")}` : bars.map((group, index) => `<rect class="${index === 2 ? "report-bridge-profit" : index === 1 ? "report-overview-expenses" : "report-overview-revenue"}" x="${group.bars[0].x}" y="${Math.min(scale.zero, scale.y(group.bars[0].value))}" width="48" height="${Math.max(1, Math.abs(scale.zero - scale.y(group.bars[0].value)))}"/>`).join("");
  return `${legend([["revenue", "Thực nhận"], ["expenses", "Chi phí"], [kind === "step" ? "profit" : "profit-bar", "Lợi nhuận"]], kind === "step" ? "Bậc thang: từ thực nhận đến lợi nhuận" : "Đơn vị: đồng")}<div class="report-chart-scroll"><svg class="report-graphic" viewBox="0 0 740 250" role="img" aria-label="Từ thu đến lãi; số chính xác ở bảng đi kèm">${grid(scale)}${graphic}${points.map((point, index) => `<text class="report-value-label" x="${point.x}" y="${Math.max(15, Math.min(scale.zero, point.y) - 8)}" text-anchor="middle">${shortMoney(rows[index].value)}</text><text class="report-x-label" x="${point.x}" y="235" text-anchor="middle">${labels[index]}</text><rect class="report-focus-target" tabindex="0" x="${point.x - 30}" y="18" width="60" height="198" aria-label="${labels[index]}: ${details[index]}" data-chart-detail="${labels[index]}: ${details[index]}"/>`).join("")}</svg></div>${readout()}${table}`;
}

export function buildingComparisonChart(rows, buildingNames) {
  if (!rows.length) return '<p class="report-empty">Chưa có căn để so sánh.</p>';
  const positiveMax = Math.max(1, ...rows.flatMap((row) => [Number(row.revenue) || 0, Number(row.expenses) || 0, Number(row.profit) || 0]));
  const negativeMax = Math.max(0, ...rows.map((row) => -(Number(row.profit) || 0)));
  const baseline = negativeMax ? 170 : 205;
  const positiveHeight = baseline - 24;
  const negativeHeight = 48;
  const width = Math.max(740, rows.length * 156 + 90);
  const chartRows = rows.map((row, index) => {
    const name = buildingNames.get(row.buildingId) || "Căn không rõ tên";
    const detail = `${name}: thực nhận ${reportMoney(row.revenue)}, chi phí ${reportMoney(row.expenses)}, lợi nhuận ${reportMoney(row.profit)}`;
    const x = 75 + index * (width - 120) / rows.length;
    const columns = [[row.revenue, "revenue"], [row.expenses, "expenses"], [row.profit, Number(row.profit) < 0 ? "loss" : "profit"]];
    return `<g><title>${safe(detail)}</title>${columns.map(([raw, type], position) => {
      const amount = Number(raw) || 0;
      const height = amount < 0 ? Math.abs(amount) / negativeMax * negativeHeight : amount / positiveMax * positiveHeight;
      return `<rect class="report-compare-column report-compare-column--${type}" x="${x + position * 27}" y="${amount < 0 ? baseline : baseline - height}" width="22" height="${height}"/>`;
    }).join("")}<rect class="report-focus-target" tabindex="0" x="${x - 4}" y="20" width="84" height="${baseline + negativeHeight - 20}" aria-label="${safe(detail)}" data-chart-detail="${safe(detail)}"/><text class="report-compare-axis-label" x="${x + 38}" y="${baseline + (negativeMax ? negativeHeight : 0) + 22}" text-anchor="middle">${safe(name)}</text></g>`;
  }).join("");
  return `${legend([["revenue", "Thực nhận"], ["expenses", "Chi phí"], ["profit-bar", "Lợi nhuận"], ["loss", "Lỗ"]], "Cùng một thang tiền; số chính xác ở bảng bên dưới.")}
    <div class="report-chart-scroll"><svg class="report-compare-columns" viewBox="0 0 ${width} ${negativeMax ? 270 : 255}" role="img" aria-label="Biểu đồ cột so sánh thực nhận, chi phí và lợi nhuận các căn"><line class="report-grid-line" x1="62" x2="${width - 20}" y1="24" y2="24"/><text x="2" y="28">${shortMoney(positiveMax)}</text><line class="report-zero-line" x1="62" x2="${width - 20}" y1="${baseline}" y2="${baseline}"/><text x="22" y="${baseline + 4}">0 đ</text>${chartRows}</svg></div>${readout()}`;
}
