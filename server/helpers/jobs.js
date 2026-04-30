"use strict";

const {
  MAX_LOG_LINES,
  KNOWN_STAGES,
  COMPLETION_MARKERS,
} = require("../constants/backup");

const { getJobStore } = require("./job-store");

const stagePercent = (stagesDone) =>
  Math.round((stagesDone.length / KNOWN_STAGES.length) * 100);

// Strapi v5 import does NOT always emit a `✔ <stage>:` line for each stage —
// it often jumps straight to the next stage's `- <next>:` start marker. Without
// retrofitting the prior stages as done, the % bar gets stuck at the first
// stage's band (e.g. 20% during the entire `assets` stage). Whenever we observe
// activity in stage N, mark stages 0..N-1 as done.
const markPriorStagesDone = (job, currentStageName) => {
  const idx = KNOWN_STAGES.indexOf(currentStageName);
  if (idx <= 0) return;
  if (!Array.isArray(job.stagesDone)) job.stagesDone = [];
  for (let i = 0; i < idx; i += 1) {
    if (!job.stagesDone.includes(KNOWN_STAGES[i])) job.stagesDone.push(KNOWN_STAGES[i]);
  }
};

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
  const done = line.match(/^[\s✔✓]+(\w+)\s*:/);
  if (!done) return false;
  const name = done[1].toLowerCase();
  if (!KNOWN_STAGES.includes(name)) return false;
  markPriorStagesDone(job, name);
  if (!job.stagesDone.includes(name)) job.stagesDone.push(name);
  job.progress = {
    percent: Math.min(99, stagePercent(job.stagesDone)),
    stage: `${name} done`,
  };
  return true;
};

const matchStageProgress = (job, line) => {
  const m = line.match(/(\w+):\s+(\d+)\s+transferred\s+\(size:\s*([\d.]+)\s*([KMGT]?B)\)(?:\s+\(elapsed:\s*(\d+)\s*ms\))?(?:\s+\(([\d.]+)\s*([KMGT]?B)\/s\))?/i);
  if (!m) return false;
  const name = m[1].toLowerCase();
  if (!KNOWN_STAGES.includes(name)) return false;
  markPriorStagesDone(job, name);
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
  markPriorStagesDone(job, name);
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

// Animates the progress bar while the `assets` stage is running. The
// Strapi CLI emits `- assets: 0 transferred` once at stage start and then
// nothing else until `✔ assets: N transferred` when the stage is done —
// leaving the bar frozen at the stage-start percent for 10+ minutes on
// large asset sets. Our own asset-progress monitor, on the other hand,
// reports the live file count in `./uploads/` every couple of seconds:
//   [assets-progress] uploads/ = 596 file(s), 13.6 MB (+59 since last tick)
// We hook into that line to advance the percent smoothly within the
// assets stage's percent band.
//
// Since we don't know the final asset total up-front, we use an asymptotic
// curve `fraction = 1 - 1/(1 + count/1000)` that approaches the next stage
// boundary as count grows but never overshoots it (the `- 1` keeps a 1%
// gap so the CLI's real `✔ assets:` line can still register the jump).
const matchAssetMonitorProgress = (job, line) => {
  const m = line.match(/\[assets-progress\]\s+uploads\/\s*=\s*(\d+)\s+file\(s\)(?:,\s*([\d.]+\s*[KMGT]?B))?/i);
  if (!m) return false;

  if (!/assets/i.test(job.progress?.stage || "")) return true;

  // We're inside the assets stage — by definition every prior stage
  // (schemas, entities, links) is done even if Strapi v5's CLI never
  // emitted a `✔` line for them. Backfill so the % bar starts from the
  // correct stage band instead of being stuck at 20%.
  markPriorStagesDone(job, "assets");

  const count = Number(m[1]);
  const sizeLabel = m[2] || "";

  // Asymptotic curve — midpoint at ~500 files (was 1000) so small-to-medium
  // archives reach the upper half of the assets band quickly. At count=500
  // fraction=0.5; at count=2000 fraction=0.8; at count=5000 fraction=0.91.
  const fraction = 1 - 1 / (1 + count / 500);
  const stageSpan = 100 / KNOWN_STAGES.length;
  const stageBase = (job.stagesDone?.length || 0) * stageSpan;
  const withinStagePercent = Math.round(
    Math.min(stageBase + stageSpan - 1, stageBase + fraction * stageSpan),
  );

  job.progress = {
    percent: Math.max(job.progress?.percent || 0, withinStagePercent),
    stage: `assets: ${count.toLocaleString()} file(s)${sizeLabel ? ` (${sizeLabel})` : ""}`,
  };
  return true;
};

const updateProgressFromLine = (job, line) => {
  if (!Array.isArray(job.stagesDone)) job.stagesDone = [];
  if (matchPercent(job, line)) return;
  if (matchStageDone(job, line)) return;
  if (matchStageProgress(job, line)) return;
  if (matchStageStarted(job, line)) return;
  if (matchAssetMonitorProgress(job, line)) return;
  matchCompletion(job, line);
};

/**
 * Creates a new job in the configured store, prunes expired entries, and
 * returns the freshly-created job object. Callers should treat the returned
 * job as a snapshot — subsequent mutations must go through `pushLog` /
 * `updateJob` so they are persisted to disk and visible to other replicas.
 */
const makeJob = (type) => {
  const store = getJobStore();
  store.prune();
  return store.create(type);
};

/**
 * Appends a CLI log line to the job, runs progress-regex matchers, and
 * schedules a debounced flush to disk. Returns silently if the job no
 * longer exists in the store (e.g. expired between events).
 */
const pushLog = (jobId, { stream, line }) => {
  const store = getJobStore();
  store.update(jobId, (job) => {
    job.lastLine = line;
    job.lastStream = stream;
    if (!Array.isArray(job.logLines)) job.logLines = [];
    job.logLines.push({ stream, line, at: Date.now() });
    if (job.logLines.length > MAX_LOG_LINES) job.logLines.shift();
    updateProgressFromLine(job, line);
  });
};

/**
 * Applies a shallow patch to a job and schedules a debounced flush.
 * Used by `background-job.js` for terminal status transitions
 * (success/error/finishedAt).
 */
const updateJob = (jobId, patch) => {
  const store = getJobStore();
  return store.update(jobId, (job) => Object.assign(job, patch));
};

/**
 * Forces an immediate write of the cached job to disk, bypassing the
 * debounce timer. Called when a job ends so the final status is visible
 * to other replicas without waiting for the debounce window.
 */
const finalizeJob = (jobId) => {
  const store = getJobStore();
  store.flush(jobId);
};

const serializeJob = (job) => ({
  id: job.id,
  type: job.type,
  status: job.status,
  startedAt: new Date(job.startedAt).toISOString(),
  finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
  elapsedMs: (job.finishedAt || Date.now()) - job.startedAt,
  progress: job.progress,
  stagesDone: Array.isArray(job.stagesDone) ? job.stagesDone : [],
  transferComplete: Boolean(job.transferComplete),
  lastLine: job.lastLine,
  lastStream: job.lastStream,
  recentLines: (job.logLines || []).slice(-80),
  result: job.result,
  error: job.error,
});

const getJob = (id) => {
  const store = getJobStore();
  const job = store.get(id);
  return job ? serializeJob(job) : null;
};

const listJobs = () => {
  const store = getJobStore();
  store.prune();
  return store.list().map(serializeJob);
};

module.exports = { makeJob, pushLog, updateJob, finalizeJob, getJob, listJobs };
