"use strict";

const { makeJob, pushLog } = require("./jobs");
const { acquire, release } = require("./job-mutex");

const markSuccess = (job, result) => {
  job.result = result;
  job.status = "success";
  job.progress = { percent: 100, stage: "Done" };
};

const markFailure = (job, type, err) => {
  job.error = err.message || String(err);
  job.status = "error";
  strapi.log.error(`[import-export] ${type} job ${job.id} failed: ${job.error}`);
};

const runInBackground = (type, operation) => {
  const job = makeJob(type);
  acquire(type, job.id);
  (async () => {
    try {
      const result = await operation((evt) => pushLog(job, evt));
      markSuccess(job, result);
    } catch (err) {
      markFailure(job, type, err);
    } finally {
      job.finishedAt = Date.now();
      release();
    }
  })();
  return job.id;
};

module.exports = { runInBackground };
