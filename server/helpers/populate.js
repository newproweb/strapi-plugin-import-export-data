"use strict";

const {
  isPasswordAttr,
  isRelationAttr,
  isMediaAttr,
  isComponentAttr,
  isDynamicZoneAttr,
} = require("./attr");

const isApiRelation = (attr) => attr?.target?.startsWith("api::");

const walk = (uid, level, exportPluginsContentTypes) => {
  if (level <= 0) return true;

  const schema = strapi.contentTypes?.[uid];
  if (!schema) return true;

  const populate = {};
  for (const [name, attr] of Object.entries(schema.attributes || {})) {
    if (isPasswordAttr(attr)) continue;

    if (isMediaAttr(attr)) {
      populate[name] = true;
      continue;
    }

    if (isRelationAttr(attr)) {
      if (!exportPluginsContentTypes && attr.target && !isApiRelation(attr)) {
        populate[name] = true;
        continue;
      }
      const nested = walk(attr.target, level - 1, exportPluginsContentTypes);
      populate[name] = nested === true ? true : { populate: nested };
      continue;
    }

    if (isComponentAttr(attr)) {
      populate[name] = { populate: "*" };
      continue;
    }

    if (isDynamicZoneAttr(attr)) {
      populate[name] = { populate: "*" };
    }
  }

  return Object.keys(populate).length ? populate : true;
};

const buildPopulate = (uid, { deepness = 2, exportPluginsContentTypes = false } = {}) => {
  if (!strapi.contentTypes?.[uid]) return undefined;
  const populate = walk(uid, deepness, exportPluginsContentTypes);
  return populate === true ? undefined : populate;
};

module.exports = { buildPopulate };
