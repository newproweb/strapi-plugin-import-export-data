"use strict";

// Defensive JSON serialiser for the export service. Returns a string that is
// always valid JSON — even when the caller accidentally hands us something
// that's not an array (earlier iterations of this plugin silently fell back
// to `Array.prototype.toString()` which serialised as
// "[object Object],[object Object],…" and tanked downstream consumers).
const stringify = (rows) => {
  if (rows === null || rows === undefined) return "[]";
  if (!Array.isArray(rows)) {
    // Single object → wrap into a one-element array so the output is still
    // valid JSON and round-trips cleanly through parse().
    return JSON.stringify([rows], null, 2);
  }
  return JSON.stringify(rows, null, 2);
};

const parse = (text) => {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("JSON payload must be an array of objects");
  }
  return parsed;
};

module.exports = {
  stringify,
  parse,
};
