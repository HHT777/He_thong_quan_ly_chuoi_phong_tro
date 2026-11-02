export function captureDraft(root, route, accountId) {
  const forms = [...root.querySelectorAll("#module-root form")].map((form) =>
    [...form.querySelectorAll("[name]")]
      .filter((field) => !["password", "file", "hidden"].includes(field.type))
      .map((field) => ({ name: field.name, value: field.value, checked: field.checked, type: field.type })),
  );
  return forms.length ? { route, accountId, forms } : null;
}

export function draftForUser(draft, accountId) {
  return draft && String(draft.accountId) === String(accountId) ? draft : null;
}

export function restoreDraft(root, draft) {
  const forms = [...root.querySelectorAll("#module-root form")];
  forms.forEach((form, index) => {
    const fields = [...form.querySelectorAll("[name]")];
    const restored = new Set();
    for (const saved of draft.forms[index] || []) {
      const field = fields.find((item) => !restored.has(item) && item.name === saved.name && item.type === saved.type
        && (!["checkbox", "radio"].includes(saved.type) || item.value === saved.value));
      if (!field) continue;
      restored.add(field);
      if (saved.type === "checkbox" || saved.type === "radio") field.checked = saved.checked;
      else field.value = saved.value;
    }
  });
}
