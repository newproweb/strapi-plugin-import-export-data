"use strict";

const { sanitize } = require("../helpers/sanitize");
const { resolveSchema } = require("../helpers/content-type");
const { resolveFormat } = require("../helpers/format-resolver");
const { buildFindOpts } = require("../helpers/find-opts");
const { fetchAll, clamp } = require("../helpers/pagination");
const { resolveTableName, resolveFilenameBase, timestampSlug } = require("../helpers/naming");
const { stringifyRows, maybeGzip } = require("../helpers/output");

const buildFilename = (schema, uid, extension) => `${resolveFilenameBase(schema, uid)}-${timestampSlug()}.${extension}`;

const exportCollection = async ({
  uid,
  format,
  gzip = false,
  filters = {},
  sort,
  locale,
  status,
  deepness = 2,
  relationsAsId = false,
  columns,
}) => {
  const schema = resolveSchema(uid);
  const { driver, gz } = resolveFormat(format);

  const findOpts = buildFindOpts({ uid, filters, sort, locale, status, deepness });
  const rows = await fetchAll(uid, findOpts);
  const sanitized = rows.map((row) => sanitize(uid, row, { relationsAsId }));

  const raw = await stringifyRows(driver, sanitized, {
    columns,
    tableName: resolveTableName(schema, uid),
  });
  const bundled = await maybeGzip(raw, { gzip, gz, driver });

  return {
    filename: buildFilename(schema, uid, bundled.extension),
    mime: bundled.mime,
    binary: bundled.binary,
    data: bundled.data,
    count: sanitized.length,
  };
};

const resolvePageSize = (pageSize) => clamp(Number(pageSize) || 25, 1, 100);

const resolvePage = (page) => Math.max(1, Number(page) || 1);

const previewCollection = async ({
  uid,
  page = 1,
  pageSize = 25,
  filters = {},
  sort,
  locale,
  status,
}) => {
  resolveSchema(uid);
  const opts = buildFindOpts({ uid, filters, sort, locale, status, deepness: 1 });
  const limit = resolvePageSize(pageSize);
  const currentPage = resolvePage(page);
  const start = (currentPage - 1) * limit;

  const [rows, total] = await Promise.all([
    strapi.documents(uid).findMany({ ...opts, limit, start }),
    strapi.documents(uid).count({ filters, locale, status: opts.status }),
  ]);

  return {
    rows: rows.map((row) => sanitize(uid, row, { relationsAsId: true })),
    total,
    page: currentPage,
    pageSize: limit,
    pageCount: Math.max(1, Math.ceil((total || 0) / limit)),
  };
};

module.exports = () => ({ exportCollection, previewCollection });
