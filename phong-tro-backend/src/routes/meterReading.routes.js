const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { pipeline } = require("node:stream");
const { getUploadContext } = require("../config/uploadFilesystem");
const authMiddleware = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const controller = require("../controllers/meterReading.controller");
const { getPersistedSystemConfig } = require("../services/systemConfig.service");
const { assertLandlordOwnsRoom } = require("../services/propertyAccess.service");

const upload = multer({
  storage: {
    _handleFile(req, file, callback) {
      try {
        const context = req.uploadContext;
        context.mkdir(context.resolve("meter"));
        const filename = crypto.randomBytes(16).toString("hex");
        const target = context.resolve("meter", filename);
        const output = context.createWriteStream(target);
        let size = 0;
        file.stream.on("data", (chunk) => { size += chunk.length; });
        pipeline(file.stream, output, (error) => {
          if (error) {
            try { context.unlink(target); } catch (cleanupError) { if (cleanupError.code !== "ENOENT") return callback(cleanupError); }
            return callback(error);
          }
          callback(null, { destination: context.resolve("meter"), filename, path: target, size });
        });
      } catch (error) { callback(error); }
    },
    _removeFile(req, file, callback) {
      try { req.uploadContext.unlink(file.path); callback(null); } catch (error) { callback(error); }
    },
  },
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
const ownerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => ["image/jpeg", "image/png"].includes(file.mimetype)
    ? cb(null, true) : cb(Object.assign(new Error("Chỉ chấp nhận ảnh JPEG hoặc PNG."), { code: "UNSUPPORTED_MEDIA_TYPE", status: 415 })) });
async function storeOwnedPreview(req, res, next) {
  try {
    await assertLandlordOwnsRoom(req.user, req.body.roomId);
    if (!req.file) return next();
    const config = await getPersistedSystemConfig();
    if (req.file.size > config.maxFileSizeBytes) return res.apiError(413, "FILE_TOO_LARGE", "Ảnh vượt quá giới hạn cho phép.");
    const context = req.uploadContext;
    const filename = crypto.randomBytes(16).toString("hex");
    const uploadDir = context.resolve("meter");
    context.mkdir(uploadDir);
    const filePath = context.resolve("meter", filename);
    context.writeFile(filePath, req.file.buffer);
    Object.assign(req.file, { path: filePath, filename, destination: uploadDir });
    delete req.file.buffer;
    next();
  } catch (error) { next(error); }
}
const replacementUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => ["image/jpeg", "image/png"].includes(file.mimetype)
    ? cb(null, true) : cb(Object.assign(new Error("Chỉ chấp nhận ảnh JPEG hoặc PNG."), { code: "UNSUPPORTED_MEDIA_TYPE", status: 415 })) });

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
    const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
    if (!files.length) return next();
    const config = await getPersistedSystemConfig();
    if (files.every((file) => file.size <= config.maxFileSizeBytes)) return next();
    for (const file of files.filter((item) => item.path)) {
      try { req.uploadContext.unlink(file.path); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    return res.apiError(413, "FILE_TOO_LARGE", "Ảnh vượt quá giới hạn cho phép.");
  } catch (error) { return next(error); }
}

const router = express.Router();
router.use(authMiddleware);
router.use((req, res, next) => {
  try { req.uploadContext = getUploadContext(); next(); } catch (error) { next(error); }
});
router.get("/me/meter-reading-context", authorize("KHACH_THUE"), controller.context.bind(controller));
router.post("/me/meter-reading-ocr-previews", authorize("KHACH_THUE"), upload.single("file"), uploadErrorHandler, configuredFileLimit, controller.preview.bind(controller));
router.post("/meter-readings/ocr-previews", authorize("dienNuoc.write"), ownerUpload.single("file"), uploadErrorHandler, storeOwnedPreview, controller.landlordPreview.bind(controller));
router.post("/me/meter-readings", authorize("KHACH_THUE"), controller.submit.bind(controller));
router.post("/meter-readings/ocr-submit", authorize("dienNuoc.write"), controller.landlordSubmit.bind(controller));
router.post("/meter-replacements", authorize("dienNuoc.write"), replacementUpload.fields([{ name: "oldImage", maxCount: 1 }, { name: "newImage", maxCount: 1 }]), uploadErrorHandler, configuredFileLimit, controller.createReplacement.bind(controller));
router.get("/meter-replacements", authorize("dienNuoc.read"), controller.listReplacements.bind(controller));
router.get("/meter-replacements/:id/images/:kind", authorize("dienNuoc.read"), controller.replacementImage.bind(controller));
router.get("/meter-readings", authorize("dienNuoc.read"), controller.list.bind(controller));
router.get("/meter-readings/:readingId", authorize("dienNuoc.read"), controller.detail.bind(controller));
router.patch("/meter-readings/:readingId", authorize("dienNuoc.write"), controller.update.bind(controller));
router.delete("/meter-readings/:readingId", authorize("dienNuoc.write"), controller.remove.bind(controller));
router.post("/meter-readings/:readingId/confirmations", authorize("dienNuoc.write"), controller.confirm.bind(controller));
router.post("/meter-readings/:readingId/correction-requests", authorize("dienNuoc.write"), controller.correction.bind(controller));
router.post("/meter-readings/manual", authorize("dienNuoc.write"), controller.manual.bind(controller));
router.get("/private-files/:id", controller.privateFile.bind(controller));
module.exports = router;
