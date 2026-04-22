"use strict";

const errorBody = (error, fallback) => ({
  error: {
    message: error?.message || fallback,
    details: error?.stack ? error.stack.split("\n").slice(0, 5).join("\n") : undefined,
  },
});

module.exports = { errorBody };
