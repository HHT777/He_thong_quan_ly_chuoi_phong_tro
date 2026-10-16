const { ThongBao } = require("../models");

function isDuplicate(error) {
  return error?.original?.code === "ER_DUP_ENTRY" || error?.parent?.code === "ER_DUP_ENTRY" || error?.code === "ER_DUP_ENTRY";
}

async function createIdempotent(values, { transaction } = {}) {
  try {
    return { created: true, row: await ThongBao.create(values, transaction ? { transaction } : undefined) };
  } catch (error) {
    if (values.khoa_su_kien && isDuplicate(error)) return { created: false, row: null };
    throw error;
  }
}

module.exports = { createIdempotent, isDuplicate };
