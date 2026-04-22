"use strict";

const fs = require("fs");

const pickMultipartFile = (ctx) => {
  const files = ctx.request.files || {};
  return files.file || Object.values(files)[0];
};

const readableUploadPath = (file) => {
  const tmpPath = file.filepath || file.path;
  if (!tmpPath || !fs.existsSync(tmpPath)) return null;
  return tmpPath;
};

const uploadOriginalName = (file) => file.originalFilename || file.name || file.newFilename;

module.exports = { pickMultipartFile, readableUploadPath, uploadOriginalName };
