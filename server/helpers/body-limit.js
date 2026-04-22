"use strict";

const DEFAULT_MAX_FILE_SIZE = 200 * 1024 * 1024;

const findBodyMiddleware = () => {
  try {
    const middlewares = strapi.config.get("middlewares", []);
    if (!Array.isArray(middlewares)) return null;
    return middlewares.find((m) => m && typeof m === "object" && m.name === "strapi::body") || null;
  } catch {
    return null;
  }
};

const readStrapiBodyLimit = () => {
  const mw = findBodyMiddleware();
  const configured = Number(mw?.config?.formidable?.maxFileSize);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_FILE_SIZE;
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** k).toFixed(1)} ${units[k]}`;
};

const assertSizeWithinLimit = (size, label = "archive") => {
  const max = readStrapiBodyLimit();
  if (size > max) {
    const err = new Error(
      `${label} size ${formatBytes(size)} exceeds the configured Strapi body limit of ${formatBytes(max)}. `
      + "Raise `strapi::body` formidable.maxFileSize in admin/config/middlewares.js (and the reverse-proxy client_max_body_size) and restart Strapi.",
    );
    err.status = 413;
    throw err;
  }
};

module.exports = { readStrapiBodyLimit, assertSizeWithinLimit, formatBytes, DEFAULT_MAX_FILE_SIZE };
