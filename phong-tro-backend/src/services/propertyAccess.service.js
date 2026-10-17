const { ChuTro, CanTro, PhongTro } = require("../models");

async function assertLandlordOwnsRoom(user, roomId) {
  if (user?.vai_tro !== "CHU_TRO") throw { status: 403, code: "FORBIDDEN", message: "Chỉ Chủ trọ sở hữu được xem hồ sơ này" };
  const owner = await ChuTro.findOne({ where: { ma_tai_khoan: user.ma_tai_khoan }, attributes: ["ma_chu_tro"] });
  const room = await PhongTro.findByPk(roomId, { attributes: ["ma_phong", "ma_can", "so_nguoi_toi_da"] });
  const building = room && await CanTro.findByPk(room.ma_can, { attributes: ["ma_can", "ma_chu_tro"] });
  if (!owner || !building || building.ma_chu_tro !== owner.ma_chu_tro) throw { status: 403, code: "PROPERTY_ACCESS_DENIED", message: "Bạn không sở hữu căn trọ liên quan" };
  return { room, building, owner };
}

module.exports = { assertLandlordOwnsRoom };
