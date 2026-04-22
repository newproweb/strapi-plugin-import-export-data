"use strict";

const {
  MAX_LOG_LINES,
  JOB_TTL_MS,
  KNOWN_STAGES,
  COMPLETION_MARKERS,
} = require("../constants/backup");

const jobs = new Map();

const STUCK_JOB_MS = 30 * 60 * 1000;

const pruneExpiredJobs = () => {
  const now = Date.now();
  const cutoff = now - JOB_TTL_MS;
  const stuckCutoff = now - STUCK_JOB_MS;
  for (const [id, job] of jobs) {
    if (job.finishedAt && job.finishedAt < cutoff) {
      jobs.delete(id);
      continue;
    }
    if (job.status === "running" && !job.finishedAt) {
      const lastActivity = job.logLines.length
        ? job.logLines[job.logLines.length - 1].at
        : job.startedAt;
      if (lastActivity < stuckCutoff) {
        job.status = "error";
        job.error = "Job marked as stuck — no progress for 15 minutes (likely left over from a crashed process).";
        job.finishedAt = now;
      }
    }
  }
};

const stagePercent = (stagesDone) =>
  Math.round((stagesDone.size / KNOWN_STAGES.length) * 100);

const matchPercent = (job, line) => {
  const pct = line.match(/(\d{1,3})\s*%/);
  if (!pct) return false;
  job.progress = {
    percent: Math.min(100, Math.max(0, Number(pct[1]))),
    stage: job.progress?.stage || "",
  };
  return true;
};

const matchStageDone = (job, line) => {
  const done = line.match(/^[\s\u2714\u2713✔✓]+(\w+)\s*:/);
  if (!done) return false;
  const name = done[1].toLowerCase();
  if (!KNOWN_STAGES.includes(name)) return false;
  job.stagesDone.add(name);
  job.progress = {
    percent: Math.min(99, stagePercent(job.stagesDone)),
    stage: `${name} done`,
  };
  return true;
};

const matchStageProgress = (job, line) => {
  // Matches Strapi CLI spinner output like:
  //   - assets: 1234 transferred (size: 15 MB) (elapsed: 9500 ms) (1.6 MB/s)
  //   ✔ entities: 22904 transferred (size: 26 MB) (elapsed: 23141 ms) (1.1 MB/s)
  const m = line.match(/(\w+):\s+(\d+)\s+transferred\s+\(size:\s*([\d.]+)\s*([KMGT]?B)\)(?:\s+\(elapsed:\s*(\d+)\s*ms\))?(?:\s+\(([\d.]+)\s*([KMGT]?B)\/s\))?/i);
  if (!m) return false;
  const name = m[1].toLowerCase();
  if (!KNOWN_STAGES.includes(name)) return false;
  const count = Number(m[2]);
  const sizeVal = m[3];
  const sizeUnit = m[4];
  const rate = m[6] ? `${m[6]} ${m[7]}/s` : "";
  const stageLabel = `${name}: ${count.toLocaleString()} transferred (${sizeVal} ${sizeUnit}${rate ? ", " + rate : ""})`;
  job.progress = {
    percent: Math.max(job.progress?.percent || 0, stagePercent(job.stagesDone)),
    stage: stageLabel,
  };
  return true;
};

const matchStageStarted = (job, line) => {
  const started = line.match(/^-\s+(\w+)\s*:/);
  if (!started) return false;
  const name = started[1].toLowerCase();
  if (!KNOWN_STAGES.includes(name)) return false;
  job.progress = {
    percent: Math.max(job.progress?.percent || 0, stagePercent(job.stagesDone)),
    stage: `Working on ${name}…`,
  };
  return true;
};

const matchCompletion = (job, line) => {
  if (!COMPLETION_MARKERS.some((rx) => rx.test(line))) return false;
  job.progress = { percent: 100, stage: "Transfer completed" };
  job.transferComplete = true;
  return true;
};

const updateProgressFromLine = (job, line) => {
  if (!job.stagesDone) job.stagesDone = new Set();
  if (matchPercent(job, line)) return;
  if (matchStageDone(job, line)) return;
  if (matchStageProgress(job, line)) return;
  if (matchStageStarted(job, line)) return;
  matchCompletion(job, line);
};

const pushLog = (job, { stream, line }) => {
  job.lastLine = line;
  job.lastStream = stream;
  job.logLines.push({ stream, line, at: Date.now() });
  if (job.logLines.length > MAX_LOG_LINES) job.logLines.shift();
  updateProgressFromLine(job, line);
};

const makeJob = (type) => {
  pruneExpiredJobs();
  const id = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    type,
    status: "running",
    startedAt: Date.now(),
    finishedAt: null,
    lastLine: "",
    lastStream: "stdout",
    logLines: [],
    progress: { percent: 0, stage: "" },
    result: null,
    error: null,
  };
  jobs.set(id, job);
  return job;
};

const serializeJob = (job) => ({
  id: job.id,
  type: job.type,
  status: job.status,
  startedAt: new Date(job.startedAt).toISOString(),
  finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
  elapsedMs: (job.finishedAt || Date.now()) - job.startedAt,
  progress: job.progress,
  stagesDone: job.stagesDone ? Array.from(job.stagesDone) : [],
  transferComplete: Boolean(job.transferComplete),
  lastLine: job.lastLine,
  lastStream: job.lastStream,
  recentLines: job.logLines.slice(-80),
  result: job.result,
  error: job.error,
});

const getJob = (id) => {
  const job = jobs.get(id);
  return job ? serializeJob(job) : null;
};

const listJobs = () => {
  pruneExpiredJobs();
  return Array.from(jobs.values()).map(serializeJob);
};

module.exports = { makeJob, pushLog, getJob, listJobs };
