// Generate a deterministic workbook for verification by an independent tool.
const { writeWorkbook } = require("../../src/utils/xlsxWriter.util");

const bytes = writeWorkbook([
  { name: "Tong quan", rows: [["Giá trị", 125000], ["=FORMULA", -500]] },
  { name: "Theo loai", rows: [["Loại", "Số tiền"], ["THU_TIEN", 125000]] },
  { name: "Theo can", rows: [["Căn", "Số tiền"], ["A", 125000]] },
  { name: "Thu", rows: [["Căn", "Số tiền"], ["A", 125000]] },
  { name: "Chi", rows: [["Căn", "Số tiền"], ["A", 500]] },
]);
process.stdout.write(bytes.toString("base64"));
