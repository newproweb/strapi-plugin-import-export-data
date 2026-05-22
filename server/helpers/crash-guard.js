"use strict";

/**
 * Process-level crash guard, armed only while the plugin runs a CLI job.
 *
 * A long import/export stresses the host database. A transient failure in
 * UNRELATED host code during that window — e.g. an unguarded cron whose query
 * times out — would otherwise surface as an `unhandledRejection` or
 * `uncaughtException` and kill the whole Strapi process. While armed, the
 * guard logs such errors and keeps the process alive. It is disarmed the
 * moment the job ends, so the plugin never permanently alters host crash
 * behaviour and never hides bugs outside its own risk window.
 */

let depth = 0;
let onRejection = null;
let onException = null;

const report = (kind, err) => {
  const detail = (err && err.stack) || (err && err.message) || String(err);
  try {
    if (typeof strapi !== "undefined" && strapi && strapi.log && strapi.log.error) {
      strapi.log.error(
        `[import-export] [crash-guard] suppressed ${kind} while a backup job was running — host process kept alive:\n${detail}`,
      );
      return;
    }
  } catch { /* fall through to console */ }
  console.error(`[import-export] [crash-guard] suppressed ${kind}:`, detail);
};

/** Arms the guard. Reference-counted, so overlapping calls are safe. */
const arm = () => {
  depth += 1;
  if (depth > 1) return;
  onRejection = (reason) => report("unhandledRejection", reason);
  onException = (err) => report("uncaughtException", err);
  process.on("unhandledRejection", onRejection);
  process.on("uncaughtException", onException);
};

/** Disarms the guard once every `arm()` has a matching `disarm()`. */
const disarm = () => {
  if (depth === 0) return;
  depth -= 1;
  if (depth > 0) return;
  if (onRejection) process.removeListener("unhandledRejection", onRejection);
  if (onException) process.removeListener("uncaughtException", onException);
  onRejection = null;
  onException = null;
};

module.exports = { arm, disarm };
