"use strict";

const { summarizeUploads } = require("./uploads");

const LOCAL_PROVIDERS = new Set(["local", "@strapi/provider-upload-local"]);

const getUploadProvider = () => {
  try {
    return strapi.config.get("plugin.upload.provider")
      || strapi.config.get("plugin::upload.provider")
      || "local";
  } catch {
    return "local";
  }
};

const countUploadFiles = async (emit) => {
  try {
    return await strapi.db.query("plugin::upload.file").count();
  } catch (err) {
    emit(`[diag] could not count plugin::upload.file rows: ${err.message}`);
    return null;
  }
};

const emitMismatch = (emit, uploads, dbFileCount) => {
  if (uploads.files > dbFileCount) {
    emit(`[diag] disk > DB by ${uploads.files - dbFileCount} orphan file(s) → skipped (no upload_file row points at them)`);
    return;
  }
  if (dbFileCount > uploads.files) {
    emit(`[diag] DB > disk by ${dbFileCount - uploads.files} row(s) → those reference missing files; empty placeholders will be padded in`);
  }
};

const emitExportDiagnostics = async ({ excludesFiles, emit }) => {
  if (excludesFiles) {
    emit(`[diag] --exclude files is set → media will NOT be included in the archive`);
    return;
  }

  const provider = getUploadProvider();
  const uploads = summarizeUploads();
  const dbFileCount = await countUploadFiles(emit);

  emit(`[diag] upload provider = "${provider}" (strapi export only bundles assets from the LOCAL provider)`);
  if (dbFileCount !== null) emit(`[diag] plugin::upload.file rows in DB: ${dbFileCount}`);

  if (!uploads.path) {
    emit(`[diag] no uploads directory found — the archive will have no media`);
  } else {
    const mb = (uploads.bytes / 1024 / 1024).toFixed(1);
    emit(`[diag] uploads dir ${uploads.path} has ${uploads.files} file(s) on disk totalling ${mb} MB`);
  }

  if (dbFileCount !== null && uploads.path) emitMismatch(emit, uploads, dbFileCount);

  if (!LOCAL_PROVIDERS.has(provider)) {
    emit(`[diag] non-local provider "${provider}" detected — strapi export does NOT call into cloud providers`);
  }
};

module.exports = { emitExportDiagnostics, getUploadProvider };
