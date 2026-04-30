"use strict";

const fs = require("fs");
const path = require("path");

// Reached by timer callbacks (asset-progress-monitor, job-store prune) which
// can fire while `strapi develop` is mid-reload — a bare `strapi` reference
// would throw ReferenceError and crash the process. Guard the global access.
const appRoot = () => {
  try {
    if (typeof strapi !== "undefined" && strapi?.dirs?.app?.root) return strapi.dirs.app.root;
  } catch { /* ignore */ }
  return process.cwd();
};

const backupDir = () => path.join(appRoot(), "data", "backups");

const ensureBackupDir = () => {
  const dir = backupDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const isoSlug = () => new Date().toISOString().replace(/[:.]/g, "-");

const pickCandidate = (basePath, { encrypt, compress }) => {
  if (!compress && !encrypt) return `${basePath}.tar`;
  if (compress && !encrypt) return `${basePath}.tar.gz`;
  if (!compress && encrypt) return `${basePath}.tar.enc`;
  return `${basePath}.tar.gz.enc`;
};

const resolveExportedPath = (basePath, flags) => {
  const preferred = pickCandidate(basePath, flags);
  if (fs.existsSync(preferred)) return preferred;

  const dir = path.dirname(basePath);
  if (!fs.existsSync(dir)) return null;
  const base = path.basename(basePath);
  const match = fs.readdirSync(dir).find((f) => f.startsWith(`${base}.`));
  return match ? path.join(dir, match) : null;
};

module.exports = {
  appRoot,
  backupDir,
  ensureBackupDir,
  isoSlug,
  resolveExportedPath,
};
