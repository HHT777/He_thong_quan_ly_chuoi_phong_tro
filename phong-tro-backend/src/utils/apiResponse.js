const crypto = require("crypto");

function correlationId(req) {
  if (!req.correlationId) {
    req.correlationId = req.headers["x-request-id"] || crypto.randomUUID();
  }
  return req.correlationId;
}

function installApiResponse(req, res, next) {
  res.apiSuccess = (data, meta = null, status = 200) =>
    res.status(status).json({
      success: true,
      data,
      meta,
      correlationId: correlationId(req),
    });
  res.apiError = (status, code, message, details = null) =>
    res.status(status).json({
      success: false,
      error: { code, message, details },
      correlationId: correlationId(req),
    });
  next();
}

module.exports = { correlationId, installApiResponse };
