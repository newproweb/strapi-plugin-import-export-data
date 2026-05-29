"use strict";

const { TUS_PATH } = require("../constants/upload");
const { getTusServer } = require("./tus-server");

const SINGLE_ID_SEGMENT = /^\/[^/]+$/;

const isTusProtocolPath = (urlPath) => {
  if (!urlPath.startsWith(TUS_PATH)) return false;
  const rest = urlPath.slice(TUS_PATH.length);
  if (rest === "" || rest === "/") return true;
  return SINGLE_ID_SEGMENT.test(rest);
};

const extractBearer = (header) => {
  if (typeof header !== "string") return "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

const hasIdentityClaim = (payload) =>
  Boolean(payload && (payload.id || payload.userId || payload.sub || payload.sessionId));

const verifyWithJwtSecret = (token) => {
  try {
    const jwt = require("jsonwebtoken");
    const secret = strapi.config.get("admin.auth.secret");
    if (!secret) return { ok: false, reason: "admin.auth.secret not configured" };
    const decoded = jwt.verify(token, secret);
    if (hasIdentityClaim(decoded)) return { ok: true };
    return { ok: false, reason: "JWT verified but payload has no identity claim" };
  } catch (err) {
    return { ok: false, reason: `jwt.verify failed: ${err.message}` };
  }
};

const callSessionManager = (mgr, token) => {
  if (!mgr) return null;
  const admin = typeof mgr === "function" ? mgr("admin") : mgr.admin;
  if (!admin?.validateAccessToken) return null;
  return admin.validateAccessToken(token);
};

const verifyWithSessionManager = (token) => {
  try {
    const result = callSessionManager(strapi.sessionManager, token);
    if (!result) return { ok: false, reason: "sessionManager not available" };
    if (result.isValid === false) return { ok: false, reason: "sessionManager: invalid token" };
    if (result.isValid || hasIdentityClaim(result.payload)) return { ok: true };
    return { ok: false, reason: "sessionManager: no isValid flag and no payload" };
  } catch (err) {
    return { ok: false, reason: `sessionManager threw: ${err.message}` };
  }
};

const validateAdminToken = (token) => {
  if (!token) return { ok: false, reason: "no token in Authorization header" };

  const jwtResult = verifyWithJwtSecret(token);
  if (jwtResult.ok) return jwtResult;

  const smResult = verifyWithSessionManager(token);
  if (smResult.ok) return smResult;

  return { ok: false, reason: `jwt: ${jwtResult.reason}; sessionManager: ${smResult.reason}` };
};

const sendUnauthorized = (ctx, reason) => {
  ctx.status = 401;
  ctx.body = { error: { status: 401, name: "Unauthorized", message: "Invalid or missing admin token" } };
  strapi.log.warn(`[import-export:tus] auth rejected (${ctx.method} ${ctx.path}): ${reason}`);
};

/**
 * Drains the request socket on error paths so the connection is returned to
 * the pool instead of being stuck in ESTABLISHED. Without this, repeated tus
 * failures leak sockets and the server eventually 503s under load.
 */
const releaseSocket = (ctx) => {
  try { ctx.req.unpipe?.(); } catch { /* ignore */ }
  try { ctx.req.resume?.(); } catch { /* ignore */ }
};

const tusMiddleware = async (ctx, next) => {
  if (!isTusProtocolPath(ctx.path)) return next();

  ctx.disableBodyParser = true;

  strapi.log.info(`[import-export:tus] >>> ${ctx.method} ${ctx.path} (req.url=${ctx.req.url})`);

  if (ctx.method !== "OPTIONS") {
    const token = extractBearer(ctx.request.headers.authorization);
    const result = validateAdminToken(token);
    if (!result.ok) {
      releaseSocket(ctx);
      return sendUnauthorized(ctx, result.reason);
    }
  }

  ctx.respond = false;
  try {
    await getTusServer().handle(ctx.req, ctx.res);
    strapi.log.info(`[import-export:tus] <<< ${ctx.method} ${ctx.path} → status ${ctx.res.statusCode}`);
  } catch (err) {
    strapi.log.error(`[import-export:tus] handle threw: ${err.message}\n${err.stack}`);
    if (!ctx.res.headersSent) {
      ctx.res.statusCode = 500;
      ctx.res.end(JSON.stringify({ error: { message: err.message } }));
    }
    releaseSocket(ctx);
  }
};

/**
 * Mounts the tus middleware on the host Koa app. Best-effort: if `server.app`
 * is missing on this Strapi version (some 5.x patch versions reorganize the
 * shape), the plugin degrades to multipart-only upload rather than blocking
 * Strapi boot.
 */
const mountTusMiddleware = (strapiInstance) => {
  try {
    const app = strapiInstance?.server?.app;
    if (!app || typeof app.use !== "function") {
      strapiInstance.log.warn(`[import-export:tus] strapi.server.app.use unavailable — tus upload disabled, falling back to multipart`);
      return { mounted: false, reason: "server.app.use missing" };
    }
    app.use(tusMiddleware);
    strapiInstance.log.info(`[import-export:tus] middleware mounted at ${TUS_PATH}`);
    return { mounted: true };
  } catch (err) {
    strapiInstance.log.error(`[import-export:tus] mount failed: ${err.message} — falling back to multipart`);
    return { mounted: false, reason: err.message };
  }
};

module.exports = { mountTusMiddleware };
