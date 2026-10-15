import { findTab, allowedTabs } from "./module-registry.js";

const clean = (value) => `/${String(value || "").replace(/^#?\/?/, "").replace(/^\/+/, "")}`.replace(/\/$/, "") || "/";
export const currentRoute = () => clean(window.location.hash.slice(1));
export const go = (route) => { window.location.hash = `#${clean(route)}`; };

export function defaultRoute(currentUser) {
  return currentUser?.vai_tro === "KHACH_THUE" ? "/tenant/rental-info" : "/overview/dashboard";
}

export async function renderRoute(context) {
  const route = currentRoute();
  const tab = findTab(route, context.user) || findTab(defaultRoute(context.user), context.user);
  if (!tab) return;
  context.setActive(tab);
  await tab.render(context);
}

export function routeAllowed(route, currentUser) {
  return Boolean(findTab(route, currentUser) || allowedTabs(currentUser).length);
}
