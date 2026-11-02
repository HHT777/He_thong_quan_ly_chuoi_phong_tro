const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};

function fingerprintOf(value) {
  const input = stable(value);
  let left = 2166136261;
  let right = 2246822519;
  for (let index = 0; index < input.length; index += 1) {
    left = Math.imul(left ^ input.charCodeAt(index), 16777619);
    right = Math.imul(right ^ input.charCodeAt(index), 3266489917);
  }
  return `${(left >>> 0).toString(16)}:${(right >>> 0).toString(16)}:${input.length}`;
}

export function createRequestKeyStore(factory = () => crypto.randomUUID(), storage = globalThis.sessionStorage) {
  const entries = new Map();
  const storageKey = "qlpt:idempotency:v1";
  const maxAgeMs = 60 * 60 * 1000;
  const maxEntries = 40;
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || "[]");
    if (Array.isArray(saved)) for (const [scope, value] of saved) {
      if (value && Date.now() - value.createdAt < maxAgeMs) entries.set(scope, value);
    }
  } catch (_) { /* Storage may be unavailable or stale. */ }
  const persist = () => {
    for (const [scope, value] of entries) if (Date.now() - value.createdAt >= maxAgeMs) entries.delete(scope);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    try { storage?.setItem(storageKey, JSON.stringify([...entries])); } catch (_) { /* Retry still works in memory. */ }
  };
  persist();
  return {
    keyFor(scope, payload) {
      const fingerprint = fingerprintOf(payload);
      const current = entries.get(scope);
      if (current?.fingerprint === fingerprint) return current.key;
      const key = factory();
      entries.set(scope, { fingerprint, key, createdAt: Date.now() });
      persist();
      return key;
    },
    complete(scope) { entries.delete(scope); persist(); },
    renew(scope) { entries.delete(scope); persist(); },
  };
}

export function integerVnd(value, label, { positive = false, signed = false } = {}) {
  const text = String(value ?? "").trim();
  const pattern = signed ? /^-?\d+$/ : /^\d+$/;
  if (!pattern.test(text)) throw new Error(`${label} phải là số nguyên${signed ? "" : " không âm"}.`);
  const result = Number(text);
  if (!Number.isSafeInteger(result)) throw new Error(`${label} vượt phạm vi số nguyên an toàn.`);
  if (signed && result === 0) throw new Error(`${label} phải khác 0.`);
  if (positive && result <= 0) throw new Error(`${label} phải lớn hơn 0.`);
  return result;
}

export function requiredText(value, label) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} là bắt buộc.`);
  return result;
}
