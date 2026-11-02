export function tabsForUser(tabs, currentUser) {
  if (!currentUser || !["CHU_TRO", "KHACH_THUE"].includes(currentUser.vai_tro)) return [];
  return tabs.filter((tab) => !tab.roles || tab.roles.includes(currentUser.vai_tro));
}

export function tabForRoute(tabs, route, currentUser) {
  return tabsForUser(tabs, currentUser).find((tab) => tab.route === route);
}
