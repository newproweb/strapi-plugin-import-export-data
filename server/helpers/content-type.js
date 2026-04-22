"use strict";

const resolveSchema = (uid) => {
  const schema = strapi.contentTypes?.[uid];
  if (!schema) throw new Error(`Unknown collection ${uid}`);
  return schema;
};

module.exports = { resolveSchema };
