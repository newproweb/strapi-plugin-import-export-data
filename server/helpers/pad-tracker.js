"use strict";

const fs = require("fs");
const path = require("path");

const { backupDir } = require("../utils/fs");

const trackerPath = () => path.join(backupDir(), ".pending-pad.json");

const readTracker = () => {
  const file = trackerPath();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const writeTracker = (list) => {
  const file = trackerPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(list, null, 2));
  } catch (err) {
    strapi.log.warn(`[import-export] pad-tracker write failed: ${err.message}`);
  }
};

const recordPending = (paths) => {
  if (!Array.isArray(paths) || paths.length === 0) return;
  const current = new Set(readTracker());
  for (const p of paths) current.add(p);
  writeTracker([...current]);
};

const clearPending = (paths) => {
  const file = trackerPath();
  if (!Array.isArray(paths) || paths.length === 0) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch { /* ignore */ }
    return;
  }
  const remove = new Set(paths);
  const remaining = readTracker().filter((p) => !remove.has(p));
  if (remaining.length === 0) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch { /* ignore */ }
  } else {
    writeTracker(remaining);
  }
};

const isSafePlaceholder = (full) => {
  try {
    const stat = fs.statSync(full);
    return stat.isFile() && stat.size === 0;
  } catch {
    return false;
  }
};

const recoverPending = () => {
  const pending = readTracker();
  if (pending.length === 0) return { scanned: 0, removed: 0 };

  let removed = 0;
  for (const full of pending) {
    if (!isSafePlaceholder(full)) continue;
    try { fs.unlinkSync(full); removed += 1; } catch { /* ignore */ }
  }

  try { fs.unlinkSync(trackerPath()); } catch { /* ignore */ }

  return { scanned: pending.length, removed };
};

module.exports = { recordPending, clearPending, recoverPending, trackerPath };
