const AuditLog = require("../models/AuditLog");

const fail = (message, code) => Object.assign(new Error(message), {
  status: 422,
  code,
});

function toJsonValue(value) {
  if (value === undefined || value === null) return value ?? null;
  const plain = typeof value.get === "function" ? value.get({ plain: true }) : value;
  const scrub = (item) => {
    if (Array.isArray(item)) return item.map(scrub);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(Object.entries(item)
      .filter(([key]) => !/(?:password|matkhau|hash|token|secret)/i.test(key))
      .map(([key, entry]) => [key, scrub(entry)]));
  };
  return scrub(JSON.parse(JSON.stringify(plain)));
}

function requiredString(value, field, maxLength) {
  const normalized = String(value || "").trim();
  if (!normalized) throw fail(`${field} là bắt buộc`, "INVALID_AUDIT_LOG");
  if (normalized.length > maxLength) throw fail(`${field} vượt quá ${maxLength} ký tự`, "INVALID_AUDIT_LOG");
  return normalized;
}

function buildAuditPayload({ actorId, action, entityType, entityId, before, after, reason, correlationId }) {
  if (actorId === undefined || actorId === null || String(actorId).trim() === "") {
    throw fail("actorId là bắt buộc", "INVALID_AUDIT_LOG");
  }
  return {
    actor_id: actorId,
    action: requiredString(action, "action", 100),
    entity_type: requiredString(entityType, "entityType", 100),
    entity_id: requiredString(entityId, "entityId", 100),
    before_json: toJsonValue(before),
    after_json: toJsonValue(after),
    reason: reason === undefined || reason === null ? null : String(reason).trim() || null,
    correlation_id: correlationId === undefined || correlationId === null
      ? null
      : requiredString(correlationId, "correlationId", 100),
  };
}

async function writeAuditLog(input) {
  if (!input?.transaction) {
    throw fail("AuditLog phải được ghi trong transaction", "AUDIT_TRANSACTION_REQUIRED");
  }
  return AuditLog.create(buildAuditPayload(input), { transaction: input.transaction });
}

module.exports = { toJsonValue, buildAuditPayload, writeAuditLog };
