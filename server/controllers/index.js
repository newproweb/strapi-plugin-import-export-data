"use strict";

const schemaController = require("./schema.controller");
const exportController = require("./export.controller");
const importController = require("./import.controller");
const backupController = require("./backup.controller");

module.exports = {
  schemaController,
  exportController,
  importController,
  backupController,
};
