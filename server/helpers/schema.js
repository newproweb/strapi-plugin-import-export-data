"use strict";

const { EXCLUDED_TYPES, SYSTEM_FIELDS } = require("../constants/schema");

const isUserCollection = (uid, schema) => Boolean(uid?.startsWith("api::") && schema?.kind === "collectionType");

const getDisplayName = (schema) => schema?.info?.displayName || schema?.info?.singularName || schema?.uid || "";

const hasI18n = (schema) => Boolean(schema?.pluginOptions?.i18n?.localized);

const isVisible = (schema) => schema?.pluginOptions?.["content-type-builder"]?.visible !== false;

const mapAttribute = (attr) => ({
  type: attr.type,
  required: Boolean(attr.required),
  unique: Boolean(attr.unique),
  relation: attr.relation,
  target: attr.target,
  component: attr.component,
  multiple: attr.multiple,
  enum: attr.enum,
});

const sanitizeAttributes = (attributes = {}) => {
  const out = {};
  for (const [name, attr] of Object.entries(attributes)) {
    if (SYSTEM_FIELDS.has(name)) continue;
    if (EXCLUDED_TYPES.has(attr.type)) continue;
    out[name] = mapAttribute(attr);
  }
  return out;
};

const collectionSummary = (uid, schema) => ({
  uid,
  displayName: getDisplayName(schema),
  singularName: schema?.info?.singularName || null,
  pluralName: schema?.info?.pluralName || null,
  kind: schema?.kind,
  draftAndPublish: Boolean(schema?.options?.draftAndPublish),
  hasI18n: hasI18n(schema),
});

module.exports = {
  isUserCollection,
  isVisible,
  getDisplayName,
  hasI18n,
  sanitizeAttributes,
  collectionSummary,
};
