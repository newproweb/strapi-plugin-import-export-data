"use strict";

const parseJsonParam = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseSortParam = (value) => {
  if (!value) return undefined;
  if (typeof value === "object") return value;
  const trimmed = String(value).trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

module.exports = { parseJsonParam, parseSortParam };
