"use strict";

const PLUGIN = "import-export-data";

const PLUGIN_ACTIONS = {
  read: {
    section: "plugins",
    displayName: "Access the Import/Export panel (view backups)",
    uid: "read",
    pluginName: PLUGIN,
  },
  create: {
    section: "plugins",
    displayName: "Create backup / export",
    uid: "create",
    pluginName: PLUGIN,
  },
  restore: {
    section: "plugins",
    displayName: "Restore / import archive (DESTRUCTIVE — overwrites DB)",
    uid: "restore",
    pluginName: PLUGIN,
  },
  delete: {
    section: "plugins",
    displayName: "Delete backup",
    uid: "delete",
    pluginName: PLUGIN,
  },
  download: {
    section: "plugins",
    displayName: "Download backup archive",
    uid: "download",
    pluginName: PLUGIN,
  },
  settings: {
    section: "plugins",
    displayName: "Configure schedule / encryption / settings",
    uid: "settings",
    pluginName: PLUGIN,
  },
  collectionExport: {
    section: "plugins",
    displayName: "Per-collection export (CSV/JSON/XLSX)",
    uid: "collection.export",
    pluginName: PLUGIN,
  },
  collectionImport: {
    section: "plugins",
    displayName: "Per-collection import (CSV/JSON/XLSX)",
    uid: "collection.import",
    pluginName: PLUGIN,
  },
};

const actionUid = (key) => `plugin::${PLUGIN}.${PLUGIN_ACTIONS[key].uid}`;

const ACTION_HANDLERS = {
  read: (checker) => checker.can.read(),
  create: (checker) => checker.can.create(),
  update: (checker) => checker.can.update(),
  delete: (checker) => checker.can.delete(),
};

module.exports = { ACTION_HANDLERS, PLUGIN_ACTIONS, actionUid, PLUGIN };
