import { renderList, shellPage } from "./view.js";

export function listTab(meta, config) {
  return { ...meta, render: (context) => renderList(context, config) };
}

export function readOnlyTab(meta, config) {
  return { ...meta, render: async (context) => {
    context.main.innerHTML = shellPage(config.title, config.description);
    const content = context.main.querySelector("[data-content]");
    const load = async () => {
      content.innerHTML = '<div class="panel" role="status">Đang tải dữ liệu...</div>';
      try {
        const value = await config.load(context.api);
        if (!content.isConnected) return;
        content.innerHTML = config.view(value);
        config.bind?.(content, context, value);
      } catch (error) {
        if (!content.isConnected) return;
        content.innerHTML = '<div class="panel" role="alert"><p data-read-error></p><button type="button" class="btn btn--secondary" data-read-retry>Thử lại</button></div>';
        content.querySelector("[data-read-error]").textContent = error.message || "Không thể tải dữ liệu";
        content.querySelector("[data-read-retry]").addEventListener("click", load);
      }
    };
    await load();
  } };
}

export const roomName = (row) => row.so_phong || "Không rõ phòng";
export const nested = (key, fallback = "—") => (row) => row[key] || fallback;
