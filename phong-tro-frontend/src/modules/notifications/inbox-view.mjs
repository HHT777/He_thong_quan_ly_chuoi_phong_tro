import { escapeHtml as e, datePadded, shellPage } from "../../shared/components/view.js";
export const inboxMeta = { id:"inbox", route:"/notifications/inbox", title:"Thông báo", tabLabel:"Hộp thư", group:"notifications", order:60, roles:["CHU_TRO","KHACH_THUE"] };
const labels = { HOP_DONG:"Hợp đồng", PHIEU_THU:"Phiếu thu", CONG_NO:"Công nợ", THANH_TOAN:"Thanh toán", THONG_BAO_CHU_TRO:"Thông báo", SU_CO:"Sự cố", SU_CO_MOI:"Sự cố", KET_QUA_SU_CO:"Sự cố", KET_QUA_YEU_CAU:"Yêu cầu", YEU_CAU:"Yêu cầu", CHI_SO_DIEN:"Chỉ số điện", THANH_LY_HOP_DONG:"Trả phòng" };
export function notificationTime(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "—";
  return datePadded(value)+" "+new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value));
}
export function verifiedTarget(row,user,allowed) {
  const t=row.target, expected=user?.vai_tro==="KHACH_THUE"?"/tenant/incidents":user?.vai_tro==="CHU_TRO"?"/operations/incidents":null;
  if(!t || t.verified!==true || t.resourceType!=="incident" || !expected) return null;
  const parsed = new URL(t.route || "", "http://localhost");
  if(parsed.pathname !== expected || !/^[0-9a-f-]{36}$/i.test(parsed.searchParams.get("incidentId") || "") || !allowed(parsed.pathname,user)) return null;
  return `${parsed.pathname}?incidentId=${encodeURIComponent(parsed.searchParams.get("incidentId"))}`;
}
export async function mountInbox({main,api,user},{navigate,routeAllowed}) {
  main.innerHTML=shellPage("Thông báo","");
  const root=main.querySelector("[data-content]");
  root.innerHTML=`<section class="inbox-panel" aria-label="Hộp thư thông báo"><div class="inbox-toolbar">
    <label class="inbox-search" for="inbox-search"><span class="sr-only">Tìm thông báo</span><input id="inbox-search" type="search" maxlength="100" data-search placeholder="Tìm thông báo..." /></label>
    <span class="inbox-count" data-count role="status" aria-live="polite"></span></div>
    <div class="inbox-toolbar inbox-actions"><button class="btn btn--secondary" type="button" data-refresh>Cập nhật thông báo</button></div>
    <p class="inbox-message" data-message role="status" aria-live="polite"></p><div class="inbox-list" data-list></div>
    <div class="inbox-footer"><button class="btn btn--secondary" type="button" data-more hidden>Tải thêm thông báo</button></div></section>`;
  const el=s=>root.querySelector(s), events=new window.AbortController();
  let active=true,loading=false,loaded=false,rows=[],page=0,total=0,hasNext=false;
  const live=()=>active&&root.isConnected, changed=()=>window.dispatchEvent(new window.Event("isk19:notifications-changed"));
  const stop=()=>{active=false;events.abort();};
  for(const type of ["hashchange","isk19:session-expired","isk19:session-changed"])window.addEventListener(type,stop,{signal:events.signal});
  function paint() {
    el("[data-count]").textContent=loaded?`${total} thông báo`:(loading?"Đang tải số thông báo...":"Chưa tải được số thông báo");
    for(const s of ["[data-search]","[data-refresh]","[data-more]"])el(s).disabled=loading;
    el("[data-refresh]").textContent=loading?"Đang tải...":"Cập nhật thông báo";el("[data-more]").hidden=!hasNext;
    const visible=rows;
    el("[data-list]").innerHTML=visible.length?visible.map(r=>{
      const target=verifiedTarget(r,user,routeAllowed);
      return `<article class="inbox-item" data-notification="${e(r.ma_thong_bao)}" ${target?'role="link" tabindex="0"':""}><span class="inbox-item__marker" aria-hidden="true"></span><div class="inbox-item__body"><div class="inbox-item__meta"><strong class="inbox-item__type">${e(labels[r.loai_thong_bao]||"Thông báo")}</strong><time>${e(notificationTime(r.thoi_diem_tao))}</time></div><p>${e(r.noi_dung)}</p></div>${target?'<span class="inbox-item__read">Xem mục liên quan →</span>':""}</article>`;
    }).join(""):(!loaded||loading?'':'<div class="inbox-empty"><strong>Hộp thư đang trống</strong><span>Không có thông báo phù hợp.</span></div>');
  }
  async function load(reset=true) {
    if(!live()||loading)return;loading=true;el("[data-message]").textContent="Đang tải thông báo...";paint();
    try {
      let markError=null;
      if(reset){try{await api.patch("/v1/notifications/read-all",{});if(live())changed();}catch(error){if(error.status===401)return;markError=error;}}
      const next=reset?1:page+1,q=new URLSearchParams({page:String(next),limit:"25",q:el("[data-search]").value.trim()});
      const r=await api.get("/v1/notifications?"+q);
      if(!live())return;loaded=true;rows=reset?r.data:[...new Map([...rows,...r.data].map(r=>[r.ma_thong_bao,r])).values()];page=next;total=r.pagination.total;hasNext=r.pagination.hasNext;el("[data-message]").textContent=markError?"Chưa đánh dấu thông báo đã đọc: "+markError.message+". Chọn Cập nhật thông báo để thử lại.":"";
    } catch(error){if(live()&&error.status!==401)el("[data-message]").textContent="Không tải được thông báo: "+error.message+". Chọn Cập nhật thông báo để thử lại.";}
    finally{loading=false;if(live())paint();}
  }
  const open=row=>{const target=verifiedTarget(row,user,routeAllowed);if(live()&&target)navigate(target);};
  root.addEventListener("click",event=>{const a=event.target.closest("[data-notification]");if(a){const r=rows.find(r=>r.ma_thong_bao===a.dataset.notification);if(r)open(r);}},{signal:events.signal});
  root.addEventListener("keydown",event=>{const a=event.target.closest("[data-notification]");if(event.target!==a||!["Enter"," "].includes(event.key))return;event.preventDefault();const r=rows.find(r=>r.ma_thong_bao===a.dataset.notification);if(r)open(r);},{signal:events.signal});
  el("[data-refresh]").addEventListener("click",()=>void load(),{signal:events.signal});
  el("[data-more]").addEventListener("click",()=>void load(false),{signal:events.signal});
  el("[data-search]").addEventListener("input",()=>void load(),{signal:events.signal});
  await load();return{dispose:stop};
}
