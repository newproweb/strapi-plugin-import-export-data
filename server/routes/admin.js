"use strict";

const ADMIN_POLICIES = ["admin::isAuthenticatedAdmin"];

const route = (method, path, handler, extra = {}) => ({
  method,
  path,
  handler,
  config: {
    policies: ADMIN_POLICIES,
    ...extra,
  },
});

module.exports = {
  type: "admin",
  routes: [
    // Schema + locales 
    route("GET", "/content-types", "schemaController.listCollections"),
    route("GET", "/content-types/:uid", "schemaController.getCollection"),
    route("GET", "/locales", "schemaController.getLocales"),

    // collection export/import 
    route("GET", "/export", "exportController.exportData"),
    route("GET", "/preview", "exportController.preview"),
    route("POST", "/import", "importController.importData"),

    // Strapi-CLI-backed database backups.
    route("GET", "/backup", "backupController.list"),
    route("POST", "/backup", "backupController.create"),

    // Job status routes
    route("GET", "/backup/jobs", "backupController.jobList"),
    route("GET", "/backup/job/:id", "backupController.jobStatus"),
    route("DELETE", "/backup/:file", "backupController.remove"),
    route("GET", "/backup/:file/download", "backupController.download"),
    route("POST", "/backup/:file/restore", "backupController.restore"),
    route("POST", "/backup/upload", "backupController.upload"),
    route("POST", "/backup/run-now", "backupController.runNow"),
    route("GET", "/backup-schedule", "backupController.getSchedule"),
    route("POST", "/backup-schedule", "backupController.saveSchedule"),
  ],
};
