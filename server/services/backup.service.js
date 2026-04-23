"use strict";

const fs = require("fs");
const path = require("path");

const { backupDir, ensureBackupDir, isoSlug, resolveExportedPath } = require("../utils/fs");
const { runStrapiCli } = require("../helpers/cli");
const { getJob, listJobs } = require("../helpers/jobs");
const { takeAuthSnapshot, replayAuthSnapshot } = require("../helpers/auth-snapshot");
const { startLiveAuthPatcher } = require("../helpers/live-auth-patcher");
const { autoRollbackFromSnapshot } = require("../helpers/auto-rollback");
const { assertDevConfig } = require("../helpers/dev-config-check");
const { padMissingUploadFiles, cleanupPaddedFiles, summarizeUploads } = require("../helpers/uploads");
const { adoptOrphanUploads } = require("../helpers/orphan-adopt");
const { emitExportDiagnostics } = require("../helpers/diagnostics");
const { listBackups, getBackupPath, deleteBackup, stageUploadedArchive, pruneOldBackups } = require("../helpers/archives");
const { sanitizePrefix, buildExportArgs, buildImportArgs } = require("../helpers/cli-args");
const { makeLogEmitter } = require("../helpers/emitter");
const { describeArchive } = require("../helpers/archive-describe");
const { runInBackground } = require("../helpers/background-job");
const { validateArchive } = require("../helpers/archive-validate");
const { assertSizeWithinLimit } = require("../helpers/body-limit");
const { startAssetProgressMonitor } = require("../helpers/asset-progress-monitor");
const { JOB_TYPES } = require("../constants/jobs");

const assertArchiveExists = (archivePath, basePath) => {
  if (!archivePath || !fs.existsSync(archivePath)) {
    throw new Error(`strapi export reported success but no archive was found at ${basePath}.*`);
  }
};

const createBackup = async ({ encrypt = false, key, compress = true, exclude, prefix = "backup", adoptOrphans = false } = {}, onLog) => {
  const dir = ensureBackupDir();
  const id = `${sanitizePrefix(prefix)}-${isoSlug()}`;
  const basePath = path.join(dir, id);
  const excludesFiles = /\bfiles\b/.test(String(exclude || ""));
  const emit = makeLogEmitter(onLog);

  await emitExportDiagnostics({ excludesFiles, emit });

  if (!excludesFiles && adoptOrphans) {
    await adoptOrphanUploads(emit);
  } else if (!excludesFiles) {
    emit(`[adopt] skipped — adoptOrphans setting is OFF (enable it in Settings to include orphan files on disk)`);
  }

  const padded = excludesFiles ? [] : await padMissingUploadFiles(emit);
  const started = Date.now();

  let result;
  try {
    result = await runStrapiCli(buildExportArgs({ basePath, encrypt, key, compress, exclude }), { onLog });
  } finally {
    cleanupPaddedFiles(padded, emit);
  }

  const archivePath = resolveExportedPath(basePath, { encrypt, compress });
  assertArchiveExists(archivePath, basePath);

  return describeArchive({
    archivePath,
    id,
    started,
    paddedCount: padded.length,
    cliStdout: result.stdout,
  });
};

const cleanupPartialSnapshots = (prefix, emit) => {
  try {
    const dir = backupDir();
    if (!fs.existsSync(dir)) return;
    let removed = 0;
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith(`${prefix}-`)) continue;
      try { fs.rmSync(path.join(dir, name), { force: true }); removed += 1; } catch { /* ignore */ }
    }
    if (removed > 0 && emit) emit(`[safeguard] removed ${removed} partial/crashed snapshot file(s) from the failed attempt`);
  } catch { /* ignore */ }
};

const countUploadRows = async () => {
  try { return await strapi.db.query("plugin::upload.file").count(); }
  catch { return null; }
};

const detectFullSnapshotWillFail = async () => {
  const uploads = summarizeUploads();
  if (!uploads.path) return { willFail: false };
  const dbCount = await countUploadRows();
  if (dbCount === null) return { willFail: false };
  if (uploads.files < dbCount) {
    return { willFail: true, missing: dbCount - uploads.files, disk: uploads.files, db: dbCount };
  }
  return { willFail: false };
};

const runDbOnlySnapshot = async (bridge) => createBackup({ encrypt: false, compress: true, exclude: "files", prefix: "pre-restore-dbonly", adoptOrphans: false }, bridge);

