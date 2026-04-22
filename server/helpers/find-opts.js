"use strict";

const { buildPopulate } = require("./populate");
const { resolveSchema } = require("./content-type");

const buildFindOpts = ({ uid, filters, sort, locale, status, deepness }) => {
  const schema = resolveSchema(uid);
  const opts = { filters, populate: buildPopulate(uid, { deepness }) };
  if (sort) opts.sort = sort;
  if (locale) opts.locale = locale;
  if (status && schema.options?.draftAndPublish) opts.status = status;
  return opts;
};

module.exports = { buildFindOpts };
