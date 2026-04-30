"use strict";

const { makeJob, pushLog, updateJob, finalizeJob } = require("./jobs");
const { getJobStore } = require("./job-store");
const { acquire, release, isBusy, currentLabel, current } = require("./job-mutex");

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

  (async () => {
    try {
      const result = await operation((evt) => pushLog(job.id, evt));
      updateJob(job.id, {
        result,
        status: "success",
        progress: { percent: 100, stage: "Done" },
      });
    } catch (err) {
      const message = err.message || String(err);
      updateJob(job.id, { status: "error", error: message });
      strapi.log.error(`[import-export] ${type} job ${job.id} failed: ${message}`);
    } finally {
      updateJob(job.id, { finishedAt: Date.now() });
      finalizeJob(job.id);
      release(job.id);
    }
  })();

  return job.id;
};

module.exports = { runInBackground };
