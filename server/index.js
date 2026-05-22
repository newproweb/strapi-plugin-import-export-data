"use strict";

const routes = require("./routes");
const config = require("./config");
const services = require("./services");
const controllers = require("./controllers");
const { recoverPending } = require("./helpers/pad-tracker");
const { getJobStore } = require("./helpers/job-store");
const { knex, dialect, isSqlite } = require("./helpers/dialect");
const { installMaintenanceGuard } = require("./helpers/maintenance-guard");
const { PLUGIN_ACTIONS, PLUGIN } = require("./constants/permissions");

const registerPermissions = async ({ strapi }) => {
  const actions = Object.values(PLUGIN_ACTIONS);
  try {
    await strapi.admin.services.permission.actionProvider.registerMany(actions);
    strapi.log.info(`[import-export] registered ${actions.length} admin permission action(s)`);
  } catch (error) {
    strapi.log.error(`[import-export] permission registration failed: ${error.message}`);
  }
};

module.exports = {
  routes,
  config,
  services,
  controllers,

  async register({ strapi }) {
    await registerPermissions({ strapi });
    installMaintenanceGuard(strapi);
  },

  async bootstrap({ strapi }) {
    // SQLite allows a single writer and blocks readers in the default DELETE
    // journal mode. During a long `strapi import` CLI run that writer lock
    // stalls the live server's admin-auth reads (strapi_sessions) until they
    // time out with "database is locked". WAL lets readers proceed against the
    // last committed snapshot while the import writes. journal_mode is a
    // persistent file property, so the spawned CLI child inherits it too.
    // busy_timeout is kept short: better-sqlite3 is synchronous, so a write
    // that waits out the timeout blocks the whole Node event loop. WAL already
    // keeps reads non-blocking, so a contending write should fail fast and let
    // the caller move on rather than freeze the admin for tens of seconds.
    const db = knex();
    if (db && isSqlite(dialect(db))) {
      try {
        await db.raw("PRAGMA journal_mode = WAL");
        await db.raw("PRAGMA busy_timeout = 5000");
        strapi.log.info("[import-export] SQLite tuned: journal_mode=WAL + busy_timeout=5000ms — admin reads stay alive during long CLI imports");
      } catch (error) {
        strapi.log.warn(`[import-export] SQLite WAL setup failed: ${error.message}`);
      }
    }

    try {
      const { scanned, removed, skipped } = recoverPending();
      if (skipped === "owner-alive") {
        strapi.log.info(`[import-export] pad recovery: ${scanned} pending placeholder(s) skipped — owner process still running (likely a parent strapi export that spawned this CLI)`);
      } else if (scanned > 0) {
        strapi.log.info(`[import-export] pad recovery: removed ${removed}/${scanned} leftover placeholder file(s) from prior export crash`);
      }
    } catch (error) {
      strapi.log.warn(`[import-export] pad recovery failed: ${error.message}`);
    }

    // Abandoned-job recovery: on parent restart we likely have `running` jobs
    // in the file store whose owner PID is dead. `prune()` detects this via
    // PID-liveness and marks them as errored immediately so the user is not
    // left waiting 5+ minutes for the silence-based fallback to kick in.
    // Critical: when this fires, the DB may be in a partially-imported state
    // (entities wiped + only some rows re-inserted, no rollback ran), which
    // explains downstream duplicate / missing-row symptoms on next import.
    try {
      const store = getJobStore();
      const before = store.list().filter((j) => j.status === "running").length;
      store.prune();
      const after = store.list();
      const errored = after.filter((j) => j.status === "error" && /abandoned/i.test(String(j.error || ""))).length;
      if (errored > 0) {
        strapi.log.warn(
          `[import-export] startup recovery: marked ${errored} abandoned job(s) as errored. `
          + `If the prior crashed job was an IMPORT, your database may be in a partial state — `
          + `consider restoring from the latest pre-restore snapshot before running another import.`,
        );
      } else if (before > 0) {
        strapi.log.info(`[import-export] startup recovery: ${before} running job(s) still owned by live processes — left untouched`);
      }
    } catch (error) {
      strapi.log.warn(`[import-export] startup job recovery failed: ${error.message}`);
    }

    try {
      await strapi.plugin(PLUGIN).service("scheduleService").register();
    } catch (error) {
      strapi.log.error(`[import-export] bootstrap schedule failed: ${error.message}`);
    }
  },
};
