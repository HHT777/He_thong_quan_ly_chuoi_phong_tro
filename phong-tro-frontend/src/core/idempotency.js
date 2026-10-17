const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};

export function createRequestKeyStore(factory = () => crypto.randomUUID()) {
  const entries = new Map();
  return {
    keyFor(scope, payload) {
      const fingerprint = stable(payload);
      const current = entries.get(scope);
      if (current?.fingerprint === fingerprint) return current.key;
      const key = factory();
      entries.set(scope, { fingerprint, key });
      return key;
    },
    complete(scope) { entries.delete(scope); },
    renew(scope) { entries.delete(scope); },
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
