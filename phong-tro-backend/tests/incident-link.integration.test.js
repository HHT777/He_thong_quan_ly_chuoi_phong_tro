const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { TaiKhoan, ChuTro, SuCo, KhoanChi, AuditLog } = require("../src/models");
const incidentService = require("../src/services/incident.service");
const { integration, request, headers, login, createBaseRental } = require("./helpers/integration-api");

test("FR-192 creation-only incident link enforces owner, room, completion and immutable old expense", async () => {
  const tokenA = await login(integration.landlord);
  const tokenTenant = await login(integration.tenant);
  const accountB = await TaiKhoan.create({ ten_dang_nhap: `g2owner${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("g2-owner-test1", 10), vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "G2 owner B", so_dien_thoai: "0987654320" });
  const tokenB = jwt.sign({ ma_tai_khoan: accountB.ma_tai_khoan, ten_dang_nhap: accountB.ten_dang_nhap, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const post = (token, body) => request("/api/v1/incidents", { method: "POST", headers: headers(token), body: JSON.stringify(body) });
  const patch = (token, id, body) => request(`/api/v1/incidents/${id}`, { method: "PATCH", headers: headers(token), body: JSON.stringify(body) });
  const unlink = (token, id) => request(`/api/v1/incidents/${id}/previous`, { method: "DELETE", headers: headers(token) });
  try {
    const a = await createBaseRental(tokenA, "g2-a");
    const aOther = await createBaseRental(tokenA, "g2-a-other");
    const b = await createBaseRental(tokenB, "g2-b");
    const body = (roomId, previousIncidentId) => ({ roomId, type: "KHAC", priority: "TRUNG_BINH", description: "Incident G2", ...(previousIncidentId ? { previousIncidentId } : {}) });
    const old = await post(tokenA, body(a.room.ma_phong));
    assert.equal(old.response.status, 201, JSON.stringify(old.body));
    const oldId = old.body.data.ma_su_co;
    assert.equal((await patch(tokenA, oldId, { status: "DA_XU_LY", responsible: "CHU_TRO", cost: 123000, note: "Repaired" })).response.status, 200);
    const oldCost = await KhoanChi.findOne({ where: { ma_su_co: oldId } });
    assert.equal(Number(oldCost.so_tien), 123000);

    const incidentB = await post(tokenB, body(b.room.ma_phong));
    assert.equal(incidentB.response.status, 201);
    assert.equal((await patch(tokenA, incidentB.body.data.ma_su_co, { previousIncidentId: oldId })).response.status, 404);
    assert.equal((await request(`/api/v1/incidents/${incidentB.body.data.ma_su_co}`, { method: "DELETE", headers: headers(tokenA), body: JSON.stringify({}) })).response.status, 404);

    const foreign = await post(tokenB, body(b.room.ma_phong, oldId));
    assert.equal(foreign.response.status, 404);
    assert.equal(foreign.body.error.code, "RESOURCE_NOT_FOUND");
    const wrongRoom = await post(tokenA, body(aOther.room.ma_phong, oldId));
    assert.equal(wrongRoom.response.status, 422);
    assert.equal(wrongRoom.body.error.code, "INCIDENT_PREVIOUS_ROOM_MISMATCH");
    assert.equal((await post(tokenTenant, body(a.room.ma_phong, oldId))).response.status, 403);
    const commonArea = await post(tokenA, { previousIncidentId: oldId, description: "Common area" });
    assert.equal(commonArea.response.status, 422);
    assert.equal(commonArea.body.error.code, "INCIDENT_COMMON_AREA_LINK_UNSUPPORTED");
    const pending = await post(tokenA, body(a.room.ma_phong));
    assert.equal(pending.response.status, 201);
    assert.equal((await post(tokenA, body(a.room.ma_phong, pending.body.data.ma_su_co))).response.status, 409);

    const [first, second] = await Promise.all([post(tokenA, body(a.room.ma_phong, oldId)), post(tokenA, body(a.room.ma_phong, oldId))]);
    assert.equal(first.response.status, 201, JSON.stringify(first.body));
    assert.equal(second.response.status, 201, JSON.stringify(second.body));
    const firstId = first.body.data.ma_su_co;
    const secondId = second.body.data.ma_su_co;
    assert.notEqual(firstId, secondId);
    assert.equal(first.body.data.ma_su_co_truoc, oldId);
    assert.equal(second.body.data.ma_su_co_truoc, oldId);
    const [raceA, raceB] = await Promise.all([
      patch(tokenA, firstId, { previousIncidentId: secondId }),
      patch(tokenA, secondId, { previousIncidentId: firstId }),
    ]);
    assert.equal(raceA.response.status, 409);
    assert.equal(raceB.response.status, 409);
    assert.equal((await SuCo.findByPk(firstId)).ma_su_co_truoc, oldId);
    assert.equal((await SuCo.findByPk(secondId)).ma_su_co_truoc, oldId);
    const foreignUnlink = await unlink(tokenB, firstId);
    const missingUnlink = await unlink(tokenA, crypto.randomUUID());
    assert.equal(foreignUnlink.response.status, 404);
    assert.equal(missingUnlink.response.status, 404);
    assert.equal(foreignUnlink.body.error.code, "RESOURCE_NOT_FOUND");
    assert.equal(missingUnlink.body.error.code, foreignUnlink.body.error.code);
    assert.equal((await unlink(tokenTenant, firstId)).response.status, 403);
    assert.equal((await patch(tokenA, firstId, { previousIncidentId: secondId })).response.status, 409);
    assert.equal((await patch(tokenA, firstId, { maSuCoTruoc: secondId })).response.status, 409);
    assert.equal((await unlink(tokenA, firstId)).response.status, 200);
    assert.equal((await SuCo.findByPk(firstId)).ma_su_co_truoc, null);
    assert.equal((await unlink(tokenA, firstId)).response.status, 409);
    assert.equal((await patch(tokenA, secondId, { status: "DA_XU_LY", responsible: "CHU_TRO", cost: 0, note: "Done" })).response.status, 200);
    assert.equal((await unlink(tokenA, secondId)).response.status, 409);
    assert.equal(Number((await KhoanChi.findOne({ where: { ma_su_co: oldId } })).so_tien), 123000);
    assert.equal(await AuditLog.count({ where: { action: "INCIDENT_CREATED", entity_id: firstId } }), 1);
    assert.equal(await AuditLog.count({ where: { action: "INCIDENT_PREVIOUS_UNLINKED", entity_id: firstId } }), 1);
    let chainTail = secondId;
    for (let step = 0; step < 8; step += 1) {
      const child = await post(tokenA, body(a.room.ma_phong, chainTail));
      assert.equal(child.response.status, 201, JSON.stringify(child.body));
      assert.equal(child.body.data.ma_su_co_truoc, chainTail);
      chainTail = child.body.data.ma_su_co;
      if (step < 7) assert.equal((await patch(tokenA, chainTail, { status: "DA_XU_LY", responsible: "CHU_TRO", cost: 0, note: "Chain" })).response.status, 200);
    }
    const accountA = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
    await SuCo.update({ ma_su_co_truoc: chainTail }, { where: { ma_su_co: oldId } }); // Corrupt-chain fixture, test DB only.
    try {
      await assert.rejects(
        incidentService.validatePreviousIncident(secondId, a.room.ma_phong, chainTail, { ma_tai_khoan: accountA.ma_tai_khoan, vai_tro: "CHU_TRO" }),
        { code: "INCIDENT_LINK_CYCLE" },
      );
    } finally {
      await SuCo.update({ ma_su_co_truoc: null }, { where: { ma_su_co: oldId } });
    }
    const beforeFailedAudit = await SuCo.count({ where: { ma_phong: a.room.ma_phong } });
    const originalAuditCreate = AuditLog.create;
    AuditLog.create = async () => { throw new Error("G2 audit injection"); };
    try {
      await assert.rejects(
        incidentService.create(body(a.room.ma_phong, oldId), { ma_tai_khoan: accountA.ma_tai_khoan, vai_tro: "CHU_TRO" }),
        /G2 audit injection/,
      );
    } finally { AuditLog.create = originalAuditCreate; }
    assert.equal(await SuCo.count({ where: { ma_phong: a.room.ma_phong } }), beforeFailedAudit, "failed audit must roll back incident creation");
    const listB = await request("/api/v1/incidents", { headers: headers(tokenB) });
    assert.equal(listB.response.status, 200);
    assert.ok(!listB.body.data.some((row) => row.ma_su_co === oldId || row.ma_su_co === firstId));
    await assert.rejects(incidentService.validatePreviousIncident(oldId, a.room.ma_phong, oldId, { ma_tai_khoan: accountB.ma_tai_khoan, vai_tro: "CHU_TRO" }), { code: "INCIDENT_LINK_CYCLE" });
  } finally {
    await accountB.update({ trang_thai: "DA_KHOA" });
  }
});
