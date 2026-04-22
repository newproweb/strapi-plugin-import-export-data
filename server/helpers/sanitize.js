"use strict";

const { SYSTEM_FIELDS } = require("../constants/export");
const { isPasswordAttr, isRelationAttr } = require("./attr");

const relationToId = (value) => {
  if (Array.isArray(value)) {
    return value.map((v) => v?.documentId ?? v?.id ?? v).filter((v) => v !== undefined);
  }
  if (value && typeof value === "object") return value.documentId ?? value.id ?? null;
  return value;
};

const sanitizeEntry = (uid, entry, opts) => {
  const schema = strapi.contentTypes?.[uid];
  const out = {};

  for (const [name, value] of Object.entries(entry)) {
    if (SYSTEM_FIELDS.includes(name)) continue;

    const attr = schema?.attributes?.[name];
    if (attr && isPasswordAttr(attr)) continue;

    if (attr && isRelationAttr(attr) && opts.relationsAsId) {
      out[name] = relationToId(value);
      continue;
    }

    if (attr && isRelationAttr(attr) && value && typeof value === "object") {
      out[name] = sanitize(attr.target, value, { ...opts, depth: opts.depth - 1 });
      continue;
    }

    out[name] = value;
  }
  return out;
};

function sanitize(uid, entry, { relationsAsId = false, depth = 5 } = {}) {
  if (!entry || typeof entry !== "object" || depth <= 0) return entry;
  if (Array.isArray(entry)) {
    return entry.map((e) => sanitize(uid, e, { relationsAsId, depth }));
  }
  return sanitizeEntry(uid, entry, { relationsAsId, depth });
}

module.exports = { sanitize };
