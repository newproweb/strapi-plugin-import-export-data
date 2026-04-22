"use strict";

const fs = require("fs");
const path = require("path");

const { DEFAULTS } = require("../constants/store");
const { PLUGIN } = require("../constants/plugin");

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
  lastBackupAt: patch.lastBackupAt === undefined ? current.lastBackupAt : patch.lastBackupAt,
});

module.exports = { readConfig, writeConfig, mergePatch };
