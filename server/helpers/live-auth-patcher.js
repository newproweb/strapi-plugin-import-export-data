"use strict";

const { BASE_AUTH_TABLES } = require("../constants/auth");
const { knex, dialect, isSqlite, setFkEnabled } = require("./dialect");

const CORE_STORE_TABLE = "strapi_core_store_settings";

const DEFAULT_INTERVAL_MS = 3000;

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
 * Picks the sentinel used to detect whether the import has wiped admin auth:
 * the first snapshot `admin_users` row. Its `id` plus `email` tell our admin
 * apart from any same-id user a cross-server archive might insert.
 *
 * @returns {{ id: any, email: any } | null} null when the snapshot has no users.
 */
const authSentinel = (snapshot) => {
  const first = snapshot.tables?.admin_users?.[0];
  if (!first || first.id === undefined) return null;
  return { id: first.id, email: first.email };
};

/**
 * One indexed single-row read. True when our admin user is gone, or present
 * under the same id but a different email — either means the import wiped or
 * replaced auth and the snapshot is due to be re-injected.
 */
const authReinjectDue = async (db, sentinel) => {
  const row = await db("admin_users").where({ id: sentinel.id }).first("email");
  if (!row) return true;
  return sentinel.email !== undefined && row.email !== sentinel.email;
};

/**
 * While `strapi import --force` runs it wipes and replaces `admin_users`,
 * `strapi_sessions`, `strapi_api_tokens`, etc. with the archive's contents,
 * which 401s the logged-in admin for the whole import.
 *
 * Each tick does ONE cheap single-row read and re-injects the captured auth
 * snapshot only when that read shows the rows were wiped. A long import costs
 * ~one indexed read per `intervalMs` plus a re-inject per wipe — not a blind
 * UPSERT of every auth row on every tick, which during a heavy import piled
 * host-process writes onto an already-saturated DB.
 *
 * Postgres and MySQL only. SQLite is skipped: better-sqlite3 is synchronous,
 * so even the read tick would block the event loop against the import's write
 * lock. SQLite auth is restored from the pre-restore snapshot afterwards.
 *
 * @param {object|null} snapshot  Output of `takeAuthSnapshot`. Falsy → no-op.
 * @param {(line: string) => void} [emit]  Log sink for user-visible lines.
 * @param {{ intervalMs?: number }} [options]
 * @returns {{ stop: () => void }}
 */
const startLiveAuthPatcher = (snapshot, emit, { intervalMs = DEFAULT_INTERVAL_MS } = {}) => {
  if (!snapshot) return { stop: () => {} };

  const db = knex();
  if (db && isSqlite(dialect(db))) {
    emit?.("[live-auth] patcher SKIPPED on SQLite — its writes would contend with the import and freeze the dev server; auth is restored from the snapshot after the import");
    return { stop: () => {} };
  }

  const sentinel = authSentinel(snapshot);
  if (!sentinel) {
    emit?.("[live-auth] patcher SKIPPED — snapshot captured no admin users to preserve");
    return { stop: () => {} };
  }

  emit?.(`[live-auth] patcher ACTIVE — checking admin auth every ${intervalMs}ms, re-injecting only when the import has wiped it (Postgres/MySQL, cross-server safe)`);

  let stopped = false;
  let stopAnnounced = false;
  let cumulativePatched = 0;
  let checksRun = 0;
  let reinjections = 0;
  let inFlight = null;
  let errorsLogged = 0;
  const errorCounts = new Map();

  const runTick = async () => {
    if (stopped) return;
    if (typeof strapi === "undefined" || !strapi || !strapi.db) return;

    const errorBucket = [];
    try {
      const conn = knex();
      if (!conn) return;
      checksRun += 1;

      let due;
      try {
        due = await authReinjectDue(conn, sentinel);
      } catch {
        return;
      }
      if (!due) return;

      const patched = await runPatchTick(snapshot, errorBucket);
      reinjections += 1;
      if (patched > 0) cumulativePatched += patched;

      for (const { table, message } of errorBucket) {
        const key = `${table}: ${message}`;
        errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
        if (errorsLogged < ERROR_LOG_THROTTLE) {
          emit?.(`[live-auth] ${table} write skipped — ${message}`);
          errorsLogged += 1;
        }
      }
      emit?.(`[live-auth] import wiped admin auth — re-injected ${patched} row(s) (re-inject #${reinjections})`);
    } catch (err) {
      emit?.(`[live-auth] tick failed: ${err && err.message ? err.message : String(err)}`);
    }
  };

  const tick = () => {
    if (stopped || inFlight) return;
    inFlight = runTick().finally(() => { inFlight = null; });
  };

  const timer = setInterval(tick, intervalMs);
  tick();

  return {
    /**
     * Halts the patcher and awaits any in-flight tick so a tick mid-write
     * cannot race with `replayAuthSnapshot` — the snapshot replay must be
     * the LAST writer or it gets overwritten by stale data.
     */
    stop: async () => {
      if (stopAnnounced) return;
      stopAnnounced = true;
      stopped = true;
      clearInterval(timer);
      if (inFlight) {
        try { await inFlight; } catch { /* tick errors already surfaced via emit */ }
      }
      const errorSummary = errorCounts.size === 0
        ? ""
        : ` (errors during run: ${[...errorCounts.entries()].map(([k, c]) => `${c}× ${k}`).join("; ")})`;
      emit?.(`[live-auth] stopped — ${checksRun} check(s) run, ${reinjections} re-inject(s), ${cumulativePatched} row(s) re-injected total${errorSummary}`);
    },
  };
};

module.exports = { startLiveAuthPatcher };
