"use strict";

const csv = require("./csv");
const json = require("./json");
const xlsx = require("./xlsx");
const sql = require("./sql");
const gz = require("./gz");

// Base formats only. Gzip is an orthogonal toggle applied on top of any of them
// via `gz.compress(...)` on export and `gz.decompress(...)` on import.
const FORMATS = {
  csv: {
    extension: "csv",
    mime: "text/csv; charset=utf-8",
    stringify: csv.stringify,
    parse: csv.parse,
    binary: false,
  },
  json: {
    extension: "json",
    mime: "application/json; charset=utf-8",
    stringify: json.stringify,
    parse: json.parse,
    binary: false,
  },
  xlsx: {
    extension: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    stringify: xlsx.stringify,
    parse: xlsx.parse,
    binary: true,
  },
  sql: {
    extension: "sql",
    mime: "application/sql; charset=utf-8",
    stringify: sql.stringify,
    parse: sql.parse,
    binary: false,
  },
};

const getFormat = (name) => FORMATS[String(name || "").toLowerCase()];

// Returns { format, gzipped }. Examples:
//   pages.csv       -> { format: 'csv',  gzipped: false }
//   pages.csv.gz    -> { format: 'csv',  gzipped: true  }
//   dump.sql.gz     -> { format: 'sql',  gzipped: true  }
const detectFromFilename = (filename = "") => {
  const lower = String(filename).toLowerCase();
  const gzipped = lower.endsWith(".gz");
  const stripped = gzipped ? lower.slice(0, -3) : lower;

  let format = null;
  if (stripped.endsWith(".csv")) format = "csv";
  else if (stripped.endsWith(".json")) format = "json";
  else if (stripped.endsWith(".xlsx") || stripped.endsWith(".xls")) format = "xlsx";
  else if (stripped.endsWith(".sql")) format = "sql";

  return format ? { format, gzipped } : null;
};

module.exports = {
  FORMATS,
  getFormat,
  detectFromFilename,
  gz,
};
