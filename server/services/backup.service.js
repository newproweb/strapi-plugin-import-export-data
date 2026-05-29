"use strict";

const fs = require("fs");
const path = require("path");

const { backupDir, ensureBackupDir, isoSlug, resolveExportedPath } = require("../utils/fs");
const { runStrapiCli } = require("../helpers/cli");
const { getJob, getJobToken, listJobs } = require("../helpers/jobs");
const { takeAuthSnapshot, replayAuthSnapshot } = require("../helpers/auth-snapshot");
const { startLiveAuthPatcher } = require("../helpers/live-auth-patcher");
const { autoRollbackFromSnapshot } = require("../helpers/auto-rollback");
const { assertDevConfig } = require("../helpers/dev-config-check");
const { padMissingUploadFiles, cleanupPaddedFiles, summarizeUploads } = require("../helpers/uploads");
const { adoptOrphanUploads } = require("../helpers/orphan-adopt");
const { emitExportDiagnostics } = require("../helpers/diagnostics");
const { listBackups, getBackupPath, deleteBackup, stageUploadedArchive, stageExternalFile, pruneOldBackups } = require("../helpers/archives");
const { sanitizePrefix, buildExportArgs, buildImportArgs } = require("../helpers/cli-args");
const { makeLogEmitter } = require("../helpers/emitter");
const { describeArchive } = require("../helpers/archive-describe");
const { runInBackground } = require("../helpers/background-job");
const { requestJobAbort } = require("../helpers/job-store");
const { autoSendPreRestore } = require("../helpers/transfer");
const { validateArchive } = require("../helpers/archive-validate");
const { assertSizeWithinLimit } = require("../helpers/body-limit");
const { startAssetProgressMonitor } = require("../helpers/asset-progress-monitor");
const { extractAssetsFromArchive } = require("../helpers/parallel-assets");
const { JOB_TYPES } = require("../constants/jobs");

const appendExclude = (exclude, addition) => {
  const current = String(exclude || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!current.includes(addition)) current.push(addition);
  return current.join(",");
};

const preExtractAssetsIfApplicable = async ({ filePath, exclude, only, emit, onLog, setStage }) => {
  const excludesFiles = /\bfiles\b/.test(String(exclude || ""));
  const onlyExcludesAssets = String(only || "").trim() && !/\bfiles\b/.test(String(only));
  const isEncrypted = filePath.toLowerCase().endsWith(".enc");

  emit(`[parallel-assets] check: exclude="${exclude || ""}", only="${only || ""}", encrypted=${isEncrypted}, willPreExtract=${!(excludesFiles || onlyExcludesAssets || isEncrypted)}`);

  if (excludesFiles || onlyExcludesAssets || isEncrypted) return { applied: false, stats: null };

  setStage?.("Extracting assets in parallel…", 15);
  emit("[parallel-assets] pre-extracting uploads/* in parallel (16 workers)");
  const stats = await extractAssetsFromArchive(filePath, { onLog }).catch((err) => {
    emit(`[parallel-assets] failed (${err.message}) — falling back to CLI default assets handling`);
    return null;
  });
  if (!stats || stats.skipped) return { applied: false, stats };

  const mb = (stats.bytes / (1024 * 1024)).toFixed(1);
  const sec = (stats.durationMs / 1000).toFixed(1);
  emit(`[parallel-assets] done — ${stats.extracted} file(s), ${mb} MB in ${sec}s — Strapi CLI will skip assets`);
  return { applied: true, stats };
};

const assertArchiveExists = (archivePath, basePath) => {
  if (!archivePath || !fs.existsSync(archivePath)) {
    throw new Error(`strapi export reported success but no archive was found at ${basePath}.*`);
  }
};

