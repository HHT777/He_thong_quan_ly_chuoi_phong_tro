import { tabForRoute, tabsForUser } from "./route-policy.mjs";

const discovered = import.meta.glob("../modules/**/*.tab.js", { eager: true });

export const tabs = Object.values(discovered)
  .map((item) => item.default)
  .filter(Boolean)
  .sort((a, b) => (a.order || 0) - (b.order || 0));

export function allowedTabs(currentUser) {
  return tabsForUser(tabs, currentUser);
}

export function findTab(route, currentUser) {
  return tabForRoute(tabs, route, currentUser);
}

export function groupTabs(currentUser) {
  return allowedTabs(currentUser).filter((tab) => !tab.hiddenFromNav).reduce((result, tab) => {
    (result[tab.group] ||= []).push(tab);
    return result;
  }, {});
}
