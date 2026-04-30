"use strict";

const { getJobMutex } = require("./job-store");

const isBusy = () => getJobMutex().isBusy();

const currentLabel = () => getJobMutex().currentLabel();

const current = () => getJobMutex().current();

const acquire = (label, jobId) => getJobMutex().acquire(label, jobId);

const release = (jobId) => getJobMutex().release(jobId);

module.exports = { acquire, release, isBusy, currentLabel, current };
