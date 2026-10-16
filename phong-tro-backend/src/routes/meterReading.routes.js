const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const controller = require("../controllers/meterReading.controller");
const { getPersistedSystemConfig } = require("../services/systemConfig.service");

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads", "meter");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  // Multer keeps a fixed emergency ceiling; the editable DB limit is enforced
  // by the next middleware so configuration changes do not require a restart.
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png"].includes(file.mimetype)) return cb(null, true);
    const error = new Error("Chỉ chấp nhận ảnh JPEG hoặc PNG.");
    error.code = "UNSUPPORTED_MEDIA_TYPE";
    error.status = 415;
    return cb(error);
  },
});

function uploadErrorHandler(error, req, res, next) {
  if (!error) return next();
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.apiError(413, "FILE_TOO_LARGE", "Ảnh vượt quá giới hạn cho phép.");
  }
  if (error.code === "UNSUPPORTED_MEDIA_TYPE" || error instanceof multer.MulterError || error.message === "Unexpected field") {
    return res.apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Chỉ chấp nhận ảnh JPEG hoặc PNG.");
  }
  return next(error);
}

async function configuredFileLimit(req, res, next) {
  try {
    if (!req.file) return next();
    const config = await getPersistedSystemConfig();
    if (req.file.size <= config.maxFileSizeBytes) return next();
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.apiError(413, "FILE_TOO_LARGE", "Ảnh vượt quá giới hạn cho phép.");
  } catch (error) { return next(error); }
}

const router = express.Router();
router.use(authMiddleware);
router.get("/me/meter-reading-context", authorize("dienNuoc.read"), controller.context.bind(controller));
router.post("/me/meter-reading-ocr-previews", authorize("dienNuoc.write"), upload.single("file"), uploadErrorHandler, configuredFileLimit, controller.preview.bind(controller));
router.post("/me/meter-readings", authorize("dienNuoc.write"), controller.submit.bind(controller));
router.get("/meter-readings", authorize("dienNuoc.read"), controller.list.bind(controller));
router.get("/meter-readings/:readingId", authorize("dienNuoc.read"), controller.detail.bind(controller));
router.patch("/meter-readings/:readingId", authorize("dienNuoc.write"), controller.update.bind(controller));
router.delete("/meter-readings/:readingId", authorize("dienNuoc.write"), controller.remove.bind(controller));
router.post("/meter-readings/:readingId/confirmations", authorize("dienNuoc.write"), controller.confirm.bind(controller));
router.post("/meter-readings/:readingId/correction-requests", authorize("dienNuoc.write"), controller.correction.bind(controller));
router.post("/meter-readings/manual", authorize("dienNuoc.write"), controller.manual.bind(controller));
router.get("/private-files/:id", controller.privateFile.bind(controller));
module.exports = router;
