"use strict";

/**
 * Patterns that MUST appear in `admin.watchIgnoreFiles` in `strapi develop`
 * mode, otherwise chokidar auto-restarts the Strapi process the moment a
 * backup archive is written to `./data/backups/` — which kills the
 * in-flight `strapi import` / `strapi export` child process and leaves
 * the job in a broken, unrecoverable state.
 */
const REQUIRED_WATCH_IGNORE_PATTERNS = ["**/data/backups/**"];

/**
 * True when we are running under `strapi develop` (i.e. chokidar is
 * watching and will auto-restart on file changes). Strapi sets
 * NODE_ENV="development" for `strapi develop` and "production" (or
 * whatever the user passed) for `strapi start`.
 */
const isDevMode = () => process.env.NODE_ENV === "development";

const readWatchIgnoreFiles = () => {
  try {
    const value = strapi.config.get("admin.watchIgnoreFiles");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

/**
 * Checks the current Strapi config for the required watch-ignore patterns.
 * Skips the check outside dev mode — `strapi start` has no chokidar, so
 * `watchIgnoreFiles` is irrelevant there.
 *
 * @returns {{ ok: true } | { ok: true, skipped: string } | { ok: false, missing: string[], current: string[] }}
 */
const checkWatchIgnoreFiles = () => {
  if (!isDevMode()) return { ok: true, skipped: "not-dev-mode" };

  const current = readWatchIgnoreFiles();
  const missing = REQUIRED_WATCH_IGNORE_PATTERNS.filter((pattern) => !current.includes(pattern));
  if (missing.length === 0) return { ok: true };

  return { ok: false, missing, current };
};

const formatMissingConfigMessage = (check) => {
  const patternLines = check.missing.map((p) => `    "${p}",`).join("\n");
  return (
    "Missing 'watchIgnoreFiles' config in admin/config/admin.js.\n\n"
    + "In 'strapi develop' mode, chokidar watches the whole project and "
    + "auto-restarts the server on any file change — including when this "
    + "plugin writes backup archives to ./data/backups/. That restart "
    + "kills the in-flight strapi import/export CLI and leaves your "
    + "job in an unrecoverable state.\n\n"
    + "Add these patterns to admin/config/admin.js:\n"
    + "  watchIgnoreFiles: [\n"
    + `${patternLines}\n`
    + "  ]\n\n"
    + "Then restart 'strapi develop' and retry."
  );
};

/**
 * Throws a 412 PreconditionFailed error if the dev-mode config is missing
 * the required `watchIgnoreFiles` patterns. Called synchronously at the
 * start of every user-initiated backup/restore so the HTTP request fails
 * up-front with a clear, actionable message — before any CLI spawn.
 *
 * No-op outside `strapi develop` mode.
 */
const assertDevConfig = () => {
  const check = checkWatchIgnoreFiles();
  if (check.ok) return;

  const err = new Error(formatMissingConfigMessage(check));
  err.status = 412;
  err.name = "PreconditionFailed";
  err.code = "DEV_CONFIG_MISSING";
  throw err;
};

module.exports = { isDevMode, checkWatchIgnoreFiles, assertDevConfig };
