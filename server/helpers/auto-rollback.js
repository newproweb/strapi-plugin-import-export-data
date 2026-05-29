"use strict";

const { runStrapiCli } = require("./cli");
const { buildImportArgs } = require("./cli-args");
const { getBackupPath } = require("./archives");
const { autoSendPreRestore } = require("./transfer");

/**
 * Best-effort automatic rollback: re-imports the pre-restore snapshot via
 * `strapi import --force`, bringing the DB back to the state it had right
 * before the failed restore attempt.
 *
 * Designed to never throw. On rollback failure, additionally emails the
 * snapshot download link to the recipients saved in plugin settings so the
 * operator has out-of-band access for manual recovery — the in-band UI flow
 * may itself be broken by the partial DB state.
 *
 * @returns {Promise<{ rolledBack: boolean, reason?: string, error?: Error, emailed?: boolean }>}
 */
const autoRollbackFromSnapshot = async (preSnapshot, emit, onLog) => {
  if (!preSnapshot?.file) {
    emit("[safeguard] cannot auto-rollback: no pre-snapshot available. DB may be in a partial state — manual recovery required.");
    return { rolledBack: false, reason: "no-snapshot" };
  }

  const filePath = getBackupPath(preSnapshot.file);
  emit(`[safeguard] attempting automatic rollback from ${preSnapshot.file}…`);

  return runStrapiCli(buildImportArgs({ filePath }), { onLog })
    .then(() => {
      emit("[safeguard] rollback SUCCEEDED — DB restored to the pre-import state");
      return { rolledBack: true };
    })
    .catch(async (err) => {
      emit(
        `[safeguard] CRITICAL: rollback FAILED (${err.message}). `
        + `DB is in a partial state — manual recovery from ${preSnapshot.file} is required.`,
      );
      const emailed = await autoSendPreRestore(preSnapshot.file, emit)
        .then(() => true)
        .catch(() => false);
      return { rolledBack: false, reason: "rollback-failed", error: err, emailed };
    });
};

module.exports = { autoRollbackFromSnapshot };
