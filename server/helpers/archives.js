"use strict";

const fs = require("fs");
const path = require("path");

const { ensureBackupDir, isoSlug } = require("../utils/fs");
const { BACKUP_EXT } = require("../constants/backup");

const describeBackupFile = (dir, name) => {
  const full = path.join(dir, name);
  const stats = fs.statSync(full);
  return {
    id: name.replace(BACKUP_EXT, ""),
    file: name,
    path: full,
    size: stats.size,
    createdAt: new Date(stats.birthtimeMs || stats.mtimeMs).toISOString(),
    encrypted: name.endsWith(".enc"),
    compressed: name.includes(".tar.gz"),
  };
};

/**
 * Lists backup archives in the backup dir. `fs.statSync` is race-prone — a
 * file can disappear between `readdirSync` and `statSync` if another process
 * (cron retention prune, manual delete, partial-snapshot cleanup) removes it
 * mid-listing. Wrapping each describe call in try/catch lets the listing
 * survive that race instead of throwing the whole list.
 */
const listBackups = () => {
  const dir = ensureBackupDir();
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    strapi.log.warn(`[import-export] listBackups readdir failed: ${err.message}`);
    return [];
  }

  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || !BACKUP_EXT.test(entry.name)) continue;
    try {
      items.push(describeBackupFile(dir, entry.name));
    } catch (err) {
      strapi.log.warn(`[import-export] skipped ${entry.name} during listing: ${err.message}`);
    }
  }
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

const safeBackupPath = (fileName) => {
  const dir = ensureBackupDir();
  const filePath = path.join(dir, fileName);
  if (!filePath.startsWith(path.resolve(dir))) throw new Error("Invalid filename");
  return filePath;
};

const getBackupPath = (fileName) => {
  const filePath = safeBackupPath(fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Backup not found: ${fileName}`);
  return filePath;
};

const deleteBackup = (fileName) => {
  const filePath = safeBackupPath(fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Backup not found: ${fileName}`);
  fs.rmSync(filePath, { force: true });
  return { file: fileName, deleted: true };
};

const stageUploadedArchive = (tmpPath, originalName) => {
  const dir = ensureBackupDir();
  const safe = String(originalName || "upload").replace(/[^A-Za-z0-9._-]+/g, "_");
  if (!BACKUP_EXT.test(safe)) {
    throw new Error(`Unsupported file extension for ${safe}. Expected .tar, .tar.gz, .tar.enc, or .tar.gz.enc`);
  }
  const dest = path.join(dir, `uploaded-${isoSlug()}-${safe}`);
  fs.copyFileSync(tmpPath, dest);
  return { file: path.basename(dest), path: dest, size: fs.statSync(dest).size };
};

const pruneOldBackups = (keep) => {
  if (!Number.isFinite(keep) || keep <= 0) return { removed: [] };
  const toRemove = listBackups().slice(keep);
  for (const b of toRemove) {
    try {
      fs.rmSync(b.path, { force: true });
    } catch (err) {
      strapi.log.warn(`[import-export] could not prune ${b.file}: ${err.message}`);
    }
  }
  return { removed: toRemove.map((b) => b.file) };
};

module.exports = {
  listBackups,
  getBackupPath,
  deleteBackup,
  stageUploadedArchive,
  pruneOldBackups,
};
