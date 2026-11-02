// Test-only ZIP reader: validates the minimal writer without an Excel dependency.
const zlib = require("node:zlib");

function readXlsxEntries(bytes) {
  const entries = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8);
    const length = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    const compressed = bytes.subarray(start, start + length);
    entries.set(name, (method === 8 ? zlib.inflateRawSync(compressed) : compressed).toString());
    offset = start + length;
  }
  return entries;
}

function decodeXml(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => ({
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
  })[entity]);
}

function readXlsxWorkbook(bytes) {
  const entries = readXlsxEntries(bytes);
  const workbook = entries.get("xl/workbook.xml") || "";
  const sheets = [...workbook.matchAll(/<sheet name="([^"]+)"[^>]*\/>/g)];
  const result = {};
  sheets.forEach((sheet, index) => {
    const xml = entries.get(`xl/worksheets/sheet${index + 1}.xml`) || "";
    result[decodeXml(sheet[1])] = [...xml.matchAll(/<row r="\d+">([\s\S]*?)<\/row>/g)].map((row) =>
      [...row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map((cell) => {
        const value = cell[2].match(/<(?:v|t)(?:\s[^>]*)?>([\s\S]*?)<\/(?:v|t)>/);
        const decoded = decodeXml(value?.[1] || "");
        return /\bt="inlineStr"/.test(cell[1]) ? decoded : Number(decoded);
      }));
  });
  return result;
}

module.exports = { readXlsxEntries, readXlsxWorkbook };
