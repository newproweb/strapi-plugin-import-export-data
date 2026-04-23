"use strict";

const { BASE_AUTH_TABLES } = require("../constants/auth");
const { knex, setFkEnabled } = require("./dialect");

const CORE_STORE_TABLE = "strapi_core_store_settings";

// Aggressive tick rate: the CLI wipes `admin_users` + related auth tables
// briefly, and any admin API request landing in that window returns 401 —
// which the Strapi admin SPA treats as "session lost" and shows a loading
// screen. 500ms keeps that window to at most half a second, so occasional
// SPA polls hit a populated table.
const DEFAULT_INTERVAL_MS = 500;

// Roughly every 10s at the default tick rate — emits a heartbeat so the
// job log shows the patcher is still alive even when no rows needed
// re-injecting this round.
const HEARTBEAT_EVERY_N_TICKS = 20;

/**
 * For a single auth table, re-inserts only the rows that are currently
 * missing in the DB (compared to the captured snapshot). Keeps the working
 * set tiny (diff by id) so each tick is cheap. Never throws — a failure
 * here just means we skip this tick and try again next time.
 *
 * @returns {Promise<number>} number of rows re-inserted during this call.
 */
const ensureRowsPresent = async (db, table, rows) => {
  if (!rows || rows.length === 0) return 0;
  try {
    if (!(await db.schema.hasTable(table))) return 0;
  } catch {
    return 0;
  }

  const snapshotRowsById = rows.filter((r) => r && r.id !== undefined);
  if (snapshotRowsById.length === 0) return 0;

  const snapshotIds = snapshotRowsById.map((r) => r.id);

  let existingIds;
  try {
    existingIds = await db(table).whereIn("id", snapshotIds).pluck("id");
  } catch {
    return 0;
  }

  const existing = new Set(existingIds.map(String));
  const missing = snapshotRowsById.filter((r) => !existing.has(String(r.id)));
  if (missing.length === 0) return 0;

  try {
    await db(table).insert(missing);
    return missing.length;
  } catch (err) {
    strapi.log.debug(`[import-export] live-auth ${table}: insert skipped (${err.message})`);
    return 0;
  }
};

/**
 * Core-store auth keys (JWT secrets, admin auth config) are keyed by `key`,
 * not `id`, so we diff by key rather than by id.
 */
const ensureCoreStoreKeys = async (db, rows) => {
  if (!rows || rows.length === 0) return 0;

  let inserted = 0;
  for (const row of rows) {
    try {
      const { id, ...rest } = row;
      const exists = await db(CORE_STORE_TABLE).where({ key: rest.key }).first();
      if (exists) continue;
      await db(CORE_STORE_TABLE).insert(rest);
      inserted += 1;
    } catch {
      // ignore — another tick will retry
    }
  }
  return inserted;
};

const runPatchTick = async (snapshot) => {
  const db = knex();
  if (!db) return 0;

  let patched = 0;
  await setFkEnabled(db, false);
  try {
    for (const table of BASE_AUTH_TABLES) {
      const rows = snapshot.tables?.[table];
      if (!rows) continue;
      patched += await ensureRowsPresent(db, table, rows);
    }
    patched += await ensureCoreStoreKeys(db, snapshot.coreStore);
  } finally {
    await setFkEnabled(db, true);
  }
  return patched;
};

/**
 * While `strapi import --force` runs, it wipes and replaces `admin_users`,
 * `admin_permissions`, `strapi_api_tokens`, `strapi_sessions`, etc. with
 * the archive's contents — which evicts the currently logged-in admin and
 * makes Strapi's admin API (`/admin/users/me`, `/admin/users/me/permissions`)
 * return 401 for the duration of the import (10+ minutes for large archives).
 *
 * This patcher re-injects the admin auth rows captured before the CLI
 * started, every `intervalMs`, so the admin session keeps working during
 * the import. The CLI may wipe them again — the next tick re-inserts.
 *
 * The patcher is best-effort: it never throws, never blocks, and stops
 * cleanly via the returned `stop()` handle (idempotent). A `replayAuth`
 * snapshot at the end of the restore is still required as the final,
 * authoritative restore of the auth state.
 *
 * @param {object|null} snapshot  Output of `takeAuthSnapshot`. If null or
 *   falsy, this is a no-op — returns a `stop()` that does nothing.
 * @param {(line: string) => void} [emit]  Log sink for user-visible lines.
 * @param {{ intervalMs?: number }} [options]
 * @returns {{ stop: () => void }}
 */
const startLiveAuthPatcher = (snapshot, emit, { intervalMs = DEFAULT_INTERVAL_MS } = {}) => {
  if (!snapshot) return { stop: () => {} };

  emit?.(`[live-auth] patcher ACTIVE — will re-inject admin auth rows every ${intervalMs}ms so admin API requests keep returning 200 during the CLI import`);

  let stopped = false;
  let stopAnnounced = false;
  let cumulativePatched = 0;
  let ticksRun = 0;
  let lastTickBusy = false;

  const tick = async () => {
    if (stopped) return;
    // Use a setTimeout chain instead of setInterval so slow ticks don't
    // pile up in parallel. If the previous tick is still running when the
    // next interval fires, we just skip and wait for it to complete.
    if (lastTickBusy) return;
    lastTickBusy = true;

    try {
      const patched = await runPatchTick(snapshot);
      ticksRun += 1;
      if (patched > 0) cumulativePatched += patched;

      // Periodic heartbeat so the user can see in the job log that the
      // patcher is alive even during stretches where nothing needed to
      // be re-inserted this round.
      if (ticksRun % HEARTBEAT_EVERY_N_TICKS === 0) {
        emit?.(`[live-auth] ${ticksRun} tick(s) run, ${cumulativePatched} row(s) re-injected so far`);
      }
    } catch (err) {
      strapi.log.debug(`[import-export] live-auth tick failed: ${err.message}`);
    } finally {
      lastTickBusy = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  // Kick off the first tick immediately rather than waiting `intervalMs`
  // — the CLI can wipe tables within the first second.
  tick();

  return {
    stop: () => {
      if (stopAnnounced) return;
      stopAnnounced = true;
      stopped = true;
      clearInterval(timer);
      emit?.(`[live-auth] stopped — ${ticksRun} tick(s), ${cumulativePatched} row(s) re-injected during the CLI run`);
    },
  };
};

module.exports = { startLiveAuthPatcher };
