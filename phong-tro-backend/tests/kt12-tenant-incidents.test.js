const test = require("node:test"), assert = require("node:assert/strict");
const service = require("../src/services/tenantIncident.service");
const valid = () => ({ contractId: "TEST", type: "TEST", priority: "TRUNG_BINH", description: "TEST DESCRIPTION" });
const png = () => Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1sAAAAASUVORK5CYII=", "base64");
test("KT12 tenant validation rejects scope financial fields URLs and malformed content", () => {
  assert.doesNotThrow(() => service.validate(valid()));
  for (const k of ["roomId", "tenantId", "status", "cost", "responsible", "imageUrl", "hinh_anh_url", "previousIncidentId"]) assert.throws(() => service.validate({ ...valid(), [k]: "TEST" }), { status: 400, code: "INCIDENT_FIELDS_FORBIDDEN" });
  for (const p of [{ type: "" }, { description: " " }, { priority: "INVALID" }, { description: "x".repeat(1001) }]) assert.throws(() => service.validate({ ...valid(), ...p }), { status: 400 });
  assert.throws(() => service.validate({ ...valid(), contractId: "" }), { code: "RESOURCE_NOT_FOUND" });
});
test("KT12 DTO whitelist excludes every financial staff and private field", () => {
  const raw = { ma_su_co: "TEST", trang_thai: "DA_XU_LY", mo_ta: "TEST", ket_qua_xu_ly: "TEST RESULT", chi_phi_sua_chua: 12, doi_tuong_chiu_phi: "KHACH_THUE", ghi_chu: "INTERNAL", ma_nguoi_gui: "OTHER", hinh_anh_url: "PRIVATE OS PATH", nguoi_tiep_nhan_id: "STAFF" };
  const dto = service.dto(raw);
  assert.deepEqual(Object.keys(dto).sort(), ["id","type","priority","description","status","submittedAt","updatedAt","acceptedAt","completedAt","roomName","buildingName","response","imageUrl","canEdit","canCancel"].sort());
  assert.equal(dto.response, "TEST RESULT"); assert.equal(dto.imageUrl.includes("PRIVATE"), false);
  assert.equal(JSON.stringify(dto).includes("INTERNAL"), false);
});
test("KT12 image bytes size extension and safe filenames are verified before IO", () => {
  const buffer = png(), policy = { maxBytes: 1024 }, file = { buffer, size: buffer.length, originalname: "TEST.png", mimetype: "image/png" };
  assert.equal(service.validateImage(file, policy).length, 64);
  for (const patch of [{ buffer: Buffer.alloc(buffer.length) }, { originalname: "TEST.jpg" }, { mimetype: "text/plain" }]) assert.throws(() => service.validateImage({ ...file, ...patch }, policy), { status: 415 });
  for (const originalname of ["../TEST.png", "..\\TEST.png", "C:\\TEST.png"]) assert.throws(() => service.validateImage({ ...file, originalname }, policy), { code: "INVALID_INCIDENT_FILENAME" });
  assert.throws(() => service.validateImage(file, { maxBytes: 1 }), { status: 413 });
  assert.equal(service.validateImage(null, policy), null);
});

