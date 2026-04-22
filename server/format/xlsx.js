"use strict";

const ExcelJS = require("exceljs");

const toCell = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
};

// Serialise rows to an XLSX Buffer via exceljs.
const stringify = async (rows, { columns, sheetName = "Data" } = {}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  const headers = columns && columns.length ? columns : Object.keys(rows?.[0] || {});
  worksheet.columns = headers.map((key) => ({ header: key, key, width: Math.min(40, Math.max(10, key.length + 2)) }));

  if (Array.isArray(rows)) {
    for (const row of rows) {
      const shaped = {};
      for (const key of headers) shaped[key] = toCell(row?.[key]);
      worksheet.addRow(shaped);
    }
  }

  return workbook.xlsx.writeBuffer();
};

// Parse an XLSX Buffer into an array of objects keyed by the first-row headers.
const parse = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = [];
  const rows = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? "").trim();
      });
      return;
    }
    const obj = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber - 1];
      if (!key) return;
      let value = cell.value;
      if (value && typeof value === "object" && "richText" in value) {
        value = value.richText.map((r) => r.text).join("");
      } else if (value && typeof value === "object" && "text" in value) {
        value = value.text;
      }
      obj[key] = value;
    });
    rows.push(obj);
  });

  return rows;
};

module.exports = {
  stringify,
  parse,
};
