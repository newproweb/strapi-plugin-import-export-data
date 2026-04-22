"use strict";

const { BATCH } = require("../constants/export");

const fetchAll = async (uid, findOpts) => {
  const all = [];
  let start = 0;
  while (true) {
    const batch = await strapi.documents(uid).findMany({ ...findOpts, limit: BATCH, start });
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < BATCH) break;
    start += BATCH;
  }
  return all;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

module.exports = { fetchAll, clamp };