const createBackup = async ({ encrypt = false, key, compress = true, exclude, prefix = "backup", adoptOrphans = false, shouldAbort } = {}, onLog) => {
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
    result = await runStrapiCli(buildExportArgs({ basePath, encrypt, key, compress, exclude }), { onLog, shouldAbort });
  } finally {
    await cleanupPaddedFiles(padded, emit);
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

const makeBridge = (onLog) => (evt) => {
  if (!onLog) return;
  const line = typeof evt === "string" ? evt : (evt?.line || "");
  if (!line) return;
  onLog({ stream: (typeof evt === "object" && evt?.stream) || "stdout", line: `[pre-restore] ${line}` });
};

const makePreRestoreSnapshot = async (emit, onLog, { mode = "full" } = {}) => {
  const bridge = makeBridge(onLog);
  emit("[safeguard] creating pre-restore snapshot before import…");

  if (mode === "db-only") {
    emit("[safeguard] DB-only snapshot — assets skipped, rollback covers data only");
    const snap = await runDbOnlySnapshot(bridge);
    emit(`[safeguard] DB-only snapshot created: ${snap.file}`);
    return snap;
  }

  const precheck = await detectFullSnapshotWillFail();
  if (precheck.willFail) {
    emit(`[safeguard] ${precheck.missing} file(s) missing on disk — switching to DB-only snapshot`);
    const snap = await runDbOnlySnapshot(bridge);
    emit(`[safeguard] DB-only snapshot created: ${snap.file}`);
    return snap;
  }

  try {
    const snap = await createBackup({ encrypt: false, compress: true, prefix: "pre-restore", adoptOrphans: false }, bridge);
    emit(`[safeguard] full snapshot created: ${snap.file}`);
    return snap;
  } catch (err) {
    emit(`[safeguard] full snapshot failed (${err.message}) — retrying as DB-only`);
    cleanupPartialSnapshots("pre-restore", emit);
    const snap = await runDbOnlySnapshot(bridge);
    emit(`[safeguard] DB-only snapshot created: ${snap.file}`);
    return snap;
  }
};

const restoreBackup = async (
  fileName,
  { key, exclude, only, preserveAuth = true, preRestoreSnapshot = "full", deepValidate = false, shouldAbort } = {},
  onLog,
  setStage,
) => {
  const filePath = getBackupPath(fileName);
  const emit = makeLogEmitter(onLog);

  const validation = validateArchive(filePath, emit, { deep: deepValidate });
  assertSizeWithinLimit(validation.size, fileName);

  let preSnapshot = null;
  if (preRestoreSnapshot !== "off") {
    setStage?.("Creating pre-restore snapshot…", 5);
    preSnapshot = await makePreRestoreSnapshot(emit, onLog, { mode: preRestoreSnapshot }).catch((err) => {
      throw new Error(
        `pre-restore snapshot failed (${err.message}) — aborting import to protect current DB. `
        + "Disable 'preRestoreSnapshot' in Settings if you accept the risk.",
      );
    });
  } else {
    emit("[safeguard] pre-restore snapshot SKIPPED (setting disabled) — current DB will be overwritten");
  }

  if (preSnapshot?.file) await autoSendPreRestore(preSnapshot.file, emit);

  const snapshot = preserveAuth ? await takeAuthSnapshot(emit) : null;
  const patcher = startLiveAuthPatcher(snapshot, emit);
  const started = Date.now();

  const parallelAssets = await preExtractAssetsIfApplicable({ filePath, exclude, only, emit, onLog, setStage });
  const effectiveExclude = parallelAssets.applied ? appendExclude(exclude, "files") : exclude;

  const excludesFiles = /\bfiles\b/.test(String(effectiveExclude || ""));
  const monitor = excludesFiles ? null : startAssetProgressMonitor(emit);

  setStage?.("Importing data…", 30);

  const result = await runStrapiCli(
    buildImportArgs({ filePath, key, exclude: effectiveExclude, only }),
    { onLog, shouldAbort },
  ).catch((err) => ({ _cliError: err }));

  const cliError = result?._cliError;
  let rollback = null;
  if (cliError) {
    emit(`[safeguard] import CLI failed: ${cliError.message}`);
    await patcher.stop();
    if (preSnapshot) {
      rollback = await autoRollbackFromSnapshot(preSnapshot, emit, onLog);
    } else {
      emit("[safeguard] WARNING: no pre-snapshot available — DB may be in a partial state, manual recovery needed");
    }
  }

  await patcher.stop();
  if (monitor) await monitor.stop();
  if (snapshot) await replayAuthSnapshot(snapshot, emit).catch((err) => { throw err; });

  if (cliError) {
    if (rollback && rollback.rolledBack === false && rollback.reason === "rollback-failed") {
      const tail = rollback.emailed
        ? " — snapshot link emailed to operators for manual recovery"
        : " — manual recovery from the pre-restore snapshot is required";
      const combined = new Error(`${cliError.message}; rollback also failed (${rollback.error?.message || "unknown"})${tail}`);
      combined.cause = cliError;
      throw combined;
    }
    throw cliError;
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
  assertDevConfig();
  return runInBackground(JOB_TYPES.EXPORT, (onLog, shouldAbort, setStage) => {
    setStage?.("Exporting…", 5);
    return createBackup({ ...options, shouldAbort }, onLog);
  });
};

const restoreBackupJob = (fileName, options = {}) => {
  assertDevConfig();
  return runInBackground(JOB_TYPES.IMPORT, (onLog, shouldAbort, setStage) => restoreBackup(fileName, { ...options, shouldAbort }, onLog, setStage));
};

module.exports = () => ({
  backupDir,
  listBackups,
  createBackup,
  restoreBackup,
  createBackupJob,
  restoreBackupJob,
  getJob,
  getJobToken,
  requestJobAbort,
  listJobs,
  deleteBackup,
  getBackupPath,
  stageUploadedArchive,
  stageExternalFile,
  pruneOldBackups,
});
