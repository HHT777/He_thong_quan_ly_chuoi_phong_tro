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

module.exports = { readXlsxEntries };
