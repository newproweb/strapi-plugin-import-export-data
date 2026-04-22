"use strict";

const slugify = (uid) => uid.replace(/[^a-z0-9]+/gi, "_");

const resolveTableName = (schema, uid) => schema.collectionName || schema.info?.pluralName || slugify(uid);

const resolveFilenameBase = (schema, uid) => schema.info?.pluralName || schema.info?.singularName || slugify(uid);

const timestampSlug = () => new Date().toISOString().replace(/[:.]/g, "-");

module.exports = { resolveTableName, resolveFilenameBase, timestampSlug };
