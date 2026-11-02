const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto"), fs = require("node:fs"), path = require("node:path");
const db = require("../src/config/database"), m = require("../src/models");
const { businessDate, addBusinessDays: days } = require("../src/utils/businessDate.util");
const { approvedDisposableTarget } = require("../src/config/testDatabaseSafety");
const { request, headers } = require("./helpers/integration-api");
const today = businessDate(); let seq = 0, step = "setup";
test.before(() => { approvedDisposableTarget(process.env, process.env.DB_NAME); });
test.after(() => db.close());
async function snapshot() { const hashes = {}; for (const model of Object.values(db.models)) hashes[model.name] = crypto.createHash("sha256").update(JSON.stringify((await model.findAll({ raw: true })).map(r => JSON.stringify(r)).sort())).digest("hex"); return hashes; }
async function actor(role, tenant) {
  const a = await m.TaiKhoan.create({ ten_dang_nhap: "kt13test" + (++seq), mat_khau: "KT13FixtureOnly!", vai_tro: role, trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  if (role === "CHU_TRO") await m.ChuTro.create({ ma_tai_khoan: a.ma_tai_khoan, ho_ten: "TEST OWNER", so_dien_thoai: "000000" + String(seq).padStart(5,"0") });
  if (tenant) await tenant.update({ ma_tai_khoan: a.ma_tai_khoan });
  const r = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ten_dang_nhap: a.ten_dang_nhap, mat_khau: "KT13FixtureOnly!" }) });
  assert.equal(r.response.status, 200, "Fixture login failed; response withheld"); return { account: a, token: r.body.data.token };
}
async function rental(owner, existingTenant = null) {
  const building = await m.CanTro.create({ ten_can: "TEST BUILDING", dia_chi: "TEST ONLY", trang_thai: "HOAT_DONG", ma_chu_tro: (await m.ChuTro.findOne({ where: { ma_tai_khoan: owner.account.ma_tai_khoan } })).ma_chu_tro });
  const room = await m.PhongTro.create({ ma_can: building.ma_can, so_phong: "TEST ROOM", dien_tich: 20, gia_thue: 1, so_nguoi_toi_da: 2, trang_thai: "DANG_THUE" });
  const tenant = existingTenant || await m.KhachThue.create({ ho_ten: "TEST TENANT", so_dien_thoai: "000000" + String(++seq).padStart(5,"0"), cccd_giay_to: "TESTDOC" + seq });
  const contract = await m.HopDong.create({ ma_phong: room.ma_phong, ma_khach_thue: tenant.ma_khach_thue, ngay_bat_dau: days(today,-10), ngay_ket_thuc: days(today,100), gia_thue: 1, don_gia_dien: 1, don_gia_nuoc: 1, dieu_khoan: "TEST", trang_thai: "DANG_HIEU_LUC" });
  await m.TienCoc.create({ ma_hop_dong: contract.ma_hop_dong, so_tien_coc: 1, ngay_nhan_coc: today, trang_thai: "DA_NHAN" });
  return { room, contract, tenant, ...(existingTenant ? {} : await actor("KHACH_THUE", tenant)) };
}
async function call(token, method, url, body, expected) {
  step = method + " " + url;
  const before = expected >= 400 || method === "GET" ? await snapshot() : null;
  const r = await request(url, { method, headers: headers(token), ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(r.response.status, expected, "HTTP mismatch; response withheld");
  if (before) assert.deepEqual(await snapshot(), before, "Denied/read request wrote DB");
  return r.body;
}
async function note(actor, content="KT13 TEST",extra={}){return m.ThongBao.create({ma_tai_khoan:actor.account.ma_tai_khoan,loai_thong_bao:"TEST",noi_dung:content,thoi_diem_tao:new Date("2026-01-01"),...extra});}
const dtoKeys=["da_doc","loai_thong_bao","ma_thong_bao","noi_dung","target","thoi_diem_tao"].sort();
async function fixture(){const oa=await actor("CHU_TRO"),ob=await actor("CHU_TRO");return{oa,ob,a:await rental(oa),b:await rental(oa),c:await rental(ob)};}
test("KT13 HTTP recipient scope pagination unread read-all and read idempotency preserve foreign data",async()=>{
 const {oa,ob,a,b}=await fixture(),entries=await Promise.all([note(a),note(a),note(a)]),other=await note(b),owner=await note(oa),foreignOwner=await note(ob);
 for(const u of [a,b,oa,ob]){const r=await call(u.token,"GET","/api/v1/notifications?limit=100",null,200),expected=u===a?entries:u===b?[other]:u===oa?[owner]:[foreignOwner];assert.equal(r.data.length,expected.length);assert.equal(r.data.every(x=>expected.some(n=>n.ma_thong_bao===x.ma_thong_bao)),true,"Recipient scope mismatch");assert.equal(r.data.every(x=>Object.keys(x).sort().join("|")===dtoKeys.join("|")),true);}
 const first=await call(a.token,"GET","/api/v1/notifications?limit=2&page=1",null,200),second=await call(a.token,"GET","/api/v1/notifications?limit=2&page=2",null,200);
 assert.equal(first.pagination.total,3);assert.equal(first.pagination.hasNext,true);assert.equal(second.pagination.hasNext,false);assert.equal(new Set([...first.data,...second.data].map(r=>r.ma_thong_bao)).size,3);
 assert.equal((await call(a.token,"GET","/api/v1/notifications/unread-count",null,200)).data.unreadCount,3);
 for(const query of ["userId="+b.account.ma_tai_khoan,"tenantId="+b.tenant.ma_khach_thue,"limit=101","page=0"])await call(a.token,"GET","/api/v1/notifications?"+query,null,400);
 const spoof=await request("/api/v1/notifications",{headers:headers(a.token,{"x-user-id":b.account.ma_tai_khoan,"tenantId":b.tenant.ma_khach_thue})});assert.equal(spoof.response.status,200);assert.equal(spoof.body.data.every(r=>entries.some(e=>e.ma_thong_bao===r.ma_thong_bao)),true);
 for(const [u,target] of [[a,other],[oa,foreignOwner],[oa,entries[0]],[a,owner]]){const cross=await call(u.token,"PATCH","/api/v1/notifications/"+target.ma_thong_bao+"/read",{},404),missing=await call(u.token,"PATCH","/api/v1/notifications/missing/read",{},404),absent=await call(u.token,"PATCH","/api/v1/notifications/read",{},404);assert.deepEqual(cross,missing);assert.deepEqual(absent,missing);assert.equal(cross.error.code,"RESOURCE_NOT_FOUND");}
 await call(a.token,"PATCH","/api/v1/notifications/"+entries[0].ma_thong_bao+"/read",{userId:b.account.ma_tai_khoan},400);
 const created=entries[0].thoi_diem_tao;await call(a.token,"PATCH","/api/v1/notifications/"+entries[0].ma_thong_bao+"/read",{},200);const once=await snapshot();await call(a.token,"PATCH","/api/v1/notifications/"+entries[0].ma_thong_bao+"/read",{},200);assert.deepEqual(await snapshot(),once);assert.equal((await entries[0].reload()).thoi_diem_tao.getTime(),created.getTime());
 assert.equal((await call(a.token,"GET","/api/v1/notifications/unread-count",null,200)).data.unreadCount,2);
 const marked=await call(a.token,"PATCH","/api/v1/notifications/read-all",{},200);assert.equal(marked.data.changed,2);assert.equal(marked.data.unreadCount,0);
 const allOnce=await snapshot();assert.equal((await call(a.token,"PATCH","/api/v1/notifications/read-all",{},200)).data.changed,0);assert.deepEqual(await snapshot(),allOnce);
 assert.equal((await other.reload()).da_doc,false);assert.equal((await foreignOwner.reload()).da_doc,false);
 await call(oa.token,"PATCH","/api/v1/notifications/"+owner.ma_thong_bao+"/read",{},200);assert.equal((await call(oa.token,"GET","/api/v1/notifications/unread-count",null,200)).data.unreadCount,0);
 const toHide=await note(oa,"KT13 HIDE",{khoa_su_kien:"KT13:HIDE:"+crypto.randomUUID()});
 assert.equal((await call(oa.token,"GET","/api/v1/notifications/unread-count",null,200)).data.unreadCount,1);
 const crossHide=await call(ob.token,"DELETE","/api/v1/notifications/"+toHide.ma_thong_bao,null,404);
 const missingHide=await call(ob.token,"DELETE","/api/v1/notifications/"+crypto.randomUUID(),null,404);
 assert.deepEqual(crossHide,missingHide);
 await call(a.token,"DELETE","/api/v1/notifications/"+toHide.ma_thong_bao,null,403);
 await call(oa.token,"DELETE","/api/v1/notifications/"+toHide.ma_thong_bao,null,200);
 assert.equal((await toHide.reload()).da_an,true);
 assert.equal((await call(oa.token,"GET","/api/v1/notifications",null,200)).data.some(row=>row.ma_thong_bao===toHide.ma_thong_bao),false);
 assert.equal((await call(oa.token,"GET","/api/v1/notifications/unread-count",null,200)).data.unreadCount,0);
 await call(oa.token,"DELETE","/api/v1/notifications/"+toHide.ma_thong_bao,null,200);
});
test("KT13 HTTP legacy whitelist private content verified targets and expired JWT",async()=>{
 const {oa,a,b}=await fixture(),privateText=["CCCD: TEST_IDENTITY_MARKER","ngày sinh: TEST_BIRTH_MARKER","địa chỉ: TEST_ADDRESS_MARKER","phone: TEST_CONTACT_MARKER"].join(";");
 await m.DanhMucSuCo.findOrCreate({where:{ma:"TEST"},defaults:{ten:"TEST CATEGORY",thu_tu:99}});
 const stored=await note(a,privateText,{khoa_su_kien:"TEST_INTERNAL_KEY"}),issue=await m.SuCo.create({ma_phong:a.room.ma_phong,ma_nguoi_gui:a.account.ma_tai_khoan,loai_su_co:"TEST",muc_do_uu_tien:"TRUNG_BINH",mo_ta:"TEST"});
 const target=await note(a,"TEST",{ma_su_co:issue.ma_su_co});await note(oa,"TEST",{ma_su_co:issue.ma_su_co});await note(b,"TEST",{ma_su_co:issue.ma_su_co});
 const result=await call(a.token,"GET","/api/v1/notifications",null,200),legacy=await call(a.token,"GET","/api/thong-bao",null,200);assert.deepEqual(result.data,legacy.data);
 const content=result.data.find(r=>r.ma_thong_bao===stored.ma_thong_bao).noi_dung;for(const marker of ["TEST_IDENTITY_MARKER","TEST_BIRTH_MARKER","TEST_ADDRESS_MARKER","TEST_CONTACT_MARKER"])assert.equal(content.includes(marker),false,"Private content leaked");
 assert.equal((await stored.reload()).noi_dung,privateText);
 assert.match(result.data.find(r=>r.ma_thong_bao===target.ma_thong_bao).target.route,/^\/tenant\/incidents\?incidentId=[0-9a-f-]{36}$/i);
 assert.match((await call(oa.token,"GET","/api/v1/notifications",null,200)).data[0].target.route,/^\/operations\/incidents\?incidentId=[0-9a-f-]{36}$/i);
 assert.equal((await call(b.token,"GET","/api/v1/notifications",null,200)).data[0].target,null);
 await call("INVALID_TEST_JWT","GET","/api/v1/notifications",null,401);await a.account.update({trang_thai:"DA_KHOA"});await call(a.token,"GET","/api/v1/notifications/unread-count",null,401);
});
