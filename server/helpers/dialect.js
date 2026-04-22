"use strict";

const CHUNK = 80;

const knex = () => strapi.db?.connection;

const dialect = (db) => String(db?.client?.config?.client || "").toLowerCase();

const isPg = (d) => d.includes("pg") || d.includes("postgres");
const isMysql = (d) => d.includes("mysql");
const isSqlite = (d) => d.includes("sqlite");

const setFkEnabled = async (db, enabled) => {
  const d = dialect(db);
  try {
    if (isSqlite(d)) return db.raw(`PRAGMA foreign_keys = ${enabled ? "ON" : "OFF"}`);
    if (isPg(d)) return db.raw(`SET session_replication_role = ${enabled ? "DEFAULT" : "replica"}`);
    if (isMysql(d)) return db.raw(`SET FOREIGN_KEY_CHECKS = ${enabled ? 1 : 0}`);
    return undefined;
  } catch (err) {
    strapi.log.warn(`[import-export] setFkEnabled(${enabled}) failed: ${err.message}`);
    return undefined;
  }
};

const resetPgSequenceForId = async (db, table) => {
  if (!isPg(dialect(db))) return;
  try {
    const { rows } = await db.raw(`SELECT pg_get_serial_sequence(?, 'id') AS seq`, [table]);
    const seq = rows?.[0]?.seq;
    if (!seq) return;
    await db.raw(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`);
  } catch (err) {
    strapi.log.warn(`[import-export] resetPgSequence ${table}: ${err.message}`);
  }
};

const wipeAndInsert = async (db, table, rows) => {
  await db(table).del();
  if (!rows || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db(table).insert(rows.slice(i, i + CHUNK));
  }
  await resetPgSequenceForId(db, table);
};

module.exports = {
  knex,
  dialect,
  isPg,
  isMysql,
  isSqlite,
  setFkEnabled,
  resetPgSequenceForId,
  wipeAndInsert,
};
