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

const buildRestoreOpts = (body, cfg) => ({
  key: body.key || cfg.encryptionKey || undefined,
  exclude: body.exclude || undefined,
  preRestoreSnapshot: body.preRestoreSnapshot === undefined ? cfg.preRestoreSnapshot !== false : isTruthy(body.preRestoreSnapshot),
});

module.exports = {
  buildExportOpts,
  buildPreviewOpts,
  buildBackupCreateOpts,
  buildRestoreOpts,
};
