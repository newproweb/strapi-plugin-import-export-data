"use strict";

const errorBody = (error, fallback) => ({
  error: {
    status: error?.status || undefined,
    message: error?.message || fallback,
    details: error?.stack ? error.stack.split("\n").slice(0, 5).join("\n") : undefined,
  },
});

const pickStatus = (error, fallback) => {
  const s = Number(error?.status);
  return Number.isFinite(s) && s >= 400 && s < 600 ? s : fallback;
};

module.exports = { errorBody, pickStatus };
