import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newDraft, newIncidentRequestKey, payload, validDraft, fileError, formMarkup, historyMarkup } from "../src/modules/tenant/tenant-incident.model.mjs";
const data = {contracts:[{contractId:"TEST",roomName:"TEST ROOM",buildingName:"TEST BUILDING"}],categories:[{ma:"TEST",ten:"TEST CATEGORY"}],priorities:["THAP","TRUNG_BINH","CAO","KHAN_CAP"],imagePolicy:{mimeTypes:["image/jpeg","image/png"],maxBytes:1024,maxFiles:1}};
const draft=()=>({...newDraft(),contractId:"TEST",type:"TEST",description:"TEST DESCRIPTION"});
const row=()=>({id:"TEST",type:"TEST",description:"TEST",status:"CHO_TIEP_NHAN",submittedAt:"2026-10-30",canEdit:true,canCancel:true});
test("KT12 form uses runtime room categories priorities image policy and no financial inputs",()=>{
  const html=formMarkup(data,draft());assert.match(html,/TEST ROOM/);assert.match(html,/1024 byte/);assert.match(html,/data-file/);assert.match(html,/class="panel panel--padded"/);
  assert.doesNotMatch(html,/name="(?:roomId|tenantId|cost|status|responsible|imageUrl|contractId)"/);
  const multiple = formMarkup({...data,contracts:[...data.contracts,{contractId:"OTHER",roomName:"OTHER",buildingName:"TEST"}]},draft());
  assert.match(multiple,/name="contractId"/);assert.equal(multiple.indexOf('<form data-incident-form>') < multiple.indexOf('name="contractId"'),true,"Contract selection must belong to the submitted form");
  assert.match(formMarkup({...data,contracts:[]},draft()),/Chưa có hợp đồng/);
  assert.equal(newDraft().priority,"TRUNG_BINH");assert.equal(validDraft(draft(),data.priorities),true);assert.equal(validDraft({...draft(),priority:"INVALID"},data.priorities),false);
  assert.deepEqual(Object.keys(payload(draft(),false)).sort(),["contractId","description","priority","type"]);
  assert.equal(Object.hasOwn(payload(draft(),true),"contractId"),false);
});
test("KT12 form keeps incident types selectable when the category table is empty",()=>{
  const html=formMarkup({...data,categories:[]},draft());
  assert.match(html,/value="THIET_BI"/);
  assert.match(html,/value="DIEN"/);
  assert.match(html,/value="KHAC"/);
});
test("KT12 history displays server states allowed actions padded dates and escaped public response",()=>{
  const html=historyMarkup([row(),{...row(),id:"DONE",status:"DA_XU_LY",canEdit:false,canCancel:false,response:'<img src=x onerror="bad">',chi_phi_sua_chua:999,ghi_chu:"INTERNAL"},{...row(),status:"DA_HUY",canEdit:false,canCancel:false}]);
  assert.match(html,/30\/10\/2026/);assert.match(html,/Đã hủy/);assert.match(html,/Chi tiết sự cố/);assert.match(html,/&lt;img/);
  assert.doesNotMatch(html,/<img src=x|999|INTERNAL/);assert.equal((html.match(/data-edit=/g)||[]).length,1);assert.match(historyMarkup([]),/Chưa có sự cố/);
  assert.doesNotMatch(formMarkup(data,{...draft(),description:'</textarea><script>bad</script>'}),/<script>/);
});
test("KT12 incident history uses readable category names instead of internal codes",()=>{
  assert.match(historyMarkup([{...row(),type:"THIET_BI"}]),/<h3>Thiết bị<\/h3>/);
  assert.match(historyMarkup([row()],data.categories),/<h3>TEST CATEGORY<\/h3>/);
  assert.match(historyMarkup([{...row(),type:"OLD_CODE"}]),/<h3>Sự cố khác<\/h3>/);
  assert.doesNotMatch(historyMarkup([{...row(),status:"OLD_STATUS",priority:"OLD_PRIORITY"}]),/OLD_STATUS|OLD_PRIORITY/);
  const hostile=historyMarkup([row()],[{ma:"TEST",ten:"<script>bad</script>"}]);
  assert.match(hostile,/&lt;script&gt;/);assert.doesNotMatch(hostile,/<script>/);
});
test("KT12 client rejects wrong image MIME size and suffix before upload",()=>{
  const p=data.imagePolicy;assert.equal(fileError({name:"TEST.png",type:"image/png",size:10},p),"");
  assert.notEqual(fileError({name:"TEST.png",type:"text/plain",size:10},p),"");assert.notEqual(fileError({name:"TEST.exe",type:"image/png",size:10},p),"");assert.notEqual(fileError({name:"TEST.png",type:"image/png",size:1025},p),"");
});
test("KT12 request key remains available on HTTP without randomUUID",t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,"crypto");
  Object.defineProperty(globalThis,"crypto",{configurable:true,value:{getRandomValues:bytes=>{bytes.fill(1);return bytes;}}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,"crypto",previous);else delete globalThis.crypto;});
  assert.match(newIncidentRequestKey(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
});
const tabUrl=new URL("../src/modules/tenant/tenant-incidents.tab.js",import.meta.url),source=readFileSync(tabUrl,"utf8");
const executable=source.replace(/import "[^"\n]+\.css";/g,"").replace(/import \{ shellPage, confirmAction \} from "[^"\n]+";/,'const shellPage=()=>""; const confirmAction=async()=>true;').replace(/import \{ showToast \} from "[^"\n]+";/,'const showToast=()=>{};').replace(/from "([^"]+)"/g,(_m,p)=>`from ${JSON.stringify(new URL(p,tabUrl).href)}`);
const tab=(await import(`data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`)).default;
class Element{
  constructor(){this._html="";this.isConnected=true;this.children=new Map();this.listeners={};this.disabled=false;this.dataset={};this.value="";}
  set innerHTML(v){this._html=v;this.children.clear();}get innerHTML(){return this._html;}
  querySelector(s){if(s==="[data-fields]"&&this.children.has("[data-incident-form]"))return this.children.get("[data-incident-form]").querySelector(s);if(s==="[data-incident-form]"&&!this._html.includes("data-incident-form"))return null;if(s==="[data-stop-edit]"&&!this._html.includes("data-stop-edit"))return null;
    if(!this.children.has(s)){const el=new Element();if(s==="[data-incident-form]"){el.fields={};for(const k of ["contractId","type","priority","description"]){const match=this._html.match(new RegExp(`name="${k}"[^>]*>([^<]*)`));el.fields[k]={value:k==="contractId"?"TEST":k==="priority"?"TRUNG_BINH":match?.[1]||""};}el.fields.removeImage={checked:false};el.elements={namedItem:k=>el.fields[k]};}this.children.set(s,el);}return this.children.get(s);}
  addEventListener(k,v){this.listeners[k]=v;}focus(){this.focused=true;}click(){return this.listeners.click?.();}remove(){this.isConnected=false;}setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}
}
function harness(t,api){const original=globalThis.window;globalThis.window=new EventTarget();t.after(()=>{globalThis.window=original;});const main=new Element();Object.defineProperty(main,"innerHTML",{get(){return this._html;},set(v){this._html=v;}});const root=main.querySelector("[data-content]"),get=api.get|| (async p=>({data:p.includes("context")?data:[row()]}));return {main,root,slot:()=>root.querySelector("[data-form]"),history:()=>root.querySelector("[data-history]"),message:()=>root.querySelector("[data-message]"),render:()=>tab.render({main,api:{...api,get}})};}
const fill=h=>{const f=h.slot().querySelector("[data-incident-form]");f.fields.type.value="TEST";f.fields.description.value="TEST DESCRIPTION";return f;};
test("KT12 multiple-contract selection sends the selected contract rather than the default",async t=>{
  let sent;const multiple={...data,contracts:[...data.contracts,{contractId:"OTHER",roomName:"OTHER",buildingName:"TEST"}]};
  const h=harness(t,{get:async p=>({data:p.includes("context")?multiple:[]}),post:async(_p,body)=>{sent=body;}});await h.render();const form=fill(h);form.fields.contractId.value="OTHER";await form.listeners.submit({preventDefault(){}});assert.equal(sent.contractId,"OTHER");
});
test("KT12 real tab keeps failed form and blocks double submission",async t=>{
  let release,calls=0,fail=false;const h=harness(t,{post:async()=>{calls++;await new Promise(r=>release=r);if(fail)throw Error("NETWORK TEST");}});await h.render();let form=fill(h);const first=form.listeners.submit({preventDefault(){}});form.listeners.submit({preventDefault(){}});assert.equal(calls,1);assert.equal(form.querySelector("[data-fields]").disabled,true);release();await first;
  fail=true;form=fill(h);const second=form.listeners.submit({preventDefault(){}});release();await second;assert.equal(form.fields.description.value,"TEST DESCRIPTION");assert.match(h.message().textContent,/NETWORK TEST/);assert.equal(form.querySelector("[data-fields]").disabled,false);
});
test("KT12 retry uses the same request key until the incident draft changes",async t=>{
  const keys=[];const h=harness(t,{post:async(_path,_body,headers)=>{keys.push(headers["Idempotency-Key"]);throw Error("NETWORK TEST");}});
  await h.render();const form=fill(h);
  await form.listeners.submit({preventDefault(){}});
  await form.listeners.submit({preventDefault(){}});
  assert.equal(keys[0],keys[1]);
  form.fields.description.value="CHANGED DESCRIPTION";form.listeners.input();
  await form.listeners.submit({preventDefault(){}});
  assert.notEqual(keys[2],keys[1]);
});
test("KT12 duplicate submission links to the existing incident",async t=>{
  const h=harness(t,{post:async()=>({duplicate:true,data:{id:"EXISTING"}})});await h.render();
  await fill(h).listeners.submit({preventDefault(){}});
  assert.match(h.message().innerHTML,/Bạn đã báo sự cố này/);
  assert.equal(h.message().querySelector("[data-incident-link]").href,"#/tenant/incidents?incidentId=EXISTING");
});
test("KT12 in-progress incident offers an additional note on the existing PATCH route",async t=>{
  assert.match(historyMarkup([{...row(),status:"DANG_XU_LY"}],data.categories),/data-note-form="TEST"/);
  assert.doesNotMatch(historyMarkup([row()],data.categories),/data-note-form/);
  let patched;const h=harness(t,{get:async p=>({data:p.includes("context")?data:[{...row(),status:"DANG_XU_LY"}]}),patch:async(path,body)=>{patched={path,body};}});await h.render();
  const form=new Element();form.dataset.noteForm="TEST";form.elements={namedItem:()=>({value:"Thiết bị thứ hai hỏng"})};
  await h.history().listeners.submit({target:{closest:()=>form},preventDefault(){}});
  assert.deepEqual(patched,{path:"/v1/incidents/TEST",body:{additionalNote:"Thiết bị thứ hai hỏng"}});
});
test("KT12 tab retry keeps one API scope and 401 session events dispose the view",async t=>{
  let offline=true;const h=harness(t,{get:async p=>{if(offline)throw Error("NETWORK TEST");return {data:p.includes("context")?data:[]};}});await h.render();assert.match(h.message().textContent,/NETWORK TEST/);offline=false;await h.root.querySelector("[data-reload]").click();assert.match(h.history().innerHTML,/Chưa có sự cố/);window.dispatchEvent(new Event("isk19:session-expired"));
  assert.doesNotMatch(source,/localStorage|sessionStorage|captureDraft|readingValue|roomId/);assert.match(source,/error.status!==401/);
});
test("KT12 edit and cancel follow server permission and canonical endpoints",async t=>{
  let changed,cancelled;const h=harness(t,{patch:async(p,b)=>{changed={p,b};},del:async p=>{cancelled=p;}});await h.render();const edit=new Element();edit.dataset.edit="TEST";await h.history().listeners.click({target:{closest:()=>edit}});const form=fill(h);await form.listeners.submit({preventDefault(){}});assert.equal(changed.p,"/v1/incidents/TEST");assert.equal(Object.hasOwn(changed.b,"contractId"),false);
  const cancel=new Element();cancel.dataset.cancel="TEST";await h.history().listeners.click({target:{closest:()=>cancel}});assert.equal(cancelled,"/v1/incidents/TEST");
});
test("KT12 selected image preview is revoked on replacement and session disposal",async t=>{
  const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;let creates=0,revokes=0;URL.createObjectURL=()=>"blob:TEST"+(++creates);URL.revokeObjectURL=()=>revokes++;t.after(()=>{URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;});
  const h=harness(t,{});await h.render();const file=h.slot().querySelector("[data-file]");file.files=[{name:"TEST.png",type:"image/png",size:10}];file.listeners.change();file.listeners.change();assert.equal(revokes,1);window.dispatchEvent(new Event("hashchange"));assert.equal(revokes,2);
  const owner=readFileSync(new URL("../src/modules/operations/incidents.tab.js",import.meta.url),"utf8");assert.match(owner,/cost:|name: "cost"/);assert.match(owner,/responsible/);
});
