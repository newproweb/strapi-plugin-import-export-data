"use strict";

const safeLog = (level, msg) => {
  try {
    if (typeof strapi !== "undefined" && strapi?.log?.[level]) strapi.log[level](msg);
  } catch { /* strapi global may be undefined mid-reload */ }
};

const safeWarn = (msg) => safeLog("warn", msg);
const safeInfo = (msg) => safeLog("info", msg);

module.exports = { safeLog, safeWarn, safeInfo };
