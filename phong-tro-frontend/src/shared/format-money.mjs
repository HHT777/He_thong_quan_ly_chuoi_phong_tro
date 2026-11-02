export function wholeVnd(value) {
  const amount = Number(value || 0);
  const rounded = Math.round(Math.abs(amount));
  return `${amount < 0 && rounded ? "-" : ""}${rounded.toLocaleString("vi-VN")}`;
}
