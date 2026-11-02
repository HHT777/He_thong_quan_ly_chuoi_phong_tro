export function mountNotificationBell({root,api,navigate,signal}) {
  const button=root.querySelector("#headerNotificationBtn"),dot=root.querySelector("#unreadNotificationDot"),count=root.querySelector("[data-unread-count]"),sidebar=root.querySelector("[data-sidebar-unread-count]");
  let version=0;
  button?.addEventListener("click",()=>navigate("/notifications/inbox"),{signal});
  const refresh=async()=>{
    const request=++version;
    try {
      const r=await api.get("/v1/notifications/unread-count");
      if(signal.aborted||request!==version||!root.isConnected)return;
      const value=r.data.unreadCount;if(!Number.isSafeInteger(value)||value<0)throw Error("Invalid unread count");
      const label=value>99?"99+":String(value);
      if(dot)dot.hidden=value===0;if(count)count.textContent=label;
      if(sidebar){sidebar.hidden=value===0;sidebar.textContent=label;sidebar.closest("[data-nav-group]")?.setAttribute("aria-label",`Thông báo: ${value} chưa đọc`);}
      button?.setAttribute("aria-label",`Thông báo: ${value} chưa đọc`);
    }catch{if(signal.aborted||request!==version||!root.isConnected)return;if(dot)dot.hidden=true;if(count)count.textContent="";if(sidebar){sidebar.hidden=true;sidebar.closest("[data-nav-group]")?.setAttribute("aria-label","Thông báo: chưa tải được số chưa đọc");}button?.setAttribute("aria-label","Thông báo: chưa tải được số chưa đọc");}
  };
  window.addEventListener("focus",refresh,{signal});window.addEventListener("isk19:notifications-changed",refresh,{signal});
  const timer=window.setInterval(refresh,30000);signal.addEventListener("abort",()=>window.clearInterval(timer),{once:true});
  void refresh();return refresh;
}
