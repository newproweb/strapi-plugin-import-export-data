"use strict";

const PRE_RESTORE_MODES = ["full", "db-only", "off"];

module.exports = {
  PRE_RESTORE_MODES,
  DEFAULTS: {
    backupSchedule: "",
    encryptionKey: "",
    retention: 10,
    autoExcludeFiles: false,
    adoptOrphans: false,
    preRestoreSnapshot: "full",
    transferRecipients: [],
  },
};
