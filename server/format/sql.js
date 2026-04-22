"use strict";

// Per-row SQL driver: serialises objects to INSERT statements and parses them back.
// Note: this is NOT a full SQL engine. It is used for exporting/importing a single
// collection's rows as INSERTs. Full database dump/restore lives in db-dump.service.

const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

const formatLiteral = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "object") {
    const json = JSON.stringify(value).replace(/'/g, "''");
    return `'${json}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
};

const stringify = (rows, { tableName = "rows", columns } = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `-- empty export for ${tableName}\n`;
  }

  const headers = columns && columns.length ? columns : Object.keys(rows[0] || {});
  const colList = headers.map(quoteIdent).join(", ");
  const out = [
    `-- table: ${tableName}`,
    `-- rows: ${rows.length}`,
    `-- generated: ${new Date().toISOString()}`,
    "",
  ];
  for (const row of rows) {
    const values = headers.map((h) => formatLiteral(row?.[h])).join(", ");
    out.push(`INSERT INTO ${quoteIdent(tableName)} (${colList}) VALUES (${values});`);
  }
  return `${out.join("\n")}\n`;
};

// Minimal INSERT parser. Supports:
//   INSERT INTO "tbl" (a, b, c) VALUES (1, 'x', NULL);
// Does not support CREATE TABLE, multi-row VALUES, subqueries, etc.
const parseValue = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper === "NULL") return null;
  if (upper === "TRUE") return true;
  if (upper === "FALSE") return false;

  if (trimmed.startsWith("'")) {
    const inner = trimmed.slice(1, -1).replace(/''/g, "'");
    try {
      return JSON.parse(inner);
    } catch {
      return inner;
    }
  }

  const num = Number(trimmed);
  return Number.isFinite(num) ? num : trimmed;
};

const splitValueList = (list) => {
  const out = [];
  let buffer = "";
  let inString = false;
  for (let i = 0; i < list.length; i += 1) {
    const ch = list[i];
    if (ch === "'" && list[i - 1] !== "\\") {
      inString = !inString;
      buffer += ch;
      continue;
    }
    if (ch === "," && !inString) {
      out.push(buffer);
      buffer = "";
      continue;
    }
    buffer += ch;
  }
  if (buffer.length) out.push(buffer);
  return out;
};

const parse = (text) => {
  const rows = [];
  const lines = String(text).split(/\r?\n/);

  const RE = /^INSERT INTO\s+"?([^"\s(]+)"?\s*\(([^)]+)\)\s+VALUES\s*\(([\s\S]+)\)\s*;?\s*$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("--")) continue;
    const match = RE.exec(trimmed);
    if (!match) continue;

    const cols = match[2].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const values = splitValueList(match[3]).map(parseValue);

    const row = {};
    cols.forEach((c, idx) => {
      row[c] = values[idx] === undefined ? null : values[idx];
    });
    rows.push(row);
  }
  return rows;
};

module.exports = {
  stringify,
  parse,
};
