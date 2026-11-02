const { assertOwned, getLandlordProfile } = require("./ownership.service");
const { CanTro } = require("../models");

async function assertLandlordOwnsRoom(user, roomId, transaction) {
  if (user?.vai_tro !== "CHU_TRO") throw { status: 403, code: "FORBIDDEN", message: "Chỉ Chủ trọ sở hữu được xem hồ sơ này" };
  const room = await assertOwned(user, "room", roomId, { transaction });
  const owner = await getLandlordProfile(user, transaction);
  const building = await CanTro.findByPk(room.ma_can, { attributes: ["ma_can", "ma_chu_tro"], transaction });
  return { room, building, owner };
}

module.exports = { assertLandlordOwnsRoom };
