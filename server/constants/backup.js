"use strict";

module.exports = {
  MAX_LOG_LINES: 300,
  JOB_TTL_MS: 60 * 60 * 1000,
  CLI_TIMEOUT_MS: 2 * 60 * 60 * 1000,
  KNOWN_STAGES: ["schemas", "entities", "links", "assets", "configuration"],
  COMPLETION_MARKERS: [
    /transfer completed/i,
    /import(ing)? completed/i,
    /export(ing)? completed/i,
    /data has been successfully imported/i,
  ],
  BACKUP_EXT: /\.(tar|tar\.gz|tar\.enc|tar\.gz\.enc)$/i,
};
