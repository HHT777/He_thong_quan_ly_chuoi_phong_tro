const { randomUUID } = require("node:crypto");

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  if (err?.isJoi) {
    return res.status(400).json({
      success: false,
      message: "Lỗi validation",
      details: err.details?.map((detail) => ({ field: detail.path.join("."), message: detail.message })),
    });
  }
  const isDatabaseError = /^Sequelize|^DatabaseError$/.test(err?.name || "") || Boolean(err?.parent?.sql || err?.sql);
  const isExpected = !isDatabaseError && Number.isInteger(err?.status) && err.status >= 400 && err.status < 500;
  if (!isExpected) {
    const referenceId = randomUUID();
    console.error(`[INTERNAL_ERROR ${referenceId}]`, err);
    if (typeof res.apiError === "function" && req.path.startsWith("/api/v1/")) {
      return res.apiError(500, "INTERNAL_ERROR", "Lỗi máy chủ nội bộ", { referenceId });
    }
    return res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: "Lỗi máy chủ nội bộ", referenceId });
  }

  if (typeof res.apiError === "function" && req.path.startsWith("/api/v1/")) {
    return res.apiError(
      err.status || 500,
      err.code || "INTERNAL_ERROR",
      err.message || "Lỗi máy chủ nội bộ",
      err.details || null,
    );
  }

  res.status(err.status).json({
    success: false,
    ...(err.code && { code: err.code }),
    message: err.message || "Lỗi máy chủ nội bộ",
  });
};

module.exports = errorHandler;
