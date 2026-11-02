const multer = require("multer");
const fail = (status, code) => Object.assign(new Error("Ảnh không hợp lệ; chỉ nhận JPEG/PNG trong giới hạn cho phép"), { status, code });
// Buffer first: authorization and real-content validation precede every disk write.
const parser = multer({ storage: multer.memoryStorage(), preservePath: true, limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 12, fieldSize: 8000 } }).single("file");
function incidentUpload(req, res, next) {
  if (!req.is("multipart/form-data")) return next();
  if (req.user.vai_tro !== "KHACH_THUE") return next(fail(403, "FORBIDDEN"));
  parser(req, res, (error) => next(error ? fail(error.code === "LIMIT_FILE_SIZE" ? 413 : 400, error.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "INVALID_INCIDENT_UPLOAD") : undefined));
}
module.exports = incidentUpload;
