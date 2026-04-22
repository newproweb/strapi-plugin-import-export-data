"use strict";

const { getFormat, gz } = require("../format");

const resolveFormat = (format) => {
  const driver = getFormat(format);
  if (!driver) throw new Error(`Unsupported format: ${format}`);
  return { driver, gz };
};

module.exports = { resolveFormat };
