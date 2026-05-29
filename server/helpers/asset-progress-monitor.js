"use strict";

const fs = require("fs");
const path = require("path");

const { appRoot } = require("../utils/fs");

const POLL_MS = 15 * 1000;
const MAX_DEPTH = 32;

const fmtBytes = (n) => {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * Walks `dir` asynchronously via `opendir`, yielding to the event loop
 * between entries so a large `uploads/` folder (50k+ files) does not freeze
 * admin HTTP for hundreds of ms. Symlink loops are bounded by a `realpath`
 * visited set plus a hard `MAX_DEPTH` cap.
 */
const scanDir = async (dir) => {
  const acc = { files: 0, bytes: 0 };
  const visited = new Set();

  const walk = async (d, depth) => {
    if (depth > MAX_DEPTH) return;
    let real;
    try { real = await fs.promises.realpath(d); }
    catch { return; }
    if (visited.has(real)) return;
    visited.add(real);

    let handle;
    try { handle = await fs.promises.opendir(d); }
    catch { return; }

    try {
      for await (const entry of handle) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
          continue;
        }
        if (!entry.isFile()) continue;
        acc.files += 1;
        try {
          const st = await fs.promises.stat(full);
          acc.bytes += st.size;
        } catch { /* ignore */ }
      }
    } catch { /* iterator errors ignored — directory may have changed mid-walk */ }
  };

  await walk(dir, 0);
  return acc;
};

const findBackupDir = async (publicDir) => {
  try {
    const names = await fs.promises.readdir(publicDir);
    return names.find((n) => /^uploads_backup_\d+$/.test(n)) || null;
  } catch { return null; }
};

const startAssetProgressMonitor = (emit) => {
  const publicDir = path.join(appRoot(), "public");
  const uploadsDir = path.join(publicDir, "uploads");

  let baseline = { files: 0, bytes: 0 };
  let lastBackup = null;
  let lastFiles = 0;
  let stopped = false;
  let tickBusy = false;

  const reportBaseline = async () => {
    baseline = await scanDir(uploadsDir);
    lastFiles = baseline.files;
    emit(
      `[assets-progress] monitor started — uploads/ currently has `
      + `${baseline.files} file(s), ${fmtBytes(baseline.bytes)}. `
      + `Strapi import runs two silent pre-transfer steps before the first new asset lands: `
      + `(1) moves uploads/ to uploads_backup_<ts>/; (2) deletes every plugin::upload.file row one-by-one.`,
    );
  };

  const tick = async () => {
    if (stopped || tickBusy) return;
    tickBusy = true;
    try {
      const current = await scanDir(uploadsDir);
      const backupName = await findBackupDir(publicDir);

      if (backupName && backupName !== lastBackup) {
        lastBackup = backupName;
        const backupStats = await scanDir(path.join(publicDir, backupName));
        emit(
          `[assets-progress] step (1) done — old assets parked in ${backupName}/ `
          + `(${backupStats.files} file(s), ${fmtBytes(backupStats.bytes)}). `
          + `Now Strapi will delete DB rows one-by-one, then start streaming new assets.`,
        );
      }

      if (current.files !== lastFiles) {
        const delta = current.files - lastFiles;
        const sign = delta >= 0 ? "+" : "";
        emit(
          `[assets-progress] uploads/ = ${current.files} file(s), ${fmtBytes(current.bytes)} `
          + `(${sign}${delta} since last tick)`,
        );
        lastFiles = current.files;
      }
    } finally {
      tickBusy = false;
    }
  };

  reportBaseline().catch(() => { /* baseline best-effort */ });
  const timer = setInterval(() => { tick().catch(() => {}); }, POLL_MS);

  return {
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      const final = await scanDir(uploadsDir).catch(() => ({ files: 0, bytes: 0 }));
      emit(
        `[assets-progress] monitor stopped — uploads/ final state: `
        + `${final.files} file(s), ${fmtBytes(final.bytes)} `
        + `(delta vs. start: ${final.files - baseline.files})`,
      );
    },
  };
};

module.exports = { startAssetProgressMonitor };
