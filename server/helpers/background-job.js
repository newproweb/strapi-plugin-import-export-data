"use strict";

const { makeJob, pushLog, updateJob, finalizeJob } = require("./jobs");
const { getJobStore, isAbortRequested, clearJobAbort } = require("./job-store");
const { acquire, release, isBusy, currentLabel, current } = require("./job-mutex");
const { arm, disarm } = require("./crash-guard");

/**
 * Best-effort safety net for cleanup steps: never re-throws. If `release` or
 * `disarm` itself blows up (e.g. fs failure flushing the mutex file), we log
 * via strapi.log instead of propagating — otherwise the crash-guard would stay
 * armed forever and the job mutex would never be released.
 */
const safeRun = (fn, label) => {
  try { return fn(); }
  catch (err) {
    try { strapi.log.warn(`[import-export] cleanup '${label}' failed: ${err.message}`); }
    catch { /* strapi global may be mid-reload */ }
    return null;
  }
};

const runOperation = async (job, type, operation) => {
  const setStage = (stage, percent = 0) => updateJob(job.id, { progress: { stage, percent } });
  try {
    const result = await operation(
      (evt) => pushLog(job.id, evt),
      () => isAbortRequested(job.id),
      setStage,
    );
    updateJob(job.id, {
      result,
      status: "success",
      progress: { percent: 100, stage: "Done" },
    });
  } catch (err) {
    const message = err?.message || String(err);
    updateJob(job.id, { status: "error", error: message });
    try { strapi.log.error(`[import-export] ${type} job ${job.id} failed: ${message}`); }
    catch { /* strapi global may be mid-reload */ }
  }
};

const finalizeAndRelease = (jobId) => {
  safeRun(() => updateJob(jobId, { finishedAt: Date.now() }), "set finishedAt");
  safeRun(() => finalizeJob(jobId), "finalizeJob");
  safeRun(() => clearJobAbort(jobId), "clearJobAbort");
  safeRun(() => release(jobId), "release mutex");
  safeRun(() => disarm(), "disarm crash-guard");
};

const runInBackground = (type, operation) => {
  if (isBusy()) {
    const busy = current();
    const err = new Error(`Another ${currentLabel()} job is already running (id=${busy?.jobId}) — wait for it to finish or cancel it before starting ${type}.`);
    err.status = 409;
    throw err;
  }

  const job = makeJob(type);
  try {
    acquire(type, job.id);
  } catch (err) {
    getJobStore().delete(job.id);
    throw err;
  }

  arm();
  runOperation(job, type, operation)
    .catch((err) => {
      try { strapi.log.error(`[import-export] background runner crashed for ${job.id}: ${err?.message || err}`); }
      catch { /* ignore */ }
      safeRun(() => updateJob(job.id, { status: "error", error: err?.message || String(err) }), "mark error");
    })
    .finally(() => finalizeAndRelease(job.id));

  return job.id;
};

module.exports = { runInBackground };
