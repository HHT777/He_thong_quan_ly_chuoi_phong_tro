function maskDocument(value) {
  if (!value) return null;
  return `****${String(value).replace(/\D/g, "").slice(-4)}`;
}
// Metadata is deliberately allowlisted: Error.message/sql/binds may contain PII.
function safeFailureMetadata(error) {
  return { category: /^Sequelize|DatabaseError/.test(error?.name || "") || error?.sql || error?.parent?.sql ? "database" : "unexpected" };
}
function logPrivateFailure(event) { console.error(event === "CO_TENANT_NOTICE_FAILED" ? "[CO_TENANT_NOTICE_FAILED]" : "[PRIVATE_OPERATION_FAILED]"); }
function logSqlOperation() { console.log("[DB] query executed"); }
module.exports = { maskDocument, safeFailureMetadata, logPrivateFailure, logSqlOperation };
