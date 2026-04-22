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

const listBackups = () => {
  const dir = ensureBackupDir();
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && BACKUP_EXT.test(e.name))
    .map((e) => describeBackupFile(dir, e.name))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
