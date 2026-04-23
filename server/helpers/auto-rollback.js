"use strict";

const { runStrapiCli } = require("./cli");
const { buildImportArgs } = require("./cli-args");
const { getBackupPath } = require("./archives");

/**
 * Best-effort automatic rollback: re-imports the pre-restore snapshot
 * archive via `strapi import --force`, bringing the DB back to the state
 * it had right before the failed restore attempt.
 *
 * Designed to never throw: every failure path is emitted to the job log
 * with enough context for manual recovery. The caller is expected to
 * re-throw the ORIGINAL CLI error after calling this — the UI should
 * still report the restore as failed even if the rollback succeeded.
 *
 * @param {{ file?: string } | null} preSnapshot  Snapshot metadata from
 *   `makePreRestoreSnapshot`. If missing or lacking a `file` property,
 *   the rollback is skipped with a warning.
 * @param {(line: string) => void} emit  Log sink for user-visible lines.
 * @param {(evt: { stream: string, line: string }) => void} [onLog]
 *   Optional raw CLI log sink for forwarding child-process output.
 * @returns {Promise<{ rolledBack: boolean, reason?: string, error?: Error }>}
 */
const autoRollbackFromSnapshot = async (preSnapshot, emit, onLog) => {
  if (!preSnapshot?.file) {
    emit(`[safeguard] cannot auto-rollback: no pre-snapshot available. DB may be in a partial state — manual recovery required.`);
    return { rolledBack: false, reason: "no-snapshot" };
  }

  const filePath = getBackupPath(preSnapshot.file);
  emit(`[safeguard] attempting automatic rollback from ${preSnapshot.file}…`);

  try {
    await runStrapiCli(buildImportArgs({ filePath }), { onLog });
    emit(`[safeguard] rollback SUCCEEDED — DB restored to the pre-import state`);
    return { rolledBack: true };
  } catch (err) {
    emit(
      `[safeguard] CRITICAL: rollback FAILED (${err.message}). `
      + `DB is in a partial state — manual recovery from ${preSnapshot.file} is required.`,
    );
    return { rolledBack: false, reason: "rollback-failed", error: err };
  }
};

module.exports = { autoRollbackFromSnapshot };
