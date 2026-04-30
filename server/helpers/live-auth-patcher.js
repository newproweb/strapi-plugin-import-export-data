"use strict";

const { BASE_AUTH_TABLES } = require("../constants/auth");
const { knex, setFkEnabled } = require("./dialect");

const CORE_STORE_TABLE = "strapi_core_store_settings";

const DEFAULT_INTERVAL_MS = 500;

const HEARTBEAT_EVERY_N_TICKS = 20;

const ERROR_LOG_THROTTLE = 5;

/**
 * Build the list of non-PK column names from the snapshot rows so the upsert
 * `.merge([...])` clause knows which columns to overwrite on conflict.
 */
const nonPkColumns = (rows) => {
  const cols = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row || {})) if (key !== "id") cols.add(key);
  }
  return [...cols];
};

/**
 * Upserts every snapshot row by `id` — on conflict, the existing row is
 * OVERWRITTEN with the snapshot column values. Previously this used
 * `.onConflict('id').ignore()` which kept whatever the import CLI had just
 * inserted (e.g. develop's admin user) and never restored the local user,
 * causing 401 "session invalidated" mid-import on cross-server restores.
 *
 * @returns {Promise<{ upserted: number, error: Error | null }>}
 */
const ensureRowsPresent = async (db, table, rows) => {
  if (!rows || rows.length === 0) return { upserted: 0, error: null };

  try {
    if (!(await db.schema.hasTable(table))) return { upserted: 0, error: null };
  } catch (err) {
    return { upserted: 0, error: err };
  }

  const snapshotRowsById = rows.filter((r) => r && r.id !== undefined);
  if (snapshotRowsById.length === 0) return { upserted: 0, error: null };

  const mergeCols = nonPkColumns(snapshotRowsById);

  try {
    if (mergeCols.length === 0) {
      await db(table).insert(snapshotRowsById).onConflict("id").ignore();
    } else {
      await db(table).insert(snapshotRowsById).onConflict("id").merge(mergeCols);
    }
    return { upserted: snapshotRowsById.length, error: null };
  } catch (err) {
    return { upserted: 0, error: err };
  }
};

/**
 * Core-store auth keys (JWT secrets, admin auth config) are keyed by `key`,
 * not `id`. Upsert with merge so the snapshot value always wins over whatever
 * the import CLI just wrote — same reasoning as `ensureRowsPresent`.
 */
const ensureCoreStoreKeys = async (db, rows) => {
  if (!rows || rows.length === 0) return { upserted: 0, error: null };

  let upserted = 0;
  let lastError = null;
  for (const row of rows) {
    const { id: _ignored, ...rest } = row;
    const mergeCols = Object.keys(rest).filter((k) => k !== "key");
    try {
      if (mergeCols.length === 0) {
        await db(CORE_STORE_TABLE).insert(rest).onConflict("key").ignore();
      } else {
        await db(CORE_STORE_TABLE).insert(rest).onConflict("key").merge(mergeCols);
      }
      upserted += 1;
    } catch (err) {
      lastError = err;
    }
  }
  return { upserted, error: lastError };
};

const runPatchTick = async (snapshot, errorBucket) => {
  const db = knex();
  if (!db) return 0;

  let patched = 0;
  await setFkEnabled(db, false);
  try {
    for (const table of BASE_AUTH_TABLES) {
      const rows = snapshot.tables?.[table];
      if (!rows) continue;
      const { upserted, error } = await ensureRowsPresent(db, table, rows);
      patched += upserted;
      if (error) errorBucket.push({ table, message: error.message });
    }
    const coreResult = await ensureCoreStoreKeys(db, snapshot.coreStore);
    patched += coreResult.upserted;
    if (coreResult.error) errorBucket.push({ table: CORE_STORE_TABLE, message: coreResult.error.message });
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
 * @param {object|null} snapshot  Output of `takeAuthSnapshot`. If null or
 *   falsy, this is a no-op — returns a `stop()` that does nothing.
 * @param {(line: string) => void} [emit]  Log sink for user-visible lines.
 * @param {{ intervalMs?: number }} [options]
 * @returns {{ stop: () => void }}
 */
const startLiveAuthPatcher = (snapshot, emit, { intervalMs = DEFAULT_INTERVAL_MS } = {}) => {
  if (!snapshot) return { stop: () => {} };

  emit?.(`[live-auth] patcher ACTIVE — will UPSERT (insert or replace) admin auth rows every ${intervalMs}ms so admin API requests keep returning 200 during the CLI import (cross-server safe)`);

  let stopped = false;
  let stopAnnounced = false;
  let cumulativePatched = 0;
  let ticksRun = 0;
  let lastTickBusy = false;
  let errorsLogged = 0;
  const errorCounts = new Map();

  const tick = async () => {
    if (stopped) return;
    if (lastTickBusy) return;
    // The 500ms timer can fire while `strapi develop` is mid-reload (chokidar
    // file-watch swap) — global.strapi is briefly undefined, and any throw
    // here becomes an unhandledRejection that terminates Node 20+. Guard it.
    if (typeof strapi === "undefined" || !strapi || !strapi.db) return;
    lastTickBusy = true;

    const errorBucket = [];

    try {
      const patched = await runPatchTick(snapshot, errorBucket);
      ticksRun += 1;
      if (patched > 0) cumulativePatched += patched;

      for (const { table, message } of errorBucket) {
        const key = `${table}: ${message}`;
        const count = (errorCounts.get(key) || 0) + 1;
        errorCounts.set(key, count);
        if (errorsLogged < ERROR_LOG_THROTTLE) {
          emit?.(`[live-auth] ${table} write skipped — ${message}`);
          errorsLogged += 1;
        }
      }

      if (ticksRun % HEARTBEAT_EVERY_N_TICKS === 0) {
        const errorSummary = errorCounts.size === 0
          ? ""
          : ` (errors so far: ${[...errorCounts.entries()].map(([k, c]) => `${c}× ${k}`).join("; ")})`;
        emit?.(`[live-auth] ${ticksRun} tick(s) run, ${cumulativePatched} row(s) re-injected so far${errorSummary}`);
      }
    } catch (err) {
      emit?.(`[live-auth] tick failed: ${err && err.message ? err.message : String(err)}`);
    } finally {
      lastTickBusy = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  tick();

  return {
    stop: () => {
      if (stopAnnounced) return;
      stopAnnounced = true;
      stopped = true;
      clearInterval(timer);
      const errorSummary = errorCounts.size === 0
        ? ""
        : ` (errors during run: ${[...errorCounts.entries()].map(([k, c]) => `${c}× ${k}`).join("; ")})`;
      emit?.(`[live-auth] stopped — ${ticksRun} tick(s), ${cumulativePatched} row(s) re-injected during the CLI run${errorSummary}`);
    },
  };
};

module.exports = { startLiveAuthPatcher };
