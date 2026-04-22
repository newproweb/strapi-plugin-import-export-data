"use strict";

const resolveStatus = (schema, defaultStatus) => {
  if (!schema?.options?.draftAndPublish) return undefined;
  return defaultStatus === "published" ? "published" : "draft";
};

const buildCommonOpts = (status, locale) => {
  const opts = {};
  if (status) opts.status = status;
  if (locale) opts.locale = locale;
  return opts;
};

module.exports = { resolveStatus, buildCommonOpts };
