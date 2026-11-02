import { shellPage, confirmAction } from "../../shared/components/view.js";
import { newDraft, newIncidentRequestKey, payload, validDraft, fileError, formMarkup, historyMarkup } from "./tenant-incident.model.mjs";
import { showIncidentImage } from "../operations/incident-image.mjs";
import { showToast } from "../../shared/components/toast.js";
import "./tenant-requests.css";
import "./tenant-incident.css";
import "../../shared/components/content-card.css";
export default {
  id:"tenant-incidents",route:"/tenant/incidents",title:"Báo sự cố",tabLabel:"Báo sự cố",group:"tenant-operations",order:31,roles:["KHACH_THUE"],
  async render(context) {
    context.main.innerHTML=shellPage("Báo sự cố","");
    const root=context.main.querySelector("[data-content]");root.innerHTML='<div class="tenant-requests tenant-incidents"><div class="renewal-toolbar"><button class="btn btn--secondary" type="button" data-reload>Cập nhật trạng thái</button></div><p class="renewal-notice" role="status" aria-live="polite" data-message></p><div data-form></div><section><h2>Sự cố đã gửi</h2><div data-history></div></section></div>';
    const slot=root.querySelector("[data-form]"),history=root.querySelector("[data-history]"),message=root.querySelector("[data-message]"),reload=root.querySelector("[data-reload]");
    let data,rows=[],draft=newDraft(),editing=null,file=null,url=null,busy=false,loading=false,disposed=false,createKey=newIncidentRequestKey();
    const active=()=>!disposed&&root.isConnected;
    const release=()=>{if(url)URL.revokeObjectURL(url);url=null;};
    const dispose=()=>{disposed=true;release();file=null;window.removeEventListener("hashchange",dispose);window.removeEventListener("isk19:session-expired",dispose);};window.addEventListener("hashchange",dispose);window.addEventListener("isk19:session-expired",dispose);
    const remember=()=>{const form=slot.querySelector("[data-incident-form]");if(!form)return;for(const key of ["contractId","type","priority","description"]) {const el=form.elements.namedItem(key);if(el)draft[key]=el.value;}const remove=form.elements.namedItem("removeImage");if(remove)draft.removeImage=remove.checked;};
    const paint=()=>{
      slot.innerHTML=formMarkup(data,draft,editing);
      const form=slot.querySelector("[data-incident-form]");if(!form)return;
      const renewKey=()=>{if(!editing)createKey=newIncidentRequestKey();};
      form.addEventListener("input",renewKey);
      form.addEventListener("change",renewKey);
      const input=slot.querySelector("[data-file]"),name=slot.querySelector("[data-file-name]"),preview=slot.querySelector("[data-preview]");
      if(file){name.textContent=file.name;name.title=file.name;preview.src=url;preview.hidden=false;}
      slot.querySelector("[data-choose]").addEventListener("click",()=>input.click());
      input.addEventListener("change",()=>{const chosen=input.files?.[0];const error=fileError(chosen,data.imagePolicy);if(error){message.textContent=error;input.value="";return;}release();file=chosen||null;name.textContent=file?.name||"";name.title=file?.name||"";preview.hidden=!file;if(file){url=URL.createObjectURL(file);preview.src=url;}});
      slot.querySelector("[data-stop-edit]")?.addEventListener("click",()=>{editing=null;draft=newDraft();draft.contractId=data.contracts[0]?.contractId||"";release();file=null;paint();});
      form.addEventListener("submit",async event=>{
        event.preventDefault();if(busy||loading)return;remember();if(!validDraft(draft,data.priorities)){message.textContent="Vui lòng kiểm tra loại, mức ưu tiên và mô tả";return;}busy=true;form.querySelector("[data-fields]").disabled=true;reload.disabled=true;message.textContent="Đang gửi...";
        try{const body=payload(draft,Boolean(editing)),endpoint="/v1/incidents"+(editing?"/"+encodeURIComponent(editing):"");let response;
          if(file){const f=new FormData();for(const[k,v]of Object.entries(body))f.set(k,String(v));f.set("file",file);response=await context.api.request(endpoint,{method:editing?"PATCH":"POST",body:f,...(editing?{}:{headers:{"Idempotency-Key":createKey}})});}
          else if(editing)response=await context.api.patch(endpoint,body);else response=await context.api.post(endpoint,body,{"Idempotency-Key":createKey});
          if(!active())return;release();file=null;editing=null;draft=newDraft();createKey=newIncidentRequestKey();slot.innerHTML="";busy=false;await load();
          if(response?.duplicate){message.innerHTML='Bạn đã báo sự cố này, đang chờ xử lý. <a data-incident-link>Xem sự cố đã báo</a>';message.querySelector("[data-incident-link]").href=`#/tenant/incidents?incidentId=${encodeURIComponent(response.data.id)}`;}
          else {message.textContent="Đã lưu sự cố";showToast("Đã lưu sự cố", "success");}
        }catch(error){if(active()&&error.status!==401)message.textContent=error.message||"Không gửi được sự cố. Vui lòng thử lại.";}
        finally{busy=false;if(active()){reload.disabled=false;const fields=slot.querySelector("[data-fields]");if(fields)fields.disabled=false;}}
      });
    };
    const load=async()=>{if(loading||busy)return;loading=true;reload.disabled=true;message.textContent="Đang tải...";try{const[c,r]=await Promise.all([context.api.get("/v1/me/incident-context"),context.api.get("/v1/incidents")]);if(!active())return;remember();data=c.data;rows=r.data;const hash=typeof window.location?.hash==="string"?window.location.hash:"";const incidentId=new URLSearchParams(hash.split("?")[1]||"").get("incidentId");const visibleRows=incidentId?rows.filter(row=>String(row.id)===incidentId):rows;if(!draft.contractId)draft.contractId=data.contracts[0]?.contractId||"";paint();history.innerHTML=historyMarkup(visibleRows,data.categories);message.textContent=incidentId&&!visibleRows.length?"Không tìm thấy sự cố hoặc bạn không có quyền xem sự cố này.":"Đã cập nhật";}catch(error){if(active()&&error.status!==401){message.textContent=error.message||"Không tải được sự cố";reload.textContent="Thử lại / Cập nhật trạng thái";}}finally{loading=false;if(active())reload.disabled=false;}};
    reload.addEventListener("click",load);
    history.addEventListener("click",async event=>{const button=event.target.closest("[data-edit],[data-cancel],[data-image]");if(!button||busy||loading)return;const id=button.dataset.edit||button.dataset.cancel||button.dataset.image,row=rows.find(r=>r.id===id);if(!row)return;
      if(button.dataset.image){showIncidentImage(context.api,id,button);return;}
      if(button.dataset.edit){editing=id;draft={...newDraft(),type:row.type,priority:row.priority,description:row.description};release();file=null;paint();slot.querySelector("textarea")?.focus();return;}
      busy=true;button.disabled=true;try{if(!await confirmAction("Hủy sự cố này? Chỉ hủy được khi Chủ trọ chưa tiếp nhận."))return;await context.api.del("/v1/incidents/"+encodeURIComponent(id));busy=false;await load();message.textContent="Đã hủy sự cố";}catch(error){if(active()&&error.status!==401)message.textContent=error.message;}finally{busy=false;if(button.isConnected)button.disabled=false;}
    });
    history.addEventListener("submit",async event=>{
      const form=event.target.closest("[data-note-form]");if(!form)return;event.preventDefault();
      const id=form.dataset.noteForm,row=rows.find(item=>item.id===id),additionalNote=form.elements.namedItem("additionalNote")?.value.trim();
      if(busy||loading||row?.status!=="DANG_XU_LY"||!additionalNote)return;
      busy=true;const button=form.querySelector('button[type="submit"]');button.disabled=true;
      try{await context.api.patch(`/v1/incidents/${encodeURIComponent(id)}`,{additionalNote});busy=false;await load();message.textContent="Đã bổ sung ghi chú";}
      catch(error){if(active()&&error.status!==401)message.textContent=error.message||"Không gửi được ghi chú";}
      finally{busy=false;if(button.isConnected)button.disabled=false;}
    });
    await load();
  },
};
