"use strict";

const { actionUid } = require("../constants/permissions");

const requirePermission = (actionKey) => ({
  name: "admin::hasPermissions",
  config: { actions: [actionUid(actionKey)] },
});

const route = (method, path, handler, actionKey, extra = {}) => ({
  method,
  path,
  handler,
  config: {
    policies: [
      "admin::isAuthenticatedAdmin",
      ...(actionKey ? [requirePermission(actionKey)] : []),
    ],
    ...extra,
  },
});

module.exports = {
  type: "admin",
  routes: [
    // Schema + locales — any user with plugin read access
    route("GET", "/content-types", "schemaController.listCollections", "read"),
    route("GET", "/content-types/:uid", "schemaController.getCollection", "read"),
    route("GET", "/locales", "schemaController.getLocales", "read"),

    // Per-collection export/import
    route("GET", "/export", "exportController.exportData", "collectionExport"),
    route("GET", "/preview", "exportController.preview", "collectionExport"),
    route("POST", "/import", "importController.importData", "collectionImport"),

    // Strapi-CLI-backed database backups
    route("GET", "/backup", "backupController.list", "read"),
    route("POST", "/backup", "backupController.create", "create"),
    route("GET", "/backup/limits", "backupController.limits", "read"),

    // Job status routes (any user with read)
    route("GET", "/backup/jobs", "backupController.jobList", "read"),
    route("GET", "/backup/job/:id", "backupController.jobStatus", "read"),

    // Destructive actions — require individual permissions
    route("DELETE", "/backup/:file", "backupController.remove", "delete"),
    route("GET", "/backup/:file/download", "backupController.download", "download"),
    route("POST", "/backup/:file/restore", "backupController.restore", "restore"),
    route("POST", "/backup/upload", "backupController.upload", "restore"),
    route("POST", "/backup/run-now", "backupController.runNow", "create"),

    // Schedule/settings
    route("GET", "/backup-schedule", "backupController.getSchedule", "read"),
    route("POST", "/backup-schedule", "backupController.saveSchedule", "settings"),
  ],
};
