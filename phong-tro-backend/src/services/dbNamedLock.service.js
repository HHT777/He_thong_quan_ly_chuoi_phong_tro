const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

async function withNamedLock(name, work) {
  return sequelize.transaction(async (transaction) => {
    const rows = await sequelize.query("SELECT GET_LOCK(:name, 0) AS acquired", { replacements: { name }, type: QueryTypes.SELECT, transaction });
    if (Number(rows[0]?.acquired) !== 1) return { lockAcquired: false };
    try { return await work(); }
    finally { await sequelize.query("SELECT RELEASE_LOCK(:name)", { replacements: { name }, type: QueryTypes.SELECT, transaction }); }
  });
}

module.exports = { withNamedLock };
