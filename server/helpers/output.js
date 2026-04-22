"use strict";

const stringifyRows = (driver, rows, { columns, tableName }) =>
  driver.stringify(rows, { columns, tableName });

const wrapRaw = (payload, driver) => ({
  data: payload,
  extension: driver.extension,
  mime: driver.mime,
  binary: Boolean(driver.binary),
});

const wrapGzipped = async (payload, driver, gz) => ({
  data: await gz.compress(payload),
  extension: `${driver.extension}.gz`,
  mime: "application/gzip",
  binary: true,
});

const maybeGzip = (payload, { gzip, gz, driver }) => {
  if (!gzip) return wrapRaw(payload, driver);
  return wrapGzipped(payload, driver, gz);
};

module.exports = { stringifyRows, maybeGzip };
