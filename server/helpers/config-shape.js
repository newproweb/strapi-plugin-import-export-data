"use strict";

const MASKED_KEY = "••••••";

const assignIfString = (target, source, key) => {
  if (typeof source[key] === "string") target[key] = source[key];
};

const assignIfDefined = (target, source, key, transform = (value) => value) => {
  if (source[key] !== undefined) target[key] = transform(source[key]);
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
  assignIfDefined(patch, body, "preRestoreSnapshot", Boolean);
  return patch;
};

const maskEncryptionKey = (value) => (value ? MASKED_KEY : "");

const toPublicConfig = (cfg) => ({
  backupSchedule: cfg.backupSchedule,
  encryptionKey: maskEncryptionKey(cfg.encryptionKey),
  encryptionKeySet: Boolean(cfg.encryptionKey),
  retention: cfg.retention,
  autoExcludeFiles: cfg.autoExcludeFiles,
  adoptOrphans: Boolean(cfg.adoptOrphans),
  preRestoreSnapshot: cfg.preRestoreSnapshot !== false,
  lastBackupAt: cfg.lastBackupAt || null,
});

const toSavedConfig = (saved) => ({
  ...saved,
  encryptionKey: maskEncryptionKey(saved.encryptionKey),
});

module.exports = { MASKED_KEY, buildSchedulePatch, toPublicConfig, toSavedConfig };
