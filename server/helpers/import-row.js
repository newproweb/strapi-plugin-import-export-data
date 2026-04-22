"use strict";

const { IMMUTABLE_FIELDS } = require("../constants/import");

const coerceInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const coerceFloat = (value) => {
  const n = typeof value === "string" ? parseFloat(value.replace(",", ".")) : Number(value);
  return Number.isFinite(n) ? n : null;
};

const coerceBool = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "y"].includes(value.toLowerCase());
  return Boolean(value);
};

const coerceJson = (value) => {
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return value; }
};

const coerceDate = (value) => (value instanceof Date ? value.toISOString() : value);

const coerceValue = (attr, value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (!attr) return value;

  switch (attr.type) {
    case "integer":
    case "biginteger":
      return coerceInt(value);
    case "float":
    case "decimal":
      return coerceFloat(value);
    case "boolean":
      return coerceBool(value);
    case "json":
      return coerceJson(value);
    case "datetime":
    case "date":
    case "time":
      return coerceDate(value);
    default:
      return typeof value === "object" ? JSON.stringify(value) : value;
  }
};

const shapeForUid = (uid, row) => {
  const attrs = strapi.contentTypes?.[uid]?.attributes || {};
  const shaped = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (IMMUTABLE_FIELDS.has(key)) continue;
    if (!attrs[key]) continue;
    shaped[key] = coerceValue(attrs[key], value);
  }
  return shaped;
};

const isEmptyKey = (value) => value === undefined || value === null || value === "";

const findByDocumentId = (uid, documentId) => strapi.documents(uid).findOne({ documentId });

const findById = async (uid, id) => {
  const entry = await strapi.db.query(uid).findOne({ where: { id } });
  if (!entry) return null;
  return strapi.documents(uid).findOne({ documentId: entry.documentId });
};

const findByField = async (uid, field, value) => {
  const [entry] = await strapi.documents(uid).findMany({ filters: { [field]: value }, limit: 1 });
  return entry || null;
};

const findExisting = async (uid, idField, row) => {
  const key = row?.[idField];
  if (!idField || isEmptyKey(key)) return null;
  if (idField === "documentId") return findByDocumentId(uid, key);
  if (idField === "id") return findById(uid, key);
  return findByField(uid, idField, key);
};

const createDoc = (uid, data, commonOpts) => strapi.documents(uid).create({ data, ...commonOpts });

const updateDoc = (uid, existing, data, commonOpts) => strapi.documents(uid).update({ documentId: existing.documentId, data, ...commonOpts });

const upsertRow = async ({ uid, row, idField, existingAction, commonOpts }) => {
  const data = shapeForUid(uid, row);
  const existing = await findExisting(uid, idField, row);

  if (existing && existingAction === "skip") return "skipped";
  if (existing && existingAction === "createNew") {
    await createDoc(uid, data, commonOpts);
    return "created";
  }
  if (existing) {
    await updateDoc(uid, existing, data, commonOpts);
    return "updated";
  }

  await createDoc(uid, data, commonOpts);
  return "created";
};

module.exports = { coerceValue, shapeForUid, findExisting, upsertRow };
