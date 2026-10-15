/**
 * ISK19 SaaS Icon Library
 * Uniform Phosphor / Lucide stroke-based SVG icons
 */

const createSvg = (svgContent, size = 20, className = "icon") => `
  <svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    ${svgContent}
  </svg>
`.trim();

export const icons = {
  // Navigation & General
  dashboard: (size = 20, cls) => createSvg(`<rect width="7" height="9" x="3" y="3" rx="1.5"/><rect width="7" height="5" x="14" y="3" rx="1.5"/><rect width="7" height="9" x="14" y="12" rx="1.5"/><rect width="7" height="5" x="3" y="16" rx="1.5"/>`, size, cls),
  building: (size = 20, cls) => createSvg(`<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/>`, size, cls),
  door: (size = 20, cls) => createSvg(`<path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M14 12v.01"/>`, size, cls),
  users: (size = 20, cls) => createSvg(`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>`, size, cls),
  user: (size = 20, cls) => createSvg(`<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`, size, cls),
  contract: (size = 20, cls) => createSvg(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`, size, cls),
  finance: (size = 20, cls) => createSvg(`<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M6 15h.01M10 15h2"/>`, size, cls),
  money: (size = 20, cls) => createSvg(`<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`, size, cls),
  operations: (size = 20, cls) => createSvg(`<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`, size, cls),
  tool: (size = 20, cls) => createSvg(`<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`, size, cls),
  zap: (size = 20, cls) => createSvg(`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`, size, cls),
  bell: (size = 20, cls) => createSvg(`<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`, size, cls),
  settings: (size = 20, cls) => createSvg(`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`, size, cls),
  help: (size = 20, cls) => createSvg(`<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>`, size, cls),
  logout: (size = 20, cls) => createSvg(`<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>`, size, cls),

  // Actions & UI Controls
  search: (size = 20, cls) => createSvg(`<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`, size, cls),
  plus: (size = 20, cls) => createSvg(`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`, size, cls),
  refresh: (size = 20, cls) => createSvg(`<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19"/>`, size, cls),
  download: (size = 20, cls) => createSvg(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>`, size, cls),
  chevronDown: (size = 18, cls) => createSvg(`<polyline points="6 9 12 15 18 9"/>`, size, cls),
  chevronUp: (size = 18, cls) => createSvg(`<polyline points="18 15 12 9 6 15"/>`, size, cls),
  chevronLeft: (size = 18, cls) => createSvg(`<polyline points="15 18 9 12 15 6"/>`, size, cls),
  chevronRight: (size = 18, cls) => createSvg(`<polyline points="9 18 15 12 9 6"/>`, size, cls),
  moreHorizontal: (size = 20, cls) => createSvg(`<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>`, size, cls),
  filter: (size = 20, cls) => createSvg(`<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>`, size, cls),
  x: (size = 20, cls) => createSvg(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, size, cls),
  check: (size = 20, cls) => createSvg(`<polyline points="20 6 9 17 4 12"/>`, size, cls),
  alertCircle: (size = 20, cls) => createSvg(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`, size, cls),
  clock: (size = 20, cls) => createSvg(`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`, size, cls),
  trendingUp: (size = 16, cls) => createSvg(`<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`, size, cls),
  trendingDown: (size = 16, cls) => createSvg(`<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>`, size, cls),
  arrowUpRight: (size = 16, cls) => createSvg(`<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>`, size, cls),
  panelLeftClose: (size = 20, cls) => createSvg(`<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M14 9l-3 3 3 3"/>`, size, cls),
  panelLeftOpen: (size = 20, cls) => createSvg(`<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M13 15l3-3-3-3"/>`, size, cls),
  menu: (size = 20, cls) => createSvg(`<line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/>`, size, cls),
};
