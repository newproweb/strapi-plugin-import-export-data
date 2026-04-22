"use strict";

const pickBody = (ctx) => ctx.request.body?.data || ctx.request.body || {};

const validateImportBody = (ctx, body) => {
  if (!body.uid) ctx.throw(400, "uid is required");
  if (!body.format) ctx.throw(400, "format is required");
  if (body.fileContent === undefined || body.fileContent === null) {
    ctx.throw(400, "fileContent is required");
  }
};

const buildImportOpts = (body) => ({
  uid: body.uid,
  format: body.format,
  fileContent: body.fileContent,
  idField: body.idField || "documentId",
  existingAction: body.existingAction || "update",
  defaultStatus: body.defaultStatus || "draft",
  locale: body.locale,
});

module.exports = { pickBody, validateImportBody, buildImportOpts };