// Real service/ownership functions, mocked model boundary only. No DB connection.
const models = require("../src/models"), db = require("../src/config/database");
const { getUploadContext } = require("../src/config/uploadFilesystem");
const user = { vai_tro: "KHACH_THUE", ma_tai_khoan: "SELF", ma_khach_thue: "SELF_TENANT" };
function boundary(t, { reporter = "SELF", status = "CHO_TIEP_NHAN", imagePath = null } = {}) {
  const originals = [], writes = { value: 0 };
  const patch = (object, key, value) => { originals.push([object,key,object[key]]);object[key]=value; };
  t.after(() => { for(const [o,k,v] of originals.reverse())o[k]=v; });
  patch(db,"transaction",async fn=>fn({LOCK:{UPDATE:"UPDATE"}}));
  patch(models.HopDong,"findAll",async options=>options.where.ma_khach_thue === "SELF_TENANT" ? [{ma_hop_dong:"OWN",ma_phong:"OWN_ROOM"}] : [{ma_hop_dong:"OWN",ma_phong:"OWN_ROOM"},{ma_hop_dong:"FOREIGN",ma_phong:"OTHER_ROOM"}]);
  const row={ma_su_co:"TEST",ma_phong:"OWN_ROOM",ma_nguoi_gui:reporter,trang_thai:status,da_xoa:false,mo_ta:"OLD",hinh_anh_url:imagePath,async update(p){writes.value++;Object.assign(this,p);return this;}};
  patch(models.SuCo,"findByPk",async()=>row);patch(models.SuCo,"findAll",async()=>[]);patch(models.SuCo,"findOne",async()=>null);
  patch(models.SuCo,"create",async values=>{writes.value++;return {...values,ma_su_co:"NEW"};});
  patch(models.PhongTro,"findByPk",async()=>({ma_phong:"OWN_ROOM",ma_can:"BUILDING"}));
  patch(models.CanTro,"findByPk",async()=>({ma_chu_tro:"OWNER"}));patch(models.ChuTro,"findByPk",async()=>({ma_tai_khoan:"OWNER"}));
  patch(models.DanhMucSuCo,"findOne",async()=>({ma:"TEST"}));patch(models.AuditLog,"create",async()=>{writes.value++;});patch(models.ThongBao,"create",async()=>{writes.value++;});
  return {row,writes};
}
test("KT12 JWT contract scope rejects a foreign contract before any mutation", async t => {
  const {writes}=boundary(t);
  await assert.rejects(service.mutate(user,{...valid(),contractId:"FOREIGN"}),{status:404,code:"RESOURCE_NOT_FOUND"});
  assert.equal(writes.value,0);
});
test("KT12 built-in category is created when an older database has no category rows", async t => {
  const { writes } = boundary(t);
  const original = models.DanhMucSuCo.findOne;
  const originalFindOrCreate = models.DanhMucSuCo.findOrCreate;
  models.DanhMucSuCo.findOne = async () => null;
  models.DanhMucSuCo.findOrCreate = async ({ defaults }) => [{ ...defaults, dang_hoat_dong: true }, true];
  t.after(() => { models.DanhMucSuCo.findOne = original; models.DanhMucSuCo.findOrCreate = originalFindOrCreate; });
  const result = await service.mutate(user, { ...valid(), contractId: "OWN", type: "THIET_BI" });
  assert.equal(result.incident.type, "THIET_BI");
  assert.equal(writes.value > 0, true);
});
test("KT12 incident request key returns one incident and rejects reuse for different content", async t => {
  const { writes } = boundary(t);
  let created = null;
  models.SuCo.findByPk = async id => created?.ma_su_co === id ? created : null;
  models.SuCo.create = async values => { writes.value++; created = { ...values, ma_su_co: values.ma_su_co || "NEW" }; return created; };
  const body = { ...valid(), contractId: "OWN" };
  const key = "incident-request-123";
  const first = await service.mutate(user, body, null, { idempotencyKey: key });
  assert.equal(first.incident.id, service.incidentIdForKey(user.ma_tai_khoan, key));
  assert.equal(first.duplicate, false);
  const afterFirst = writes.value;
  const retry = await service.mutate(user, body, null, { idempotencyKey: key });
  assert.equal(retry.incident.id, first.incident.id);
  assert.equal(retry.duplicate, true);
  assert.equal(writes.value, afterFirst);
  await assert.rejects(service.mutate(user, { ...body, description: "OTHER ISSUE" }, null, { idempotencyKey: key }), { status: 409, code: "IDEMPOTENCY_CONFLICT" });
  assert.equal(writes.value, afterFirst);
  await assert.rejects(service.mutate(user, body, null, { idempotencyKey: "bad" }), { status: 400, code: "INVALID_IDEMPOTENCY_KEY" });
  assert.notEqual(service.incidentIdForKey("OTHER", key), first.incident.id);
});
test("KT12 open incident of the same tenant room and type wins before any new write", async t => {
  const { row, writes } = boundary(t);
  row.ma_su_co="OPEN";row.loai_su_co="TEST";row.muc_do_uu_tien="TRUNG_BINH";
  models.SuCo.findByPk = async () => null;
  models.SuCo.findOne = async ({ where, lock }) => {
    assert.equal(lock,"UPDATE");
    return where.ma_nguoi_gui===user.ma_tai_khoan && where.ma_phong==="OWN_ROOM" && where.loai_su_co==="TEST" ? row : null;
  };
  const result=await service.mutate(user,{...valid(),contractId:"OWN",description:"ANOTHER DEVICE"},null,{idempotencyKey:"another-request-123"});
  assert.equal(result.duplicate,true);assert.equal(result.incident.id,"OPEN");assert.equal(writes.value,0);
});
test("KT12 tenant can append a note only while own incident is in progress", async t => {
  const { row, writes }=boundary(t,{status:"DANG_XU_LY"});
  await service.mutate(user,{additionalNote:"Thiết bị thứ hai cũng hỏng"},null,{id:"TEST"});
  assert.equal(row.mo_ta,"OLD\n\nBổ sung: Thiết bị thứ hai cũng hỏng");
  assert.equal(writes.value,2);
  await assert.rejects(service.mutate(user,{additionalNote:"x".repeat(1000)},null,{id:"TEST"}),{code:"INVALID_INCIDENT_NOTE"});
});
test("KT12 private image ownership rejects another reporter before file read", async t => {
  const upload=getUploadContext(), target=upload.resolve("incidents","TEST-private.png");
  boundary(t,{reporter:"OTHER",imagePath:target});
  await assert.rejects(service.image(user,"TEST",upload),{status:404,code:"RESOURCE_NOT_FOUND"});
});
test("KT12 edit and cancel recheck accepted state and never write audit on refusal", async t => {
  const {writes}=boundary(t,{status:"DANG_XU_LY"});
  const edit={type:"TEST",priority:"TRUNG_BINH",description:"TEST"};
  await assert.rejects(service.mutate(user,edit,null,{id:"TEST"}),{status:409,code:"INCIDENT_NOT_EDITABLE"});
  await assert.rejects(service.mutate(user,{},null,{id:"TEST",cancel:true}),{status:409,code:"INCIDENT_NOT_EDITABLE"});
  assert.equal(writes.value,0);
});
test("KT12 expired contract denies editing but retains own history permission", async t => {
  const {row,writes}=boundary(t);models.HopDong.findAll=async()=>[];
  await assert.rejects(service.mutate(user,{},null,{id:"TEST",cancel:true}),{status:409,code:"INCIDENT_NOT_EDITABLE"});
  const detail=await service.detail(user,"TEST");assert.equal(detail.id,row.ma_su_co);assert.equal(detail.canEdit,false);assert.equal(writes.value,0);
});
