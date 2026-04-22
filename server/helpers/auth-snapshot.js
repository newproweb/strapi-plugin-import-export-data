"use strict";

const { BASE_AUTH_TABLES, LINK_AUTH_TABLES, AUTH_TABLES, AUTH_CORE_STORE_KEYS } = require("../constants/auth");
const { knex, setFkEnabled, resetPgSequenceForId, wipeAndInsert } = require("./dialect");
const CORE_STORE_TABLE = "strapi_core_store_settings";

const readTable = async (db, table) => {
  try {
    if (!(await db.schema.hasTable(table))) return null;
    return await db(table).select("*");
  } catch (err) {
    strapi.log.warn(`[import-export] snapshot ${table} failed: ${err.message}`);
    return null;
  }
};

const readCoreStore = async (db) => {
  try {
    if (!(await db.schema.hasTable(CORE_STORE_TABLE))) return [];
    return await db(CORE_STORE_TABLE).whereIn("key", AUTH_CORE_STORE_KEYS).select("*");
  } catch (err) {
    strapi.log.warn(`[import-export] snapshot core_store failed: ${err.message}`);
    return [];
  }
};

const snapshotAuthState = async () => {
  const db = knex();
  if (!db) return null;

  const snap = { tables: {}, coreStore: [] };
  for (const table of AUTH_TABLES) {
    const rows = await readTable(db, table);
    if (rows) snap.tables[table] = rows;
  }
  snap.coreStore = await readCoreStore(db);
  return snap;
};

const deleteTable = async (db, table) => {
  try {
    if (!(await db.schema.hasTable(table))) return;
    await db(table).del();
  } catch (err) {
    strapi.log.warn(`[import-export] wipe ${table}: ${err.message}`);
  }
};

const restoreTable = async (db, table, rows) => {
  try {
    if (!(await db.schema.hasTable(table))) return;
    await wipeAndInsert(db, table, rows);
  } catch (err) {
    strapi.log.error(`[import-export] restore ${table}: ${err.message}`);
  }
};

const restoreCoreStore = async (db, rows) => {
  if (!rows || rows.length === 0) return;
  try {
    for (const row of rows) {
      const { id, ...rest } = row;
      await db(CORE_STORE_TABLE).where({ key: rest.key }).delete();
      await db(CORE_STORE_TABLE).insert(rest);
    }
    await resetPgSequenceForId(db, CORE_STORE_TABLE);
  } catch (err) {
    strapi.log.error(`[import-export] restore core_store: ${err.message}`);
  }
};

const restoreAuthState = async (snap) => {
  if (!snap) return;
  const db = knex();
  if (!db) return;

  await setFkEnabled(db, false);
  try {
    for (const table of [...LINK_AUTH_TABLES].reverse()) {
      if (snap.tables?.[table]) await deleteTable(db, table);
    }
    for (const table of [...BASE_AUTH_TABLES].reverse()) {
      if (snap.tables?.[table]) await deleteTable(db, table);
    }
    for (const table of BASE_AUTH_TABLES) {
      if (snap.tables?.[table]) await restoreTable(db, table, snap.tables[table]);
    }
    for (const table of LINK_AUTH_TABLES) {
      if (snap.tables?.[table]) await restoreTable(db, table, snap.tables[table]);
    }
    await restoreCoreStore(db, snap.coreStore);
  } finally {
    await setFkEnabled(db, true);
  }
};

const summarizeSnapshot = (snap) => {
  const tableCounts = Object.entries(snap?.tables || {})
    .map(([table, rows]) => `${table}=${rows.length}`)
    .join(", ");
  const coreStoreCount = snap?.coreStore?.length || 0;
  return `${tableCounts || "nothing"} + ${coreStoreCount} auth core_store rows`;
};

const takeAuthSnapshot = async (emit) => {
  try {
    emit("[preserve-auth] snapshotting admin users, roles, API tokens…");
    const snap = await snapshotAuthState();
    emit(`[preserve-auth] captured ${summarizeSnapshot(snap)}`);
    return snap;
  } catch (err) {
    strapi.log.warn(`[import-export] preserve-auth snapshot failed: ${err.message}`);
    emit(`[preserve-auth] snapshot failed (${err.message}) — you may need to re-login after restore`);
    return null;
  }
};

const replayAuthSnapshot = async (snapshot, emit) => {
  if (!snapshot) return;
  try {
    emit("[preserve-auth] restoring admin users / tokens so your session stays alive…");
    await restoreAuthState(snapshot);
    emit("[preserve-auth] done — your admin session is still valid.");
  } catch (err) {
    strapi.log.error(`[import-export] preserve-auth restore failed: ${err.message}`);
    emit(`[preserve-auth] restore failed (${err.message}) — you may need to re-login.`);
  }
};

module.exports = { snapshotAuthState, restoreAuthState, takeAuthSnapshot, replayAuthSnapshot };
