"use strict";

const {
  isUserCollection,
  isVisible,
  sanitizeAttributes,
  collectionSummary,
} = require("../helpers/schema");

const byDisplayName = (a, b) => a.displayName.localeCompare(b.displayName);

const isPublicCollection = (uid, schema) => isUserCollection(uid, schema) && isVisible(schema);

const listCollections = () => {
  const out = [];
  for (const [uid, schema] of Object.entries(strapi.contentTypes || {})) {
    if (!isPublicCollection(uid, schema)) continue;
    out.push(collectionSummary(uid, schema));
  }
  return out.sort(byDisplayName);
};

const getCollection = (uid) => {
  const schema = strapi.contentTypes?.[uid];
  if (!schema || !isUserCollection(uid, schema)) return null;

  return {
    ...collectionSummary(uid, schema),
    attributes: sanitizeAttributes(schema.attributes),
    rawAttributes: schema.attributes || {},
  };
};

module.exports = () => ({ listCollections, getCollection });
