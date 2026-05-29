"use strict";

const { normalizeRecipients } = require("./transfer");
const { PRE_RESTORE_MODES } = require("../constants/store");

const MASKED_KEY = "••••••";

const assignIfString = (target, source, key) => {
  if (typeof source[key] === "string") target[key] = source[key];
};

const assignIfDefined = (target, source, key, transform = (value) => value) => {
  if (source[key] !== undefined) target[key] = transform(source[key]);
};

const normalizePreRestoreInput = (value) => {
  if (value === true || value === "true") return "full";
  if (value === false || value === "false") return "off";
  if (typeof value === "string" && PRE_RESTORE_MODES.includes(value)) return value;
  return "full";
};

const buildSchedulePatch = (body) => {
  const patch = {};
  assignIfString(patch, body, "backupSchedule");
  if (Object.prototype.hasOwnProperty.call(body, "encryptionKey")) {
    patch.encryptionKey = body.encryptionKey;
  }
  assignIfDefined(patch, body, "retention");
  assignIfDefined(patch, body, "autoExcludeFiles", Boolean);
  assignIfDefined(patch, body, "adoptOrphans", Boolean);
  assignIfDefined(patch, body, "preRestoreSnapshot", normalizePreRestoreInput);
  assignIfDefined(patch, body, "transferRecipients", normalizeRecipients);
  return patch;
};

const maskEncryptionKey = (value) => (value ? MASKED_KEY : "");

const readPreRestoreMode = (raw) => {
  if (raw === true) return "full";
  if (raw === false) return "off";
  if (typeof raw === "string" && PRE_RESTORE_MODES.includes(raw)) return raw;
  return "full";
};

const toPublicConfig = (cfg) => ({
  backupSchedule: cfg.backupSchedule,
  encryptionKey: maskEncryptionKey(cfg.encryptionKey),
  encryptionKeySet: Boolean(cfg.encryptionKey),
  retention: cfg.retention,
  autoExcludeFiles: cfg.autoExcludeFiles,
  adoptOrphans: Boolean(cfg.adoptOrphans),
  preRestoreSnapshot: readPreRestoreMode(cfg.preRestoreSnapshot),
  transferRecipients: Array.isArray(cfg.transferRecipients) ? cfg.transferRecipients : [],
  lastBackupAt: cfg.lastBackupAt || null,
});

const toSavedConfig = (saved) => ({
  ...saved,
  encryptionKey: maskEncryptionKey(saved.encryptionKey),
});

module.exports = { MASKED_KEY, buildSchedulePatch, toPublicConfig, toSavedConfig };
