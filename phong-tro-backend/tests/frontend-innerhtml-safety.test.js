const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const modulesRoot = path.resolve(__dirname, "../../phong-tro-frontend/src/modules");
const reviewedModules = [
  "finance/bills-v2.js", "finance/debts.tab.js", "finance/reports.tab.js",
  "operations/meter-readings.tab.js", "operations/move-outs.tab.js", "overview/dashboard.tab.js", "overview/dashboard.view.mjs",
  "residents-contracts/contracts.tab.js", "residents-contracts/co-tenants.tab.js",
  "residents-contracts/requests.tab.js", "residents-contracts/reservations.tab.js",
  "settings/system-config.tab.js",
];

// Approved HTML-producing helpers. Their implementations escape untrusted text before returning markup.
const safeMarkup = new Map([
  ["shellPage(", "Static application shell"], ["reportBody(", "Report renderer escapes data fields"],
  ["filterMarkup(", "Report filter escapes building names and IDs; period comes from Vietnam business date"],
  ["loadingMarkup(", "Static report loading skeleton"],
  ["icons.download(", "Static SVG icon from shared icon library"],
  ["contextMarkup(", "Move-out renderer escapes data fields"], ["resultMarkup(", "Move-out renderer escapes data fields"],
  ["groupedPeriodicMarkup(", "Debt renderer escapes data fields"],
]);

function scan(source, file) {
  const violations = []; const exceptions = [];
  const lines = source.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!/\.innerHTML\s*=/.test(line)) continue;
    // Scan the whole assignment, including multiline templates, until the terminating semicolon.
    let chunk = line.slice(line.search(/\.innerHTML\s*=/));
    let next = lineIndex;
    while (!/;\s*(?:\}|$)/.test(chunk.split(/\r?\n/).at(-1)) && next + 1 < lines.length) {
      next += 1; chunk += `\n${lines[next]}`;
    }
    if (next === lineIndex && !chunk.includes("style=")) chunk = chunk.slice(0, chunk.indexOf(";") + 1);
    const rawExpressions = [...chunk.matchAll(/\$\{([^{}]*)\}/g)];
    for (const match of rawExpressions) {
      const expression = match[1].trim();
      const offsetLine = chunk.slice(0, match.index).split("\n").length - 1;
      const at = `${file}:${lineIndex + offsetLine + 1}`;
      const prefix = chunk.slice(0, match.index);
      if (/(?:escapeHtml|money|date)\([^)]*$/.test(prefix)) continue;
      if (/^escapeHtml\s*\(/.test(expression)) continue;
      if (/^(?:money|date)\s*\(/.test(expression)) { exceptions.push({ at, reason: "Formatted numeric amount or date" }); continue; }
      if (/\b(?:userInput|raw|name|description|innerText|html)\b/.test(expression)) {
        violations.push(`${at}: ${expression}`); continue;
      }
      const helper = [...safeMarkup.keys()].find((name) => expression.startsWith(name));
      if (helper) { exceptions.push({ at, reason: safeMarkup.get(helper) }); continue; }
      if (/^(?:index|i|Number\(|String\(|\d+\b)/.test(expression)) { exceptions.push({ at, reason: "Index or explicitly numeric/static value" }); continue; }
      if (/^(?:kpi|panel)\(\s*"[^"]*"(?:\s*,\s*"[^"]*")*\s*\)$/.test(expression)) {
        exceptions.push({ at, reason: "Dashboard component called only with static string literals" }); continue;
      }
      // Remaining expressions are reviewed per line below; adding a new expression must fail closed.
      const approved = reviewedExceptions.get(`${file}:${lineIndex + offsetLine + 1}`);
      if (!approved) violations.push(`${at}: ${expression}`);
      else exceptions.push({ at, reason: approved });
    }
    lineIndex = next;
  }
  return { violations, exceptions };
}

// Every approved line is constrained to a reviewed static or numeric expression.
const reviewedExceptions = new Map([
  ["finance/bills-v2.js:32", "Dialog body is built by reviewed templates that escape data fields"],
  ["finance/bills-v2.js:69", "Period options escape period values and labels"],
  ["finance/bills-v2.js:125", "Bill rows escape names and use formatted numbers"],
  ["finance/bills-v2.js:130", "Pagination values are numbers or static attributes"],
  ["finance/bills-v2.js:172", "Eligibility conditions select static attributes; amounts are formatted and reasons escaped"],
  ["finance/bills-v2.js:200", "Schedule switch inserts only a static checked attribute"],
  ["finance/bills-v2.js:201", "Building options escape building names and IDs"],
  ["finance/bills-v2.js:206", "Run outcomes escape room names and reasons"],
  ["finance/bills-v2.js:252", "Recipient conditions select static classes and labels; names are escaped and amounts formatted"],
  ["finance/bills-v2.js:298", "Adjustment toggle selects only static Vietnamese labels"],
  ["finance/debts.tab.js:92", "today() returns a fixed YYYY-MM-DD string"],
  ["residents-contracts/co-tenants.tab.js:45", "Conditional emits a static disabled attribute"],
  ["residents-contracts/reservations.tab.js:29", "Conditional emits a static overdue badge"],
]);

test("FR-159 all Group 1-3 innerHTML interpolations are escaped or reviewed", () => {
  const violations = []; const exceptions = [];
  let assignmentLines = 0;
  for (const file of reviewedModules) {
    const source = fs.readFileSync(path.join(modulesRoot, file), "utf8");
    assignmentLines += source.split(/\r?\n/).filter((line) => /\.innerHTML\s*=/.test(line)).length;
    const result = scan(source, file);
    violations.push(...result.violations); exceptions.push(...result.exceptions);
  }
  assert.deepEqual(violations, [], `Unsafe interpolations:\n${violations.join("\n")}`);
  assert.ok(exceptions.length > 0);
  console.log(`innerHTML audit: ${assignmentLines} assignments, ${exceptions.length} reviewed expressions, ${violations.length} violations`);
});

test("FR-159 scanner rejects an injected raw interpolation in a copy", () => {
  const source = fs.readFileSync(path.join(modulesRoot, reviewedModules[0]), "utf8");
  const copy = `${source}\ncontent.innerHTML = \`<p>\${userInput}</p>\`;\n`;
  assert.ok(scan(copy, reviewedModules[0]).violations.some((item) => item.includes("userInput")));
});
