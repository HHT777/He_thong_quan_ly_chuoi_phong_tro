import { findTab } from "./module-registry.js";

const clean = (value) => `/${String(value || "").replace(/^#?\/?/, "").replace(/^\/+/, "")}`.replace(/\/$/, "") || "/";
export const currentRoute = () => clean(window.location.hash.slice(1).split("?")[0]);
export const go = (route) => { window.location.hash = `#${clean(route)}`; };

export function defaultRoute(currentUser) {
  return currentUser?.vai_tro === "KHACH_THUE" ? "/tenant/rental-info" : "/overview/dashboard";
}

export async function renderRoute(context) {
  const route = currentRoute();
  if (route === "/finance/adjustments" && context.user?.vai_tro === "CHU_TRO") { go("/finance/bills"); return; }
  const target = routeAllowed(route, context.user) ? route : defaultRoute(context.user);
  if (target !== route) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${target}`);
  const tab = findTab(target, context.user);
  if (!tab) return;
  context.setActive(tab);
  await tab.render(context);
}

export function routeAllowed(route, currentUser) {
  return Boolean(findTab(clean(route), currentUser));
}
