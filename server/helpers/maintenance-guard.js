"use strict";

const { currentLabel } = require("./job-mutex");
const { JOB_TYPES } = require("../constants/jobs");
const { PLUGIN } = require("../constants/plugin");

const RETRY_AFTER_SECONDS = 30;

/**
 * Koa middleware: while a restore (import) job runs, the shared database is
 * being wholesale rewritten and its connection pool saturates — host requests
 * that touch the DB would otherwise hang ~60s before failing. This short-
 * circuits them with an immediate 503 + Retry-After so clients fail fast and
 * never enqueue a doomed DB query, keeping the pool free for the import.
 *
 * Exempt, so they keep working through a restore:
 *   - HEAD requests — container / load-balancer health checks must keep passing.
 *   - the plugin's own routes — the operator polls job progress and can abort.
 *   - any request that is not a JSON API call — document navigations and
 *     static assets (HTML/JS/CSS/fonts) must always be served, or the admin
 *     SPA cannot boot at all (a blank white page instead of a usable
 *     "service paused" state). Only the admin's data calls send
 *     `Accept: application/json`; the browser loading the app does not.
 */
const maintenanceMiddleware = async (ctx, next) => {
  if (ctx.method === "HEAD") return next();
  if (currentLabel() !== JOB_TYPES.IMPORT) return next();
  if (String(ctx.path || "").includes(PLUGIN)) return next();
  if (!String(ctx.get("accept")).includes("application/json")) return next();

  ctx.status = 503;
  ctx.set("Retry-After", String(RETRY_AFTER_SECONDS));
  ctx.body = {
    error: {
      status: 503,
      name: "ServiceUnavailable",
      message:
        "A data restore is in progress — the admin API is paused to protect the database. "
        + "Watch progress on the Import/Export page; normal service resumes automatically when the restore finishes.",
      code: "RESTORE_IN_PROGRESS",
    },
  };
  return undefined;
};

/**
 * Installs `maintenanceMiddleware` at the front of the Koa stack. Must run in
 * the plugin `register()` phase: middleware added then sits before Strapi's
 * router, so it can intercept every route. Registering in `bootstrap()` would
 * place it after the router and it would never see matched routes.
 *
 * Defensive: any failure is swallowed and logged so a server-API mismatch on
 * some Strapi version cannot abort plugin registration.
 */
const installMaintenanceGuard = (strapi) => {
  try {
    const server = strapi && strapi.server;
    if (server && typeof server.use === "function") {
      server.use(maintenanceMiddleware);
    } else if (server && server.app && typeof server.app.use === "function") {
      server.app.use(maintenanceMiddleware);
    } else {
      strapi.log.warn("[import-export] maintenance guard not installed — Koa server API unavailable");
      return;
    }
    strapi.log.info("[import-export] maintenance guard installed — host requests get a fast 503 while a restore runs");
  } catch (err) {
    strapi.log.warn(`[import-export] maintenance guard install failed: ${err.message}`);
  }
};

module.exports = { maintenanceMiddleware, installMaintenanceGuard };
