"use strict";

const csvtojson = require("csvtojson");

const toCell = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const escape = (str) => `"${str.replace(/"/g, '""')}"`;

// Serialise an array of flat objects to CSV text.
// UTF-8 BOM is prepended so Excel opens it correctly.
const stringify = (rows, { delimiter = ",", columns } = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "\uFEFF";
  }

  const headers = columns && columns.length ? columns : Object.keys(rows[0] || {});
  const head = headers.map((h) => escape(toCell(h))).join(delimiter);
  const body = rows.map((row) => headers.map((h) => escape(toCell(row?.[h]))).join(delimiter)).join("\n");

  return `\uFEFF${head}\n${body}`;
};

// Parse a CSV/TSV string into an array of objects.
const parse = async (text, { delimiter = "," } = {}) => {
  const rows = await csvtojson({ delimiter, noheader: false, trim: true }).fromString(text);
  return rows;
};

module.exports = {
  stringify,
  parse,
};
