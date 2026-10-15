const discovered = import.meta.glob("../modules/**/*.tab.js", { eager: true });

export const tabs = Object.values(discovered)
  .map((item) => item.default)
  .filter(Boolean)
  .sort((a, b) => (a.order || 0) - (b.order || 0));

export function allowedTabs(currentUser) {
  return tabs.filter((tab) => !tab.roles || tab.roles.includes(currentUser?.vai_tro));
}

export function findTab(route, currentUser) {
  return allowedTabs(currentUser).find((tab) => tab.route === route);
}

export function groupTabs(currentUser) {
  return allowedTabs(currentUser).reduce((result, tab) => {
    (result[tab.group] ||= []).push(tab);
    return result;
  }, {});
}
