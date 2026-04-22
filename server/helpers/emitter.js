"use strict";

const makeLogEmitter = (onLog) => (line) => {
  strapi.log.info(`[import-export] ${line}`);
  if (onLog) onLog({ stream: "stdout", line });
};

module.exports = { makeLogEmitter };
