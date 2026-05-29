"use strict";

const fs = require("fs");
const path = require("path");

const { ensureBackupDir, isoSlug, atomicMove } = require("../utils/fs");
const { BACKUP_EXT } = require("../constants/backup");

const SAFE_NAME = /[^A-Za-z0-9._-]+/g;

const sanitizeArchiveName = (originalName) => {
  const safe = String(originalName || "upload").replace(SAFE_NAME, "_");
  if (!BACKUP_EXT.test(safe)) {
    throw new Error(`Unsupported file extension for ${safe}. Expected .tar, .tar.gz, .tar.enc, or .tar.gz.enc`);
  }
  return safe;
};

const stagedArchivePath = (originalName) => {
  const safe = sanitizeArchiveName(originalName);
  return path.join(ensureBackupDir(), `uploaded-${isoSlug()}-${safe}`);
};

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

const LIST_CACHE_TTL_MS = 2000;

let listCache = null;

const invalidateListCache = () => { listCache = null; };

const readBackupList = () => {
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

/**
 * Lists backup archives. Cached for `LIST_CACHE_TTL_MS` so the admin's poll
 * cadence (every 3–20s from `useRunningJobs` + every panel render) does not
 * hammer the FS with readdir+stat per backup. Cache is dropped on any
 * create/delete via `invalidateListCache`.
 */
const listBackups = () => {
  const now = Date.now();
  if (listCache && now - listCache.at < LIST_CACHE_TTL_MS) return listCache.items;
  const items = readBackupList();
  listCache = { at: now, items };
  return items;
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
  invalidateListCache();
  return { file: fileName, deleted: true };
};

const stageUploadedArchive = async (tmpPath, originalName) => {
  const dest = stagedArchivePath(originalName);
  await atomicMove(tmpPath, dest);
  const { size } = await fs.promises.stat(dest);
  invalidateListCache();
  return { file: path.basename(dest), size };
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
  if (toRemove.length > 0) invalidateListCache();
  return { removed: toRemove.map((b) => b.file) };
};

const stageExternalFile = async (srcPath, originalName) => {
  const dest = stagedArchivePath(originalName);
  await atomicMove(srcPath, dest);
  const { size } = await fs.promises.stat(dest);
  invalidateListCache();
  return { file: path.basename(dest), size };
};

module.exports = {
  listBackups,
  invalidateListCache,
  getBackupPath,
  deleteBackup,
  stageUploadedArchive,
  stageExternalFile,
  pruneOldBackups,
};
