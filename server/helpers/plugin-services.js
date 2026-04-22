"use strict";

const { PLUGIN } = require("../constants/plugin");

const pluginRoot = () => strapi.plugin(PLUGIN);

const service = (name) => pluginRoot().service(name);

const services = () => ({
  backup: service("backupService"),
  schedule: service("scheduleService"),
  store: service("storeService"),
  schema: service("schemaService"),
  permissions: service("permissionsService"),
  exporter: service("exportService"),
  importer: service("importService"),
});

module.exports = { pluginRoot, service, services };