const makePreRestoreSnapshot = async (emit, onLog) => {
  emit(`[safeguard] creating pre-restore snapshot before import…`);
  const bridge = (evt) => {
    if (!onLog) return;
    if (typeof evt === "string") {
      onLog({ stream: "stdout", line: `[pre-restore] ${evt}` });
      return;
    }

    const line = evt?.line || "";
    if (!line) return;
    onLog({ stream: evt.stream || "stdout", line: `[pre-restore] ${line}` });
  };

  const precheck = await detectFullSnapshotWillFail();
  if (precheck.willFail) {
    emit(
      `[safeguard] skipping full snapshot attempt — ${precheck.missing} file(s) referenced by DB are missing on disk `
      + `(disk=${precheck.disk}, db=${precheck.db}). A full export would crash on the first missing asset.`,
    );

    emit(`[safeguard] running DB-only snapshot (exclude=files) — assets will NOT be backed up`);

    const dbOnly = await runDbOnlySnapshot(bridge);
    emit(`[safeguard] DB-only snapshot created: ${dbOnly.file}`);
    return dbOnly;
  }

  try {
    const snapshotMeta = await createBackup({ encrypt: false, compress: true, exclude: undefined, prefix: "pre-restore", adoptOrphans: false }, bridge);
    emit(`[safeguard] pre-restore snapshot created: ${snapshotMeta.file}`);

    return snapshotMeta;
  } catch (err) {
    emit(`[safeguard] full snapshot failed (${err.message})`);
    cleanupPartialSnapshots("pre-restore", emit);
    emit(`[safeguard] retrying DB-only snapshot (exclude=files) — assets will NOT be backed up`);

    const dbOnly = await runDbOnlySnapshot(bridge);
    emit(
      `[safeguard] DB-only snapshot created: ${dbOnly.file}. `
      + `If the upcoming import overwrites your uploads/ dir you will lose the current files; `
      + `fix the missing/orphaned files and re-run to capture a full snapshot next time.`,
    );
    return dbOnly;
  }
};

const restoreBackup = async (
  fileName,
  { key, exclude, preserveAuth = true, preRestoreSnapshot = true } = {},
  onLog,
) => {
  const filePath = getBackupPath(fileName);
  const emit = makeLogEmitter(onLog);

  const validation = validateArchive(filePath, emit);
  assertSizeWithinLimit(validation.size, fileName);

  let preSnapshot = null;
  if (preRestoreSnapshot) {
    try {
      preSnapshot = await makePreRestoreSnapshot(emit, onLog);
    } catch (err) {
      throw new Error(
        `pre-restore snapshot failed (${err.message}) — aborting import to protect current DB. `
        + "Disable 'preRestoreSnapshot' in Settings if you accept the risk.",
      );
    }
  } else {
    emit(`[safeguard] pre-restore snapshot SKIPPED (setting disabled) — current DB will be overwritten`);
  }

  const snapshot = preserveAuth ? await takeAuthSnapshot(emit) : null;
  const patcher = startLiveAuthPatcher(snapshot, emit);

  const started = Date.now();
  const excludesFiles = /\bfiles\b/.test(String(exclude || ""));
  const monitor = excludesFiles ? null : startAssetProgressMonitor(emit);

  let result;
  try {
    try {
      result = await runStrapiCli(buildImportArgs({ filePath, key, exclude }), { onLog });
    } catch (cliErr) {
      emit(`[safeguard] import CLI failed: ${cliErr.message}`);
      // Stop the patcher before starting the rollback CLI so they don't
      // race each other on the same auth tables.
      patcher.stop();
      if (preSnapshot) {
        await autoRollbackFromSnapshot(preSnapshot, emit, onLog);
      } else {
        emit(`[safeguard] WARNING: no pre-snapshot available — DB may be in a partial state, manual recovery needed`);
      }
      throw cliErr;
    }
  } finally {
    patcher.stop();
    if (monitor) monitor.stop();
    // Always re-apply the auth snapshot, whether the CLI succeeded, failed,
    // or failed-then-rolled-back. `replayAuthSnapshot` is internally safe
    // (logs its own errors, never throws), so this runs unguarded.
    if (snapshot) await replayAuthSnapshot(snapshot, emit);
  }

  return {
    file: fileName,
    durationMs: Date.now() - started,
    restartRecommended: true,
    authPreserved: Boolean(snapshot),
    preSnapshot: preSnapshot ? preSnapshot.file : null,
    cliStdout: result.stdout.slice(-2000),
  };
};

const createBackupJob = (options = {}) => {
  // Pre-flight: in `strapi develop` we must ensure chokidar isn't watching
  // the backup dir, otherwise writing the archive mid-job will auto-restart
  // Strapi and kill the CLI. Throws HTTP 412 synchronously before we spawn
  // anything so the user sees a clear, actionable error instead of a
  // broken job that dies silently.
  assertDevConfig();
  return runInBackground(JOB_TYPES.EXPORT, (onLog) => createBackup(options, onLog));
};

const restoreBackupJob = (fileName, options = {}) => {
  assertDevConfig();
  return runInBackground(JOB_TYPES.IMPORT, (onLog) => restoreBackup(fileName, options, onLog));
};

module.exports = () => ({
  backupDir,
  listBackups,
  createBackup,
  restoreBackup,
  createBackupJob,
  restoreBackupJob,
  getJob,
  listJobs,
  deleteBackup,
  getBackupPath,
  stageUploadedArchive,
  pruneOldBackups,
});
