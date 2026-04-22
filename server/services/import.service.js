"use strict";

const { upsertRow } = require("../helpers/import-row");
const { resolveSchema } = require("../helpers/content-type");
const { resolveFormat } = require("../helpers/format-resolver");
const { decodeToBuffer, decodeRows } = require("../helpers/decode-payload");
const { resolveStatus, buildCommonOpts } = require("../helpers/document-opts");

const emptyResult = (total) => ({
  total,
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  failures: [],
});

const recordFailure = (result, index, row, error) => {
  result.failed += 1;
  result.failures.push({
    row: index + 1,
    error: error.message || String(error),
    data: row,
  });
};

const importCollection = async ({
  uid,
  format,
  fileContent,
  idField = "documentId",
  existingAction = "update",
  defaultStatus = "draft",
  locale,
}) => {
  const schema = resolveSchema(uid);
  const { driver, gz } = resolveFormat(format);

  const buffer = decodeToBuffer(fileContent, driver, gz);
  const rows = await decodeRows(buffer, driver, gz);
  const commonOpts = buildCommonOpts(resolveStatus(schema, defaultStatus), locale);

  const result = emptyResult(rows.length);

  for (let index = 0; index < rows.length; index += 1) {
    try {
      const outcome = await upsertRow({
        uid,
        row: rows[index],
        idField,
        existingAction,
        commonOpts,
      });
      result[outcome] += 1;
    } catch (error) {
      recordFailure(result, index, rows[index], error);
    }
  }

  return result;
};

module.exports = () => ({ importCollection });
