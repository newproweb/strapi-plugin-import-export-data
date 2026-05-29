"use strict";

const fs = require("fs");
const path = require("path");

const { DEFAULTS, PRE_RESTORE_MODES } = require("../constants/store");
const { PLUGIN } = require("../constants/plugin");

const normalizePreRestoreMode = (value, fallback) => {
  if (value === true || value === "true") return "full";
  if (value === false || value === "false") return "off";
  if (typeof value === "string" && PRE_RESTORE_MODES.includes(value)) return value;
  return fallback;
};

const storeDir = () => strapi.plugin(PLUGIN).service("backupService").backupDir();

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const configPath = () => path.join(ensureDir(storeDir()), ".plugin-config.json");

const readConfig = () => {
  const file = configPath();
  if (!fs.existsSync(file)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, "utf-8")) };
  } catch (err) {
    strapi.log.warn(`[import-export] could not read store: ${err.message}`);
    return { ...DEFAULTS };
  }
};

const writeConfig = (next) => {
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
  return next;
};

const normalizeRetention = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
};

const pickString = (patch, key, current) => typeof patch[key] === "string" ? patch[key] : current[key];

const pickBool = (patch, key, current) => typeof patch[key] === "boolean" ? patch[key] : current[key];

const mergePatch = (current, patch) => ({
  backupSchedule: pickString(patch, "backupSchedule", current),
  encryptionKey: pickString(patch, "encryptionKey", current),
  retention:
    patch.retention === undefined
      ? current.retention
      : normalizeRetention(patch.retention, current.retention),

  autoExcludeFiles: pickBool(patch, "autoExcludeFiles", current),
  adoptOrphans: pickBool(patch, "adoptOrphans", current),
  preRestoreSnapshot: patch.preRestoreSnapshot === undefined
    ? normalizePreRestoreMode(current.preRestoreSnapshot, "full")
    : normalizePreRestoreMode(patch.preRestoreSnapshot, normalizePreRestoreMode(current.preRestoreSnapshot, "full")),
  transferRecipients: Array.isArray(patch.transferRecipients)
    ? patch.transferRecipients
    : (Array.isArray(current.transferRecipients) ? current.transferRecipients : []),
  lastBackupAt: patch.lastBackupAt === undefined ? current.lastBackupAt : patch.lastBackupAt,
});

module.exports = { readConfig, writeConfig, mergePatch };
