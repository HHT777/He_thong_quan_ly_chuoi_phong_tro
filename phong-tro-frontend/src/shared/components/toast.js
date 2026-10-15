/**
 * Lightweight Toast notification helper
 */
import { icons } from "./icons.js";

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    toastContainer.setAttribute("aria-live", "polite");
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = "info", duration = 3500) {
  const container = ensureContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;

  const iconHtml = type === "success"
    ? icons.check(18)
    : type === "error"
      ? icons.alertCircle(18)
      : icons.clock(18);

  toast.innerHTML = `
    <span style="display:flex;align-items:center;">${iconHtml}</span>
    <span style="flex:1;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 200ms ease";
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 200);
  }, duration);
}
