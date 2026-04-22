"use strict";

const STATE = { label: null, startedAt: null, jobId: null };

const isBusy = () => STATE.label !== null;

const currentLabel = () => STATE.label;

const current = () => (isBusy() ? { ...STATE } : null);

const acquire = (label, jobId) => {
  if (isBusy()) {
    const err = new Error(`Another ${STATE.label} job is already running (id=${STATE.jobId}) — wait for it to finish or cancel it before starting ${label}.`);
    err.status = 409;
    throw err;
  }

  STATE.label = label;
  STATE.jobId = jobId;
  STATE.startedAt = Date.now();
};

const release = () => {
  STATE.label = null;
  STATE.jobId = null;
  STATE.startedAt = null;
};

module.exports = { acquire, release, isBusy, currentLabel, current };
