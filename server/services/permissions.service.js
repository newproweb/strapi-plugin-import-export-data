"use strict";

const { getAdminUser, getChecker } = require("../helpers/permissions");
const { ACTION_HANDLERS } = require("../constants/permissions");

const isAllowed = async (ctx, uid, action) => {
  const checker = getChecker(ctx, uid);
  if (!checker) return true;
  const run = ACTION_HANDLERS[action];
  if (!run) return true;
  return run(checker);
};

const assertAllowed = async (ctx, uid, action) => {
  if (!getAdminUser(ctx)) ctx.throw(401, "Admin authentication required.");
  const allowed = await isAllowed(ctx, uid, action);
  if (!allowed) ctx.throw(403, `Forbidden: missing ${action} permission on ${uid}`);
};

module.exports = () => ({ getChecker, isAllowed, assertAllowed });
