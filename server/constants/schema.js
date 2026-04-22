"use strict";

module.exports = {
  EXCLUDED_TYPES: new Set(["password", "dynamiczone"]),
  SYSTEM_FIELDS: new Set([
    "createdAt",
    "updatedAt",
    "publishedAt",
    "createdBy",
    "updatedBy",
    "localizations",
  ]),
};
