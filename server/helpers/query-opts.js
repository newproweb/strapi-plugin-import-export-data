"use strict";

const { parseJsonParam, parseSortParam } = require("../utils/parse");

const isTruthy = (value) => value === true || value === "true";

const buildExportOpts = (query) => ({
  uid: query.uid,
  format: query.format || "json",
  gzip: isTruthy(query.gzip),
  filters: parseJsonParam(query.filters, {}),
  sort: parseSortParam(query.sort),
  locale: query.locale || undefined,
  status: query.status || undefined,
  deepness: Number(query.deepness) || 2,
  relationsAsId: isTruthy(query.relationsAsId),
  columns: parseJsonParam(query.columns, undefined),
});

const buildPreviewOpts = (query) => ({
  uid: query.uid,
  page: Number(query.page) || 1,
  pageSize: Number(query.pageSize) || 25,
  filters: parseJsonParam(query.filters, {}),
  sort: parseSortParam(query.sort),
  locale: query.locale || undefined,
  status: query.status || undefined,
});

const buildBackupCreateOpts = (body, cfg) => {
  const encrypt = isTruthy(body.encrypt);
  const compress = body.compress !== false && body.compress !== "false";
  return {
    encrypt,
    compress,
    key: encrypt ? (body.key || cfg.encryptionKey || undefined) : undefined,
    exclude: body.exclude || undefined,
    prefix: body.prefix || "export",
    adoptOrphans: body.adoptOrphans === undefined ? Boolean(cfg.adoptOrphans) : isTruthy(body.adoptOrphans),
  };
};

/**
 * Resolves the pre-restore snapshot mode from the request body, falling back
 * to the saved config. Boolean `true` (legacy UI switch) maps to "full" so
 * the rollback covers media too — losing assets on rollback was a real risk
 * with the previous default. Explicit "db-only" is still honored when the
 * caller opts into the faster snapshot path.
 */
const resolveSnapshotMode = (body, cfg) => {
  const raw = body.preRestoreSnapshot !== undefined ? body.preRestoreSnapshot : cfg.preRestoreSnapshot;
  if (raw === false || raw === "false" || raw === "off") return "off";
  if (raw === "db-only") return "db-only";
  return "full";
};

const buildRestoreOpts = (body, cfg) => ({
  key: body.key || cfg.encryptionKey || undefined,
  exclude: body.exclude || undefined,
  only: body.only || undefined,
  preRestoreSnapshot: resolveSnapshotMode(body, cfg),
  confirmSchemaChange: isTruthy(body.confirmSchemaChange),
  deepValidate: isTruthy(body.deepValidate),
});

module.exports = {
  buildExportOpts,
  buildPreviewOpts,
  buildBackupCreateOpts,
  buildRestoreOpts,
};
