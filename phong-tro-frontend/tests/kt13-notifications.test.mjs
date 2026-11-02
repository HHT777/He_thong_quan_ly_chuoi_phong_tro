import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { mountInbox, inboxMeta, notificationTime, verifiedTarget } from "../src/modules/notifications/inbox-view.mjs";
import { mountNotificationBell } from "../src/layout/notification-bell.mjs";
import { tabForRoute } from "../src/core/route-policy.mjs";
import { ownerIncidentTarget } from "../src/modules/notifications/notification-target.mjs";
const tenant={vai_tro:"KHACH_THUE"},owner={vai_tro:"CHU_TRO"};
const tabs=[inboxMeta,{route:"/tenant/incidents",roles:["KHACH_THUE"]},{route:"/operations/incidents",roles:["CHU_TRO"]}];
const allowed=(route,user)=>Boolean(tabForRoute(tabs,route,user));
const row=(id="TEST")=>({ma_thong_bao:id,loai_thong_bao:"TEST",noi_dung:"TEST CONTENT",thoi_diem_tao:"2026-10-31T05:06:00Z",da_doc:false,target:null});
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
function dom(t){
 const d=new JSDOM("<main></main>",{url:"http://localhost/#/notifications/inbox"}),old=globalThis.window;globalThis.window=d.window;t.after(()=>{d.window.close();globalThis.window=old;});return d.window;
}
function harness(t,options={}){
 const w=dom(t),main=w.document.querySelector("main");let unread=options.rows?.length??1,calls=[],navigations=[],offline=options.offline||false;
 const entries=options.rows||[row()];const api={get:async path=>{calls.push(["GET",path]);if(offline)throw Error("TEST NETWORK");if(path.includes("unread-count"))return{data:{unreadCount:unread}};const page=Number(new URL(path,"http://localhost").searchParams.get("page"));const data=options.pages?options.pages[page-1]||[]:entries;return{data:data.map(x=>({...x})),pagination:{total:options.pages?options.pages.flat().length:entries.length,hasNext:options.pages?page<options.pages.length:false}};},patch:async path=>{calls.push(["PATCH",path]);const result=options.patch?await options.patch(path):null;unread=path.endsWith("read-all")?0:Math.max(0,unread-1);return result||{data:{unreadCount:unread}};}};
 const render=()=>mountInbox({main,api,user:options.user||tenant},{routeAllowed:allowed,navigate:r=>navigations.push(r)});
 return{w,main,api,calls,navigations,render,find:s=>main.querySelector(s),online:()=>{offline=false;}};
}
test("KT13 actual inbox and role policy expose the same shared route to both roles",()=>{
 for(const user of [tenant,owner])assert.equal(tabForRoute(tabs,"/notifications/inbox",user)?.id,"inbox");
 assert.equal(tabForRoute(tabs,"/operations/incidents",tenant),undefined);
 const tab=readFileSync(new URL("../src/modules/notifications/inbox.tab.js",import.meta.url),"utf8");assert.match(tab,/route: "\/notifications\/inbox"/);assert.match(tab,/roles: \["CHU_TRO", "KHACH_THUE"\]/);assert.match(tab,/mountInbox\(context, \{ navigate: go, routeAllowed \}\)/);
});
test("KT13 owner incident notifications preserve the verified incident filter",()=>{
 const target={route:"/operations/incidents?incidentId=11111111-1111-4111-8111-111111111111",resourceType:"incident",verified:true};
 assert.equal(ownerIncidentTarget({target}),target.route);
 assert.equal(ownerIncidentTarget({target:null}),null);
 const source=readFileSync(new URL("../src/modules/notifications/inbox.tab.js",import.meta.url),"utf8");
 assert.match(source,/\["SU_CO", "SU_CO_MOI", "KET_QUA_SU_CO"\]/);
});
test("KT13 owner delete control removes only the chosen notice without opening its link",async t=>{
 const source=readFileSync(new URL("../src/modules/notifications/inbox.tab.js",import.meta.url),"utf8");
 const executable=source.replace(/import "\.\/inbox\.css";/,"")
  .replace(/import \{ shellPage, escapeHtml, date, confirmAction \} from "[^"]+";/,'const shellPage=()=>"<div data-content></div>";const escapeHtml=value=>String(value);const date=value=>String(value);const confirmAction=async()=>true;')
  .replace(/import \{ go \} from "[^"]+";/,'const go=route=>{window.__openedRoute=route;};')
  .replace(/import \{ routeAllowed \} from "[^"]+";/,'const routeAllowed=()=>true;')
  .replace(/import \{ mountInbox \} from "[^"]+";/,'const mountInbox=()=>{};')
  .replace(/import \{ ownerIncidentTarget \} from "[^"]+";/,'const ownerIncidentTarget=row=>row.target?.verified?row.target.route:null;');
 const ownerTab=(await import(`data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`)).default;
 const w=dom(t),main=w.document.querySelector("main"),target={route:"/operations/incidents?incidentId=11111111-1111-4111-8111-111111111111",resourceType:"incident",verified:true};
 let deleted="";const api={patch:async()=>({}),get:async path=>({data:path.startsWith("/v1/notifications")?[{...row("OWN"),loai_thong_bao:"SU_CO_MOI",target}]:[],pagination:{hasNext:false}}),del:async path=>{deleted=path;return{data:{hidden:true}};}};
 await ownerTab.render({main,api,user:owner});
 main.querySelector('[data-delete-notification="OWN"]').click();await settle();
 assert.equal(deleted,"/v1/notifications/OWN");assert.equal(w.__openedRoute,undefined);
 assert.equal(main.querySelectorAll(".inbox-item").length,0);assert.match(main.querySelector("[data-count]").textContent,/0 thông báo/);
});
test("KT13 opening inbox marks all read, hides read controls, and escapes XSS",async t=>{
 const h=harness(t,{rows:[{...row(),noi_dung:'<img src=x onerror="bad">',ma_thong_bao:'"><script>bad</script>'}]});
 h.w.Storage.prototype.setItem=()=>assert.fail("No browser storage");await h.render();
 assert.equal(h.find("script"),null);assert.equal(h.find("img"),null);assert.match(h.find("[data-list]").textContent,/<img/);assert.match(h.find("time").textContent,/31\/10\/2026 12:06/);
 assert.match(h.find("[data-count]").textContent,/1 thông báo/);assert.equal(h.find("[data-count]").getAttribute("aria-live"),"polite");
 assert.deepEqual(h.calls.filter(([method])=>method==="PATCH").map(([,path])=>path),["/v1/notifications/read-all"]);
 assert.equal(h.find("[data-read-all]"),null);assert.equal(h.find("[data-filter]"),null);assert.equal(h.find("[data-open]"),null);
 assert.doesNotMatch(h.find("[data-list]").textContent,/Đánh dấu đã đọc|Chưa đọc|Đã đọc/);
 assert.equal(h.w.document.querySelectorAll("label[for]").length,1);assert.equal(notificationTime(null),"—");
});
test("KT13 DOM loading empty network error retry and pagination use real APIs",async t=>{
 const h=harness(t,{offline:true,pages:[[row("ONE")],[row("TWO")]]});await h.render();assert.match(h.find("[data-message]").textContent,/TEST NETWORK/);assert.equal(h.find(".inbox-empty"),null);
 h.online();h.find("[data-refresh]").click();await settle();assert.equal(h.main.querySelectorAll("[data-notification]").length,1);h.find("[data-more]").click();h.find("[data-more]").click();await settle();
 assert.equal(h.main.querySelectorAll("[data-notification]").length,2);assert.equal(h.calls.filter(([method,path])=>method==="GET"&&path.includes("page=2")).length,1);
});
test("KT13 DOM empty inbox and owner regression use the same implementation",async t=>{
 const h=harness(t,{rows:[],user:owner});await h.render();assert.match(h.find(".inbox-empty").textContent,/Hộp thư đang trống/);assert.equal(h.find("[data-read-all]"),null);
});
test("KT13 opening inbox waits for one read-all request before loading rows",async t=>{
 let resolve;const h=harness(t,{rows:[row("ONE"),row("TWO")],patch:()=>new Promise(r=>resolve=r)});const pending=h.render();
 assert.equal(h.calls.filter(([m])=>m==="PATCH").length,1);assert.equal(h.calls.filter(([m])=>m==="GET").length,0);
 resolve({data:{unreadCount:0}});await pending;assert.equal(h.main.querySelectorAll("[data-notification]").length,2);
 assert.equal(h.calls.filter(([m])=>m==="PATCH").length,1);
});
test("KT13 failed automatic read keeps inbox visible and offers refresh retry",async t=>{
 const h=harness(t,{patch:async()=>{throw Error("TEST PATCH FAILURE");}});await h.render();
 assert.match(h.find("[data-list]").textContent,/TEST CONTENT/);assert.match(h.find("[data-message]").textContent,/TEST PATCH FAILURE/);
 h.find("[data-refresh]").click();await settle();assert.equal(h.calls.filter(([m,p])=>m==="PATCH"&&p.endsWith("read-all")).length,2);assert.equal(h.navigations.length,0);
});
test("KT13 DOM only follows server ownership-verified incident destinations and role-allowed tabs",async t=>{
 const target={route:"/tenant/incidents?incidentId=11111111-1111-4111-8111-111111111111",resourceType:"incident",verified:true};
 const h=harness(t,{rows:[{...row("GOOD"),target},{...row("BAD"),target:{route:"/finance/bills",verified:true}}]});await h.render();
 h.main.querySelector('[data-notification="BAD"]').click();await settle();assert.equal(h.navigations.length,0);
 h.main.querySelector('[data-notification="GOOD"]').click();await settle();assert.deepEqual(h.navigations,["/tenant/incidents?incidentId=11111111-1111-4111-8111-111111111111"]);
 for(const bad of [{route:"javascript:bad",verified:true},{...target,verified:false},{...target,route:"/operations/incidents"},{...target,route:"/tenant/incidents?incidentId=bad"}])assert.equal(verifiedTarget({target:bad},tenant,allowed),null);
});
test("KT13 opening inbox updates the mounted bell using the server count",async t=>{
 const h=harness(t,{rows:[row("ONE"),row("TWO")],user:owner});
 const root=h.w.document.createElement("div");root.innerHTML='<button id="headerNotificationBtn"><span id="unreadNotificationDot" hidden></span><span data-unread-count aria-live="polite"></span></button>';h.w.document.body.append(root);
 const events=new h.w.AbortController();mountNotificationBell({root,api:h.api,navigate:()=>{},signal:events.signal});await settle();assert.equal(root.querySelector("[data-unread-count]").textContent,"2");
 await h.render();await settle();assert.equal(root.querySelector("[data-unread-count]").textContent,"0");assert.match(h.find("[data-count]").textContent,/2 thông báo/);assert.equal(h.calls.filter(([m,p])=>m==="PATCH"&&p.endsWith("read-all")).length,1);events.abort();
});
test("KT13 DOM 401 follows session disposal without navigating or displaying a session error",async t=>{
 let finish;const h=harness(t,{patch:()=>new Promise((_,reject)=>{finish=()=>{h.w.dispatchEvent(new h.w.Event("isk19:session-expired"));reject(Object.assign(Error("EXPIRED"),{status:401}));};})});const pending=h.render();finish();await pending;assert.equal(h.navigations.length,0);assert.doesNotMatch(h.find("[data-message]").textContent,/EXPIRED/);
});
test("KT13 DOM bell for both roles uses server count, routes to inbox and refreshes after read",async t=>{
 const w=dom(t);for(const user of [tenant,owner]){
  const root=w.document.createElement("div");root.innerHTML='<button id="headerNotificationBtn"><span id="unreadNotificationDot" hidden><span data-unread-count></span></span></button><button data-nav-group="notifications"><span data-sidebar-unread-count hidden></span></button>';w.document.body.append(root);
  let count=3,calls=0,navigated;const events=new w.AbortController();
  const refresh=mountNotificationBell({root,signal:events.signal,navigate:r=>{assert.equal(allowed(r,user),true);navigated=r;},api:{get:async p=>{assert.equal(p,"/v1/notifications/unread-count");calls++;return{data:{unreadCount:count}};}}});
  await settle();assert.equal(root.querySelector("[data-unread-count]").textContent,"3");assert.equal(root.querySelector("[data-sidebar-unread-count]").textContent,"3");root.querySelector("button").click();assert.equal(navigated,"/notifications/inbox");
  count=0;w.dispatchEvent(new w.Event("isk19:notifications-changed"));await settle();assert.equal(root.querySelector("[data-unread-count]").textContent,"0");assert.equal(root.querySelector("#unreadNotificationDot").hidden,true);assert.equal(root.querySelector("[data-sidebar-unread-count]").hidden,true);
  events.abort();const before=calls;w.dispatchEvent(new w.Event("focus"));await settle();assert.equal(calls,before);await refresh();root.remove();
 }
});
