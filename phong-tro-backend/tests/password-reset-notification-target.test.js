const test = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/models");
const { ownerInboxItem } = require("../src/services/notification.service");

const requestId = "4dd9f7e9-b5b1-44aa-b7ca-dad6afea1243";
const tenantId = "c732ae12-5c22-45ac-9b72-65de4aa537ac";
const owner = { vai_tro: "CHU_TRO", ma_tai_khoan: "account-owner-7" };
const notice = {
  ma_tai_khoan: owner.ma_tai_khoan,
  loai_thong_bao: "YEU_CAU_DAT_LAI_MAT_KHAU",
  khoa_su_kien: `YEU_CAU_DAT_LAI_MAT_KHAU:${requestId}`,
  noi_dung: "Khách thuê gửi yêu cầu đặt lại mật khẩu",
};

test("password reset notice opens the exact tenant account after owner verification", async (t) => {
  t.mock.method(models.ChuTro, "findOne", async () => ({ ma_chu_tro: 3 }));
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: 11 }]);
  t.mock.method(models.YeuCau, "findByPk", async (id) => {
    assert.equal(id, requestId);
    return { loai_yeu_cau: "DAT_LAI_MAT_KHAU", ma_khach_thue: tenantId };
  });
  t.mock.method(models.HopDong, "findOne", async () => ({ phongTro: { ma_can: 11 } }));
  const item = await ownerInboxItem(owner, notice);
  assert.deepEqual(item.target, {
    route: `/residents-contracts/accounts?tenantId=${tenantId}`,
    resourceType: "tenantAccount",
    verified: true,
  });
});

test("password reset notice never links to another owner's account", async (t) => {
  t.mock.method(models.ChuTro, "findOne", async () => ({ ma_chu_tro: 3 }));
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: 11 }]);
  t.mock.method(models.YeuCau, "findByPk", async () => ({ loai_yeu_cau: "DAT_LAI_MAT_KHAU", ma_khach_thue: tenantId }));
  t.mock.method(models.HopDong, "findOne", async () => ({ phongTro: { ma_can: 12 } }));
  assert.equal((await ownerInboxItem(owner, notice)).target, undefined);
});

test("malformed keys and mismatched recipients do not resolve an account", async (t) => {
  t.mock.method(models.YeuCau, "findByPk", async () => assert.fail("request lookup must not run"));
  assert.equal((await ownerInboxItem(owner, { ...notice, khoa_su_kien: "YEU_CAU_DAT_LAI_MAT_KHAU:42" })).target, undefined);
  assert.equal((await ownerInboxItem(owner, { ...notice, ma_tai_khoan: "another-owner" })).target, undefined);
});
