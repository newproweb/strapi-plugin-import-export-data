"use strict";

const fs = require("fs");
const path = require("path");

const { backupDir, ensureBackupDir, isoSlug, resolveExportedPath } = require("../utils/fs");
const { runStrapiCli } = require("../helpers/cli");
const { getJob, listJobs } = require("../helpers/jobs");
const { takeAuthSnapshot, replayAuthSnapshot } = require("../helpers/auth-snapshot");
const { padMissingUploadFiles, cleanupPaddedFiles } = require("../helpers/uploads");
const { adoptOrphanUploads } = require("../helpers/orphan-adopt");
const { emitExportDiagnostics } = require("../helpers/diagnostics");
const { listBackups, getBackupPath, deleteBackup, stageUploadedArchive, pruneOldBackups } = require("../helpers/archives");
const { sanitizePrefix, buildExportArgs, buildImportArgs } = require("../helpers/cli-args");
const { makeLogEmitter } = require("../helpers/emitter");
const { describeArchive } = require("../helpers/archive-describe");
const { runInBackground } = require("../helpers/background-job");
const { JOB_TYPES } = require("../constants/jobs");

const assertArchiveExists = (archivePath, basePath) => {
  if (!archivePath || !fs.existsSync(archivePath)) {
    throw new Error(`strapi export reported success but no archive was found at ${basePath}.*`);
  }
};

const createBackup = async ({ encrypt = false, key, compress = true, exclude, prefix = "backup" } = {}, onLog) => {
  const dir = ensureBackupDir();
  const id = `${sanitizePrefix(prefix)}-${isoSlug()}`;
  const basePath = path.join(dir, id);
  const excludesFiles = /\bfiles\b/.test(String(exclude || ""));
  const emit = makeLogEmitter(onLog);

  await emitExportDiagnostics({ excludesFiles, emit });

  if (!excludesFiles) await adoptOrphanUploads(emit);

  const padded = excludesFiles ? [] : await padMissingUploadFiles(emit);
  const started = Date.now();

  let result;
  try {
    result = await runStrapiCli(
      buildExportArgs({ basePath, encrypt, key, compress, exclude }),
      { onLog },
    );
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

const restoreBackup = async (fileName, { key, exclude, preserveAuth = true } = {}, onLog) => {
  const filePath = getBackupPath(fileName);
  const emit = makeLogEmitter(onLog);

  const snapshot = preserveAuth ? await takeAuthSnapshot(emit) : null;
  const started = Date.now();
  const result = await runStrapiCli(buildImportArgs({ filePath, key, exclude }), { onLog });
  await replayAuthSnapshot(snapshot, emit);

  return {
    file: fileName,
    durationMs: Date.now() - started,
    restartRecommended: true,
    authPreserved: Boolean(snapshot),
    cliStdout: result.stdout.slice(-2000),
  };
};

const createBackupJob = (options = {}) => runInBackground(JOB_TYPES.EXPORT, (onLog) => createBackup(options, onLog));

const restoreBackupJob = (fileName, options = {}) => runInBackground(JOB_TYPES.IMPORT, (onLog) => restoreBackup(fileName, options, onLog));

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
