export async function showIncidentImage(api, id, trigger) {
  if (trigger?.disabled) return;
  if (trigger) trigger.disabled = true;
  const overlay = document.createElement("div"); overlay.className = "modal-overlay";
  overlay.innerHTML = '<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="incident-image-title"><div class="modal-header"><h3 id="incident-image-title">Ảnh sự cố</h3><button type="button" class="btn btn--secondary" data-close>Đóng</button></div><div class="modal-body"><p role="status" data-image-status>Đang tải ảnh...</p><img data-image alt="Ảnh sự cố" hidden style="width:100%;max-height:70vh;object-fit:contain"></div></div>';
  let url, closed = false;
  const close = () => { if (closed) return; closed = true; if (url) URL.revokeObjectURL(url); document.removeEventListener("keydown", key); window.removeEventListener("hashchange",close);window.removeEventListener("isk19:session-expired",close);overlay.remove(); if (trigger) trigger.disabled = false; if(trigger?.isConnected)trigger.focus(); };
  const key = e => { if(e.key === "Escape")close(); };
  overlay.querySelector("[data-close]").addEventListener("click",close); overlay.addEventListener("click",e=>{if(e.target===overlay)close()}); document.addEventListener("keydown",key);window.addEventListener("hashchange",close);window.addEventListener("isk19:session-expired",close);
  document.body.appendChild(overlay);overlay.querySelector("[data-close]").focus();
  try { const {blob}=await api.getBlob(`/v1/incidents/${encodeURIComponent(id)}/image`); if(closed)return;url=URL.createObjectURL(blob);const img=overlay.querySelector("[data-image]");img.src=url;img.hidden=false;overlay.querySelector("[data-image-status]").textContent=""; }
  catch(error){if(!closed)overlay.querySelector("[data-image-status]").textContent=error.message||"Không thể tải ảnh";}
  return close;
}
