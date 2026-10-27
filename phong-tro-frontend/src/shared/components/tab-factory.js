import { renderList } from "./view.js";

export function listTab(meta, config) {
  return { ...meta, render: (context) => renderList(context, config) };
}

export const roomName = (row) => row.so_phong || "Không rõ phòng";
export const nested = (key, fallback = "—") => (row) => row[key] || fallback;
