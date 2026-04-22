"use strict";

const sanitizePrefix = (prefix) => String(prefix || "backup").replace(/[^a-z0-9_-]+/gi, "") || "backup";

const hasValue = (value) => typeof value === "string" && value.trim();

const buildExportArgs = ({ basePath, encrypt, key, compress, exclude }) => {
  const args = ["export", "--file", basePath];
  if (!encrypt) args.push("--no-encrypt");
  else if (key) args.push("--key", key);
  if (!compress) args.push("--no-compress");
  if (hasValue(exclude)) args.push("--exclude", exclude.trim());
  return args;
};

const buildImportArgs = ({ filePath, key, exclude }) => {
  const args = ["import", "--file", filePath, "--force"];
  if (key) args.push("--key", key);
  if (hasValue(exclude)) args.push("--exclude", exclude.trim());
  return args;
};

module.exports = { sanitizePrefix, buildExportArgs, buildImportArgs };
