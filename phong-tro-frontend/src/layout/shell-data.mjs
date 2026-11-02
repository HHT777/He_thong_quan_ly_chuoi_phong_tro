export function hasUnreadNotifications(rows) {
  if (!Array.isArray(rows)) return false;
  return rows.some((item) => item?.da_doc === false || item?.da_doc === 0);
}
