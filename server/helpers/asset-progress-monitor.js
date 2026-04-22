"use strict";

const fs = require("fs");
const path = require("path");

const { appRoot } = require("../utils/fs");

const POLL_MS = 15 * 1000;

const fmtBytes = (n) => {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const scanDir = (dir) => {
  const acc = { files: 0, bytes: 0 };
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.isFile()) continue;
      acc.files += 1;
      try { acc.bytes += fs.statSync(full).size; } catch { /* ignore */ }
    }
  };
  walk(dir);
  return acc;
};

const findBackupDir = (publicDir) => {
  try {
    const names = fs.readdirSync(publicDir);
    return names.find((n) => /^uploads_backup_\d+$/.test(n)) || null;
  } catch { return null; }
};

const startAssetProgressMonitor = (emit) => {
  const publicDir = path.join(appRoot(), "public");
  const uploadsDir = path.join(publicDir, "uploads");

  const baseline = scanDir(uploadsDir);
  emit(
    `[assets-progress] monitor started — uploads/ currently has `
    + `${baseline.files} file(s), ${fmtBytes(baseline.bytes)}. `
    + `Strapi import runs two silent pre-transfer steps before the first new asset lands: `
    + `(1) moves uploads/ to uploads_backup_<ts>/; (2) deletes every plugin::upload.file row one-by-one.`,
  );

  let lastBackup = null;
  let lastFiles = baseline.files;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    const current = scanDir(uploadsDir);
    const backupName = findBackupDir(publicDir);

    if (backupName && backupName !== lastBackup) {
      lastBackup = backupName;
      const backupStats = scanDir(path.join(publicDir, backupName));
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
  };

  const timer = setInterval(tick, POLL_MS);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      const final = scanDir(uploadsDir);
      emit(
        `[assets-progress] monitor stopped — uploads/ final state: `
        + `${final.files} file(s), ${fmtBytes(final.bytes)} `
        + `(delta vs. start: ${final.files - baseline.files})`,
      );
    },
  };
};

module.exports = { startAssetProgressMonitor };
