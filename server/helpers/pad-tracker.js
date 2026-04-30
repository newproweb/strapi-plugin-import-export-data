"use strict";

const fs = require("fs");
const path = require("path");

const { backupDir } = require("../utils/fs");

const TRACKER_TTL_MS = 60 * 60 * 1000;

const trackerPath = () => path.join(backupDir(), ".pending-pad.json");

const isPidAlive = (pid) => {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
};

/**
 * Reads the pending-pad tracker file and returns its normalized shape:
 * `{ pid, at, files }`. Accepts the legacy bare-array format too — older
 * trackers (pre-PID upgrade) get treated as if their owner is unknown so
 * they're considered safe to clean up at boot time.
 */
const readTracker = () => {
  const file = trackerPath();
  if (!fs.existsSync(file)) return { pid: null, at: 0, files: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (Array.isArray(raw)) return { pid: null, at: 0, files: raw };
    return {
      pid: Number.isFinite(raw.pid) ? raw.pid : null,
      at: Number.isFinite(raw.at) ? raw.at : 0,
      files: Array.isArray(raw.files) ? raw.files : [],
    };
  } catch {
    return { pid: null, at: 0, files: [] };
  }
};

const writeTracker = (tracker) => {
  const file = trackerPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(tracker, null, 2));
  } catch (err) {
    strapi.log.warn(`[import-export] pad-tracker write failed: ${err.message}`);
  }
};

/**
 * Records the given placeholder paths in the tracker, tagged with the
 * current process's PID and a fresh timestamp. The PID lets `recoverPending`
 * skip cleanup when the writing process is still alive — without it, the
 * spawned `strapi export` child (which boots Strapi and runs our plugin
 * lifecycle) would delete the placeholders the parent created moments
 * before, causing the CLI to fail with ENOENT on the first asset.
 */
const recordPending = (paths) => {
  if (!Array.isArray(paths) || paths.length === 0) return;
  const existing = readTracker();
  const merged = new Set(existing.files);
  for (const p of paths) merged.add(p);
  writeTracker({ pid: process.pid, at: Date.now(), files: [...merged] });
};

const clearPending = (paths) => {
  const file = trackerPath();
  const tracker = readTracker();
  if (!Array.isArray(paths) || paths.length === 0) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch { /* ignore */ }
    return;
  }
  const remove = new Set(paths);
  const remaining = tracker.files.filter((p) => !remove.has(p));
  if (remaining.length === 0) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch { /* ignore */ }
  } else {
    writeTracker({ pid: tracker.pid, at: tracker.at, files: remaining });
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

/**
 * Cleans up leftover placeholder files from a prior crashed export. Skips
 * cleanup when the tracker's PID is still alive and recent — that means
 * another process is mid-export and owns those placeholders. Older
 * trackers (>1h) or those whose PID is dead are treated as orphaned and
 * fully cleaned up.
 */
const recoverPending = () => {
  const tracker = readTracker();
  if (tracker.files.length === 0) return { scanned: 0, removed: 0 };

  const ownerStillRunning =
    tracker.pid
    && tracker.pid !== process.pid
    && Date.now() - tracker.at < TRACKER_TTL_MS
    && isPidAlive(tracker.pid);

  if (ownerStillRunning) {
    return { scanned: tracker.files.length, removed: 0, skipped: "owner-alive" };
  }

  let removed = 0;
  for (const full of tracker.files) {
    if (!isSafePlaceholder(full)) continue;
    try { fs.unlinkSync(full); removed += 1; } catch { /* ignore */ }
  }

  try { fs.unlinkSync(trackerPath()); } catch { /* ignore */ }

  return { scanned: tracker.files.length, removed };
};

module.exports = { recordPending, clearPending, recoverPending, trackerPath };
