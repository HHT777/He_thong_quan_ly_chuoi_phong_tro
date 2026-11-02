const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto"), fs = require("node:fs"), path = require("node:path");
const db = require("../src/config/database"), m = require("../src/models");
const service = require("../src/services/tenantIncident.service"), notices = require("../src/services/notification.service");
const { businessDate, addBusinessDays: days } = require("../src/utils/businessDate.util");
const mysql = require("mysql2/promise");
const { approvedDisposableTarget } = require("../src/config/testDatabaseSafety");
const { request, headers } = require("./helpers/integration-api");
const base = process.env.TEST_BASE_URL, today = businessDate(); let seq = 0, step = "setup";
test.after(() => db.close());
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1sAAAAASUVORK5CYII=", "base64");
function tenantDto(value) {
  const allowed = new Set(["id","type","priority","description","status","submittedAt","updatedAt","acceptedAt","completedAt","roomName","buildingName","response","imageUrl","canEdit","canCancel"]);
  assert.equal(Boolean(value) && Object.keys(value).every(key=>allowed.has(key)), true, "HTTP DTO contains fields outside tenant whitelist");
}
async function snapshot() { const hashes = {}; for (const model of Object.values(db.models)) hashes[model.name] = crypto.createHash("sha256").update(JSON.stringify((await model.findAll({ raw: true })).map(r => JSON.stringify(r)).sort())).digest("hex"); return hashes; }
async function actor(role, tenant) {
  const a = await m.TaiKhoan.create({ ten_dang_nhap: "kt12test" + (++seq), mat_khau: "KT12FixtureOnly!", vai_tro: role, trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  if (role === "CHU_TRO") await m.ChuTro.create({ ma_tai_khoan: a.ma_tai_khoan, ho_ten: "TEST OWNER", so_dien_thoai: "000000" + String(seq).padStart(5,"0") });
  if (tenant) await tenant.update({ ma_tai_khoan: a.ma_tai_khoan });
  const r = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ten_dang_nhap: a.ten_dang_nhap, mat_khau: "KT12FixtureOnly!" }) });
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
async function multipart(token, body, buffer = png, name = "TEST.png", mime = "image/png", method = "POST", id = "") {
  const form = new FormData(); for (const [k,v] of Object.entries(body)) form.set(k, v); form.set("file", new Blob([buffer], { type: mime }), name);
  const response = await fetch(base + "/api/v1/incidents" + (id ? "/"+id : ""), { method, headers: { Authorization: "Bearer " + token }, body: form });
  return { status: response.status, body: await response.json() };
}
test("KT12 HTTP incident scope private multipart edit cancel race migration and owner regression", async () => {
  let migration;
  try {
    step = "migration";
    const target = approvedDisposableTarget(process.env, process.env.DB_NAME);
    migration = await mysql.createConnection({ host: target.host, port: target.port, database: target.database, user: process.env.DB_USER, password: process.env.DB_PASSWORD, multipleStatements: true });
    const sql = fs.readFileSync(path.join(__dirname,"../migrations/019_incident_cancel_status.sql"),"utf8"), rollback = fs.readFileSync(path.join(__dirname,"../migrations/rollback/019_incident_cancel_status.sql"),"utf8");
    await migration.query(sql); await migration.query(sql); await migration.query(rollback); await migration.query(sql);
    const [[count]] = await db.query("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'"); assert.equal(Number(count.n),39);
    const oa = await actor("CHU_TRO"), ob = await actor("CHU_TRO"), a = await rental(oa), b = await rental(oa), c = await rental(ob);
    await m.DanhMucSuCo.findOrCreate({ where: { ma: "KT12TEST" }, defaults: { ten: "TEST CATEGORY", thu_tu: 99 } });
    const body = { contractId: a.contract.ma_hop_dong, type: "KT12TEST", priority: "TRUNG_BINH", description: "TEST INCIDENT" };
    await call(oa.token,"GET","/api/v1/me/incident-context",null,403);
    const context = await call(a.token,"GET","/api/v1/me/incident-context",null,200); assert.equal(context.data.contracts.length,1);
    const otherRental=await rental(ob,a.tenant);
    assert.equal((await call(a.token,"GET","/api/v1/me/incident-context",null,200)).data.contracts.length,2);
    await call("INVALID_TEST_JWT","GET","/api/v1/incidents",null,401);
    for (const contractId of [b.contract.ma_hop_dong,c.contract.ma_hop_dong,crypto.randomUUID(),""]) assert.equal((await call(a.token,"POST","/api/v1/incidents",{...body,contractId},404)).error.code,"RESOURCE_NOT_FOUND");
    for (const key of ["roomId","tenantId","status","cost","responsible","imageUrl"]) await call(a.token,"POST","/api/v1/incidents",{...body,[key]:"TEST"},400);
    step = "duplicate race";
    const race = await Promise.all([1,2].map(()=>request("/api/v1/incidents", {method:"POST",headers:headers(a.token),body:JSON.stringify(body)})));
    assert.deepEqual(race.map(r=>r.response.status).sort(),[200,201]); assert.equal(await m.SuCo.count({where:{ma_nguoi_gui:a.account.ma_tai_khoan}}),1);
    const id = race.find(r=>r.response.status===201).body.data.id;
    for(const result of race)tenantDto(result.body.data);
    assert.equal(await m.ThongBao.count({where:{ma_tai_khoan:oa.account.ma_tai_khoan,ma_su_co:id}}),1); assert.equal(await m.ThongBao.count({where:{ma_tai_khoan:ob.account.ma_tai_khoan,ma_su_co:id}}),0);
    const ownerNotices = await call(oa.token,"GET","/api/v1/notifications",null,200);
    const incidentNotice = ownerNotices.data.find(row => row.loai_thong_bao === "SU_CO_MOI");
    assert.equal(incidentNotice?.target?.route, `/operations/incidents?incidentId=${id}`);
    step = "idempotency key race";
    const keyedBody = { ...body, description: "TEST KEYED INCIDENT" }, requestKey = crypto.randomUUID();
    const keyedRace = await Promise.all([1, 2].map(() => request("/api/v1/incidents", {
      method: "POST", headers: headers(a.token, { "Idempotency-Key": requestKey }), body: JSON.stringify(keyedBody),
    })));
    assert.deepEqual(keyedRace.map(result => result.response.status).sort(), [200, 201]);
    const keyedId = keyedRace[0].body.data.id;
    assert.equal(keyedRace[1].body.data.id, keyedId);
    assert.equal(await m.SuCo.count({ where: { ma_su_co: keyedId } }), 1);
    assert.equal(await m.ThongBao.count({ where: { ma_tai_khoan: oa.account.ma_tai_khoan, ma_su_co: keyedId } }), 1);
    const conflict = await request("/api/v1/incidents", { method: "POST", headers: headers(a.token, { "Idempotency-Key": requestKey }), body: JSON.stringify({ ...keyedBody, description: "OTHER CONTENT" }) });
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.body.error.code, "IDEMPOTENCY_CONFLICT");
    const duplicateType = await request("/api/v1/incidents", { method: "POST", headers: headers(a.token, { "Idempotency-Key": crypto.randomUUID() }), body: JSON.stringify({ ...body, description: "DIFFERENT DEVICE" }) });
    assert.equal(duplicateType.response.status, 200);
    assert.equal(duplicateType.body.duplicate, true);
    assert.equal(duplicateType.body.data.id, id);
    assert.equal(await m.ThongBao.count({ where: { ma_tai_khoan: oa.account.ma_tai_khoan, ma_su_co: id } }), 1);
    const otherRoom = await request("/api/v1/incidents", { method: "POST", headers: headers(a.token, { "Idempotency-Key": crypto.randomUUID() }), body: JSON.stringify({ ...body, contractId: otherRental.contract.ma_hop_dong }) });
    assert.equal(otherRoom.response.status, 201);
    step = "same-type concurrent tabs";
    const otherType = { ...body, type: "THIET_BI" };
    const typeRace = await Promise.all(["ONE", "TWO"].map(description => request("/api/v1/incidents", { method: "POST", headers: headers(a.token, { "Idempotency-Key": crypto.randomUUID() }), body: JSON.stringify({ ...otherType, description }) })));
    assert.deepEqual(typeRace.map(result => result.response.status).sort(), [200, 201]);
    const typeId = typeRace[0].body.data.id;
    assert.equal(typeRace[1].body.data.id, typeId);
    assert.equal(await m.ThongBao.count({ where: { ma_tai_khoan: oa.account.ma_tai_khoan, ma_su_co: typeId } }), 1);
    await call(a.token,"DELETE","/api/v1/incidents/"+typeId,null,200);
    const afterCancel = await request("/api/v1/incidents", { method: "POST", headers: headers(a.token, { "Idempotency-Key": crypto.randomUUID() }), body: JSON.stringify({ ...otherType, description: "AFTER CANCEL" }) });
    assert.equal(afterCancel.response.status, 201);
    await m.SuCo.update({ trang_thai: "DA_XU_LY", ngay_hoan_tat: new Date() }, { where: { ma_su_co: afterCancel.body.data.id } });
    const afterComplete = await request("/api/v1/incidents", { method: "POST", headers: headers(a.token, { "Idempotency-Key": crypto.randomUUID() }), body: JSON.stringify({ ...otherType, description: "AFTER COMPLETE" }) });
    assert.equal(afterComplete.response.status, 201);
    for (const token of [b.token,c.token,ob.token]) for (const suffix of ["","/image"]) assert.equal((await call(token,"GET","/api/v1/incidents/"+id+suffix,null,404)).error.code,"RESOURCE_NOT_FOUND");
    const edited = await call(a.token,"PATCH","/api/v1/incidents/"+id,{type:body.type,priority:body.priority,description:"TEST EDIT"},200); assert.equal(edited.data.description,"TEST EDIT");
    await call(b.token,"PATCH","/api/v1/incidents/"+id,{type:body.type,priority:body.priority,description:"DENIED"},404);
    await call(b.token,"DELETE","/api/v1/incidents/"+id,null,404);
    const foreignIncident = await call(c.token,"POST","/api/v1/incidents",{...body,contractId:c.contract.ma_hop_dong},201);
    await call(oa.token,"PATCH","/api/v1/incidents/"+foreignIncident.data.id,{status:"DANG_XU_LY"},404);
    await call(oa.token,"DELETE","/api/v1/incidents/"+foreignIncident.data.id,{reason:"TEST"},404);
    const deniedBefore = await snapshot();
    for (const input of [[Buffer.alloc(64),"TEST.png","image/png",415],[png,"TEST.jpg","image/jpeg",415],[png,"../TEST.png","image/png",400],[Buffer.alloc(10*1024*1024+1),"TEST.png","image/png",413]]) assert.equal((await multipart(a.token,{...body,description:"INVALID"},...input.slice(0,3))).status,input[3]);
    assert.deepEqual(await snapshot(),deniedBefore);
    step = "valid multipart";
    const uploaded = await multipart(a.token,{...body,description:"TEST IMAGE"}); assert.equal(uploaded.status,201); const imageId=uploaded.body.data.id;
    const imageRow=await m.SuCo.findByPk(imageId); assert.equal(imageRow.hinh_anh_url.startsWith(process.env.UPLOAD_DIR+path.sep),true); assert.equal(fs.existsSync(imageRow.hinh_anh_url),true);
    for(const token of [a.token,oa.token]) assert.equal((await fetch(base+"/api/v1/incidents/"+imageId+"/image",{headers:{Authorization:"Bearer "+token}})).status,200);
    for(const token of [b.token,c.token,ob.token]) await call(token,"GET","/api/v1/incidents/"+imageId+"/image",null,404);
    const replaced=await multipart(a.token,{type:body.type,priority:body.priority,description:"TEST REPLACE"},png,"TEST.png","image/png","PATCH",imageId); assert.equal(replaced.status,200); assert.equal(fs.existsSync(imageRow.hinh_anh_url),true);
    const upload = require("../src/config/uploadFilesystem").getUploadContext();
    upload.mkdir(upload.resolve("meter")); const old = new Date(Date.now()-3600000);upload.utimes(imageRow.hinh_anh_url,old,old);
    await require("../src/services/meterReading.service").cleanupExpiredUploads(Date.now(),upload);
    assert.equal(upload.exists(imageRow.hinh_anh_url),true);
    await call(oa.token,"PATCH","/api/v1/incidents/"+imageId,{status:"DANG_XU_LY"},200);
    await call(a.token,"PATCH","/api/v1/incidents/"+imageId,{type:body.type,priority:body.priority,description:"LATE"},409); await call(a.token,"DELETE","/api/v1/incidents/"+imageId,null,409);
    await call(oa.token,"PATCH","/api/v1/incidents/"+imageId,{status:"DA_XU_LY",responsible:"CHU_TRO",cost:0,note:"TEST PUBLIC RESULT"},200);
    const done=await call(a.token,"GET","/api/v1/incidents/"+imageId,null,200); assert.equal(done.data.response,"TEST PUBLIC RESULT"); assert.equal(Object.hasOwn(done.data,"chi_phi_sua_chua"),false); assert.equal(Object.hasOwn(done.data,"doi_tuong_chiu_phi"),false);
    tenantDto(done.data);for(const item of (await call(a.token,"GET","/api/v1/incidents",null,200)).data)tenantDto(item);
    const cancelled=await call(a.token,"DELETE","/api/v1/incidents/"+id,null,200); assert.equal(cancelled.data.status,"DA_HUY"); assert.equal((await m.SuCo.findByPk(id)).da_xoa,false);
    await call(a.token,"DELETE","/api/v1/incidents/"+id,null,409); await call(oa.token,"PATCH","/api/v1/incidents/"+id,{status:"DANG_XU_LY"},409);
    const ownerList=await call(oa.token,"GET","/api/v1/incidents",null,200); assert.equal(ownerList.data.some(r=>r.ma_su_co===id),false);
    const cancelledList=await call(oa.token,"GET","/api/v1/incidents?status=DA_HUY",null,200);assert.equal(cancelledList.data.some(r=>r.ma_su_co===id),true);
    const otherCancelled=await call(ob.token,"GET","/api/v1/incidents?status=DA_HUY",null,200);assert.equal(otherCancelled.data.some(r=>r.ma_su_co===id),false);
    await call(a.token,"POST","/api/su-co",{roomId:c.room.ma_phong},400); await call(oa.token,"POST","/api/su-co",{},403);
    await call(a.token,"POST","/api/su-co",{contractId:a.contract.ma_hop_dong,loai_su_co:body.type,muc_do_uu_tien:body.priority,noi_dung:"TEST LEGACY"},201);
    const raceRow = await call(a.token,"POST","/api/v1/incidents",{...body,description:"TEST CANCEL ACCEPT RACE"},201);
    const transitions=await Promise.all([
      request("/api/v1/incidents/"+raceRow.data.id,{method:"DELETE",headers:headers(a.token)}),
      request("/api/v1/incidents/"+raceRow.data.id,{method:"PATCH",headers:headers(oa.token),body:JSON.stringify({status:"DANG_XU_LY"})})
    ]);
    assert.deepEqual(transitions.map(r=>r.response.status).sort(),[200,409]);
    const editRace = await call(a.token,"POST","/api/v1/incidents",{...body,description:"TEST EDIT ACCEPT RACE"},201);
    const [editResult, acceptResult] = await Promise.all([
      request("/api/v1/incidents/"+editRace.data.id,{method:"PATCH",headers:headers(a.token),body:JSON.stringify({type:body.type,priority:body.priority,description:"TEST CONCURRENT EDIT"})}),
      request("/api/v1/incidents/"+editRace.data.id,{method:"PATCH",headers:headers(oa.token),body:JSON.stringify({status:"DANG_XU_LY"})})
    ]);
    assert.equal(acceptResult.response.status,200);
    assert.equal([200,409].includes(editResult.response.status),true);
    const afterEditRace = await m.SuCo.findByPk(editRace.data.id);
    assert.equal(afterEditRace.trang_thai,"DANG_XU_LY");
    if(editResult.response.status===200)assert.equal(afterEditRace.mo_ta,"TEST CONCURRENT EDIT");
    const privateUser={ma_tai_khoan:a.account.ma_tai_khoan,ma_khach_thue:a.tenant.ma_khach_thue,vai_tro:"KHACH_THUE"};
    const original=notices.createIdempotent;notices.createIdempotent=async()=>{throw Error("TEST PRIVATE ERROR")}; const oldLog=console.error,logs=[];console.error=(...args)=>logs.push(args);try{await service.mutate(privateUser,{...body,description:"TEST NOTICE FAILURE"});assert.equal(logs.flat().join(" "),"[INCIDENT_NOTICE_FAILED]");}finally{console.error=oldLog;notices.createIdempotent=original;}
    await a.contract.update({trang_thai:"HET_HAN",ngay_ket_thuc:days(today,-1)});
    await call(a.token,"GET","/api/v1/incidents/"+id,null,200);
    const pending=await m.SuCo.findOne({where:{ma_nguoi_gui:a.account.ma_tai_khoan,trang_thai:"CHO_TIEP_NHAN"}}); await call(a.token,"DELETE","/api/v1/incidents/"+pending.ma_su_co,null,409);
    step="rollback refuses cancelled history"; const before=await snapshot(); await assert.rejects(migration.query(rollback)); assert.deepEqual(await snapshot(),before);
    const [checks]=await migration.query("SELECT CHECK_CLAUSE FROM information_schema.check_constraints WHERE constraint_schema=DATABASE() AND constraint_name='ck_SuCo_1'");assert.equal(checks[0].CHECK_CLAUSE.includes("DA_HUY"),true);await migration.query(sql);
    await assert.rejects(db.query("UPDATE SuCo SET trangThai='INVALID' WHERE maSuCo=:id",{replacements:{id}}));
  } catch(error) { if(error.code==='ERR_ASSERTION')throw error; throw Error("KT12 fixture failed at "+step+"; private SQL/response withheld ("+(error.code||error.name)+")"); }
  finally { await migration?.end(); }
});
