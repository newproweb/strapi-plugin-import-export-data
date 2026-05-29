"use strict";

const { BASE_AUTH_TABLES, LINK_AUTH_TABLES, AUTH_TABLES, AUTH_CORE_STORE_KEYS } = require("../constants/auth");
const { knex, setFkEnabled, resetPgSequenceForId, wipeAndInsert } = require("./dialect");

const CORE_STORE_TABLE = "strapi_core_store_settings";
const CRITICAL_TABLES = ["admin_users"];

const readTable = async (db, table) => {
  if (!(await db.schema.hasTable(table))) return null;
  return db(table).select("*");
};

const collectSnapshot = async (db, failures) => {
  const snap = { tables: {}, coreStore: [] };
  for (const table of AUTH_TABLES) {
    try {
      const rows = await readTable(db, table);
      if (rows) snap.tables[table] = rows;
    } catch (err) {
      failures.push({ table, phase: "snapshot", message: err.message });
    }
  }
  try {
    if (await db.schema.hasTable(CORE_STORE_TABLE)) {
      snap.coreStore = await db(CORE_STORE_TABLE).whereIn("key", AUTH_CORE_STORE_KEYS).select("*");
    }
  } catch (err) {
    failures.push({ table: CORE_STORE_TABLE, phase: "snapshot", message: err.message });
  }
  return snap;
};

const snapshotAuthState = async () => {
  const db = knex();
  if (!db) return null;
  const failures = [];
  const snap = await collectSnapshot(db, failures);
  snap._failures = failures;
  return snap;
};

const deleteTableSafe = async (db, table, failures) => {
  try {
    if (!(await db.schema.hasTable(table))) return;
    await db(table).del();
  } catch (err) {
    failures.push({ table, phase: "wipe", message: err.message });
  }
};

const restoreTableSafe = async (db, table, rows, failures) => {
  try {
    if (!(await db.schema.hasTable(table))) {
      failures.push({ table, phase: "restore", message: "table does not exist on target DB" });
      return 0;
    }
    await wipeAndInsert(db, table, rows);
    return rows?.length || 0;
  } catch (err) {
    failures.push({ table, phase: "restore", message: err.message });
    return 0;
  }
};

const restoreCoreStoreSafe = async (db, rows, failures) => {
  if (!rows || rows.length === 0) return;
  try {
    await db.transaction(async (trx) => {
      for (const row of rows) {
        const { id, ...rest } = row;
        await trx(CORE_STORE_TABLE).where({ key: rest.key }).delete();
        await trx(CORE_STORE_TABLE).insert(rest);
      }
    });
    await resetPgSequenceForId(db, CORE_STORE_TABLE);
  } catch (err) {
    failures.push({ table: CORE_STORE_TABLE, phase: "restore", message: err.message });
  }
};

const restoreAuthState = async (snap) => {
  if (!snap) return { failures: [], restored: {} };
  const db = knex();
  if (!db) return { failures: [{ table: "_db", phase: "init", message: "DB connection unavailable" }], restored: {} };

  const failures = [];
  const restored = {};

  await setFkEnabled(db, false);
  try {
    for (const table of [...LINK_AUTH_TABLES].reverse()) {
      if (snap.tables?.[table]) await deleteTableSafe(db, table, failures);
    }
    for (const table of [...BASE_AUTH_TABLES].reverse()) {
      if (snap.tables?.[table]) await deleteTableSafe(db, table, failures);
    }
    for (const table of BASE_AUTH_TABLES) {
      if (snap.tables?.[table]) restored[table] = await restoreTableSafe(db, table, snap.tables[table], failures);
    }
    for (const table of LINK_AUTH_TABLES) {
      if (snap.tables?.[table]) restored[table] = await restoreTableSafe(db, table, snap.tables[table], failures);
    }
    await restoreCoreStoreSafe(db, snap.coreStore, failures);
  } finally {
    await setFkEnabled(db, true);
  }

  return { failures, restored };
};

const summarizeSnapshot = (snap) => {
  const tableCounts = Object.entries(snap?.tables || {})
    .map(([table, rows]) => `${table}=${rows.length}`)
    .join(", ");
  const coreStoreCount = snap?.coreStore?.length || 0;
  return `${tableCounts || "nothing"} + ${coreStoreCount} auth core_store rows`;
};

const takeAuthSnapshot = async (emit) => {
  emit("[preserve-auth] snapshotting admin users, roles, API tokens…");
  const snap = await snapshotAuthState().catch((err) => {
    emit(`[preserve-auth] snapshot failed (${err.message}) — you may need to re-login after restore`);
    return null;
  });
  if (!snap) return null;
  emit(`[preserve-auth] captured ${summarizeSnapshot(snap)}`);
  for (const f of snap._failures || []) {
    emit(`[preserve-auth] WARNING: snapshot ${f.table} failed — ${f.message}`);
  }
  return snap;
};

const findCriticalLoss = (snapshot, restored, failures) => {
  const failedTables = new Set(failures.map((f) => f.table));
  return CRITICAL_TABLES.filter((t) => {
    const had = (snapshot.tables?.[t]?.length || 0) > 0;
    const back = restored[t] || 0;
    return had && (failedTables.has(t) || back === 0);
  });
};

/**
 * Restores admin auth state captured by `takeAuthSnapshot`. Returns
 * `{ ok, restored, warnings? }` on partial success. Throws an Error whose
 * message includes "ADMIN LOCKED OUT" when `admin_users` (or any table in
 * `CRITICAL_TABLES`) failed to restore, so the caller surfaces this in the
 * job error and the operator knows to recover manually.
 */
const replayAuthSnapshot = async (snapshot, emit) => {
  if (!snapshot) return { ok: true, skipped: true };
  emit("[preserve-auth] restoring admin users / tokens so your session stays alive…");

  const { failures, restored } = await restoreAuthState(snapshot);

  if (failures.length === 0) {
    emit("[preserve-auth] done — your admin session is still valid.");
    return { ok: true, restored };
  }

  for (const f of failures) {
    emit(`[preserve-auth] WARNING: ${f.phase} ${f.table} failed — ${f.message}`);
  }

  const criticalLost = findCriticalLoss(snapshot, restored, failures);
  if (criticalLost.length > 0) {
    const msg = `ADMIN LOCKED OUT: critical auth table(s) not restored: ${criticalLost.join(", ")}. `
      + "Re-login WILL fail until you manually restore these tables from the pre-restore snapshot.";
    emit(`[preserve-auth] ${msg}`);
    throw new Error(msg);
  }

  emit(`[preserve-auth] completed with ${failures.length} non-critical warning(s) — admin session should still work`);
  return { ok: true, restored, warnings: failures };
};

module.exports = { snapshotAuthState, restoreAuthState, takeAuthSnapshot, replayAuthSnapshot };
