const zlib = require("node:zlib");

const MAX_ROWS = 10000;
const MAX_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;
const MAX_XLSX_BYTES = 8 * 1024 * 1024;

function escapeXml(value) {
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] || "\ufffd");
}

function safeText(value) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
}

function columnName(index) {
  let result = "";
  for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) {
    result = String.fromCharCode(65 + (number - 1) % 26) + result;
  }
  return result;
}

function cell(value, row, column) {
  const reference = `${columnName(column)}${row}`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Excel numeric cell must be finite");
    return `<c r="${reference}"><v>${value}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(safeText(value))}</t></is></c>`;
}

function sheetXml(rows) {
  if (rows.length > MAX_ROWS) throw Object.assign(new Error("Báo cáo vượt giới hạn dòng"), { status: 413, code: "REPORT_EXPORT_TOO_LARGE" });
  const body = rows.map((values, index) => `<row r="${index + 1}">${values.map((value, column) => cell(value, index + 1, column)).join("")}</row>`).join("");
  const width = Math.max(1, ...rows.map((values) => values.length));
  const lastCell = `${columnName(width - 1)}${Math.max(1, rows.length)}`;
  const columns = Array.from({ length: width }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="18" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${columns}</cols><sheetData>${body}</sheetData></worksheet>`;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let result = index;
  for (let bit = 0; bit < 8; bit += 1) result = result & 1 ? (result >>> 1) ^ 0xedb88320 : result >>> 1;
  return result >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  let originalBytes = 0;
  for (const [name, content] of files) {
    const filename = Buffer.from(name);
    const plain = Buffer.from(content);
    originalBytes += plain.length;
    if (originalBytes > MAX_UNCOMPRESSED_BYTES) throw Object.assign(new Error("Báo cáo vượt giới hạn dung lượng"), { status: 413, code: "REPORT_EXPORT_TOO_LARGE" });
    const compressed = zlib.deflateRawSync(plain);
    const checksum = crc32(plain);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(plain.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, compressed);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8); header.writeUInt16LE(8, 10); header.writeUInt16LE(0x21, 14); header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(compressed.length, 20); header.writeUInt32LE(plain.length, 24);
    header.writeUInt16LE(filename.length, 28); header.writeUInt32LE(offset, 42);
    central.push(header, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50, 0); footer.writeUInt16LE(files.length, 8);
  footer.writeUInt16LE(files.length, 10); footer.writeUInt32LE(centralSize, 12); footer.writeUInt32LE(offset, 16);
  const result = Buffer.concat([...locals, ...central, footer]);
  if (result.length > MAX_XLSX_BYTES) throw Object.assign(new Error("Báo cáo vượt giới hạn dung lượng"), { status: 413, code: "REPORT_EXPORT_TOO_LARGE" });
  return result;
}

function writeWorkbook(sheets) {
  if (!Array.isArray(sheets) || sheets.length < 1 || sheets.length > 5) throw new Error("Cashflow workbook requires one to five sheets");
  const names = sheets.map((sheet) => sheet.name);
  if (names.some((name) => typeof name !== "string" || name.length < 1 || name.length > 31 || /[\[\]:*?/\\]/.test(name))
    || new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
    throw new Error("Invalid or duplicate Excel sheet name");
  }
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`],
    ...sheets.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet.rows)]),
  ];
  return zip(files);
}

module.exports = { writeWorkbook, safeText, MAX_ROWS, MAX_UNCOMPRESSED_BYTES, MAX_XLSX_BYTES };
