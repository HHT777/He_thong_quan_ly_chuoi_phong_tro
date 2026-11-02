const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
function harness() {
  const rows=[{ma_thong_bao:"A",ma_tai_khoan:"TENANT",loai_thong_bao:"TEST",noi_dung:"TEST",da_doc:false,da_an:false,thoi_diem_tao:"2026-01-01",khoa_su_kien:"EVENT:A"},{ma_thong_bao:"B",ma_tai_khoan:"OTHER",loai_thong_bao:"TEST",noi_dung:"TEST",da_doc:false,da_an:false}];let ownership=0,audits=[];
  const matches=(r,w)=>Object.entries(w).every(([k,v])=>r[k]===v);
  const model={findAndCountAll:async o=>({rows:rows.filter(r=>matches(r,o.where)).slice(o.offset,o.offset+o.limit),count:rows.filter(r=>matches(r,o.where)).length}),count:async o=>rows.filter(r=>matches(r,o.where)).length,findOne:async o=>rows.find(r=>matches(r,o.where)),update:async (v,o)=>{const found=rows.filter(r=>matches(r,o.where));found.forEach(r=>Object.assign(r,v));return[found.length]}};
  const missing=()=>Object.assign(Error("Missing"),{status:404,code:"RESOURCE_NOT_FOUND"});
  const own=async(u,t,id)=>{ownership++;if(t==="incident"){if(u.vai_tro==="CHU_TRO"&&id==="11111111-1111-4111-8111-111111111111")return{da_xoa:false};throw missing();}const r=rows.find(r=>r.ma_thong_bao===id&&r.ma_tai_khoan===u.ma_tai_khoan);if(!r)throw missing();return r;};
  const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/services/notification.service.js"),"utf8"),{module,exports:module.exports,require:n=>n==="../models"?{ThongBao:model}:n==="../config/database"?{transaction:async fn=>fn({})}:n==="./auditLog.service"?{writeAuditLog:async value=>audits.push(value)}:n==="./ownership.service"?{assertOwned:own,notFoundError:missing}:require(n)});
  return{s:module.exports,rows,user:{ma_tai_khoan:"TENANT",vai_tro:"KHACH_THUE"},owner:{ma_tai_khoan:"TENANT",vai_tro:"CHU_TRO"},audits,ownership:()=>ownership};
}
test("KT13 list and unread use recipient JWT with bounded stable pagination and whitelist",async()=>{
  const h=harness(),r=await h.s.list(h.user);assert.equal(r.data.length,1);assert.equal(r.data[0].ma_thong_bao,"A");assert.equal(r.pagination.limit,25);assert.equal(Object.hasOwn(r.data[0],"ma_tai_khoan"),false);assert.equal((await h.s.unreadCount(h.user)).unreadCount,1);
  for(const q of [{userId:"OTHER"},{tenantId:"OTHER"},{page:"0"},{limit:"101"},{limit:["2"]},{status:"BAD"}])await assert.rejects(h.s.list(h.user,q),{code:"INVALID_NOTIFICATION_QUERY"});
  await assert.rejects(h.s.list({...h.user,vai_tro:"OTHER"}),{status:403});
});
test("KT13 mark read and mark all are owner scoped and idempotent without rewriting creation time",async()=>{
 const h=harness();const before=JSON.stringify(h.rows);for(const id of ["B","MISSING",undefined])await assert.rejects(h.s.markRead(h.user,id),{status:404,code:"RESOURCE_NOT_FOUND"});assert.equal(JSON.stringify(h.rows),before);
 await h.s.markRead(h.user,"A");assert.equal(h.ownership(),4);const once=JSON.stringify(h.rows);await h.s.markRead(h.user,"A");assert.equal(JSON.stringify(h.rows),once);assert.equal(h.rows[0].thoi_diem_tao,"2026-01-01");await h.s.markAllRead(h.user);assert.equal(h.rows[1].da_doc,false);assert.equal((await h.s.markAllRead(h.user)).changed,0);
});
test("KT13 notification DTO redacts labelled private information without touching stored content",()=>{
 const h=harness(),privateText=["CCCD: TEST_IDENTITY_MARKER","ngày sinh: TEST_BIRTH_MARKER","địa chỉ: TEST_ADDRESS_MARKER","phone: TEST_CONTACT_MARKER"].join(";");const safe=h.s.safeContent(privateText);
 for(const marker of ["TEST_IDENTITY_MARKER","TEST_BIRTH_MARKER","TEST_ADDRESS_MARKER","TEST_CONTACT_MARKER"])assert.equal(safe.includes(marker),false);
 assert.equal(h.s.safeContent("Phiếu thu có tổng 100000000đ."),"Phiếu thu có tổng 100000000đ.");
});
test("KT13 owner incident notice resolves an owned incident from its event key and keeps unsafe notices inert",async()=>{
 const h=harness(),id="11111111-1111-4111-8111-111111111111",owner={ma_tai_khoan:"TENANT",vai_tro:"CHU_TRO"};
 h.rows[0].loai_thong_bao="SU_CO_MOI";h.rows[0].khoa_su_kien=`SU_CO_MOI:${id}`;
 const expected=`/operations/incidents?incidentId=${id}`;
 assert.equal((await h.s.list(owner)).data[0].target.route,expected);
 h.rows[0].khoa_su_kien="SU_CO_MOI:22222222-2222-4222-8222-222222222222";
 assert.equal((await h.s.list(owner)).data[0].target,null);
 h.rows[0].khoa_su_kien=`SU_CO_MOI:${id}`;h.rows[0].loai_thong_bao="TEST";
 assert.equal((await h.s.list(owner)).data[0].target,null);
});
test("KT13 only the recipient owner can hide a notice without releasing its event key",async()=>{
 const h=harness();
 await assert.rejects(h.s.hide(h.user,"A"),{status:403,code:"FORBIDDEN"});
 for(const id of ["B","MISSING"])await assert.rejects(h.s.hide(h.owner,id),{status:404,code:"RESOURCE_NOT_FOUND"});
 await assert.rejects(h.s.hide(h.owner,"A",{other:"1"}),{status:400,code:"INVALID_NOTIFICATION_QUERY"});
 assert.equal(h.rows[0].da_an,false);assert.equal(h.audits.length,0);
 assert.equal((await h.s.hide(h.owner,"A")).hidden,true);
 assert.equal(h.rows[0].khoa_su_kien,"EVENT:A");assert.equal(h.rows[0].da_an,true);
 assert.equal((await h.s.list(h.owner)).data.length,0);assert.equal((await h.s.unreadCount(h.owner)).unreadCount,0);
 await h.s.hide(h.owner,"A");assert.equal(h.audits.length,1);
 assert.equal(h.audits[0].action,"NOTIFICATION_HIDDEN");assert.equal(h.rows[1].da_an,false);
});
