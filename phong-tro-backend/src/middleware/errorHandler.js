// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  if (typeof res.apiError === "function" && req.path.startsWith("/api/v1/")) {
    return res.apiError(
      err.status || 500,
      err.code || "INTERNAL_ERROR",
      err.message || "Lỗi máy chủ nội bộ",
      err.details || null,
    );
  }

  // Joi validation error
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: "Lỗi validation",
      details: err.details?.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      })),
    });
  }

  // Sequelize error
  if (err.name === "SequelizeError") {
    return res.status(400).json({
      success: false,
      message: "Lỗi cơ sở dữ liệu",
      details: err.message,
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    ...(err.code && { code: err.code }),
    message: err.message || "Lỗi máy chủ nội bộ",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
