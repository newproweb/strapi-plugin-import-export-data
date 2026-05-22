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

    // DB-independent progress poll — token-gated (no admin session), so the
    // progress modal keeps working while an import has wiped the auth tables.
    {
      method: "GET",
      path: "/backup/job/:id/progress",
      handler: "backupController.jobProgress",
      config: { auth: false, policies: [] },
    },

    // Abort a running job — token-gated like the progress route so the
    // operator can stop a job even while an import has wiped the auth tables.
    {
      method: "POST",
      path: "/backup/job/:id/abort",
      handler: "backupController.jobAbort",
      config: { auth: false, policies: [] },
    },

    // Public, time-limited download link (token-gated) — for sharing a backup.
    {
      method: "GET",
      path: "/backup/transfer/:token",
      handler: "backupController.transferDownload",
      config: { auth: false, policies: [] },
    },

    // Destructive actions — require individual permissions
    route("DELETE", "/backup/:file", "backupController.remove", "delete"),
    route("GET", "/backup/:file/download", "backupController.download", "download"),
    route("POST", "/backup/:file/transfer", "backupController.transfer", "download"),
    route("POST", "/backup/:file/restore", "backupController.restore", "restore"),
    route("POST", "/backup/upload", "backupController.upload", "restore"),
    route("POST", "/backup/run-now", "backupController.runNow", "create"),

    // Full-seed (schema + data) — recreates missing schema from the archive
    route("GET", "/full-seed/pending", "backupController.fullSeedPending", "read"),
    route("DELETE", "/full-seed/pending", "backupController.clearFullSeed", "restore"),
    route("GET", "/full-seed/:file/plan", "backupController.fullSeedPlan", "restore"),
    route("POST", "/full-seed/:file/sync", "backupController.fullSeedSync", "restore"),

    // Schedule/settings
    route("GET", "/backup-schedule", "backupController.getSchedule", "read"),
    route("POST", "/backup-schedule", "backupController.saveSchedule", "settings"),
  ],
};
