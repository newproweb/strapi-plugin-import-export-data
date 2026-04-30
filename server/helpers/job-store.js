"use strict";

const fs = require("fs");
const path = require("path");

const { backupDir } = require("../utils/fs");
const { JOB_TTL_MS } = require("../constants/backup");

// Cross-replica fallback: if `logLines[last].at` is older than this and we
// can't verify owner liveness via PID (e.g. owner was on another host), the
// job is considered abandoned. Reduced from 30min so admins get feedback on
// crashed parents within ~5min instead of waiting half an hour.
const STUCK_JOB_MS = 5 * 60 * 1000;
// In-replica fast path: if owner PID matches our hostname AND the OS reports
// the process is dead, mark the job abandoned immediately (no wait).
const PID_RECHECK_GRACE_MS = 30 * 1000;
const LOCK_TTL_MS = 30 * 60 * 1000;
const FLUSH_DEBOUNCE_MS = 200;
const HOSTNAME = require("os").hostname();

// `_writeCached` and `prune` run inside setTimeout / scheduled callbacks that
// can fire mid-reload while `strapi develop` is swapping the global instance.
// Logging via `strapi.log.warn` directly would raise ReferenceError and crash
// the process — wrap in a defensive helper that no-ops if the global is gone.
const safeWarn = (msg) => {
  try {
    if (typeof strapi !== "undefined" && strapi?.log?.warn) strapi.log.warn(msg);
  } catch { /* ignore */ }
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const jobsRoot = () => ensureDir(path.join(backupDir(), ".jobs"));

const lockPath = () => path.join(jobsRoot(), ".lock");

const jobPath = (id) => path.join(jobsRoot(), `${id}.json`);

const writeAtomic = (file, data) => {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
};

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
};

const newJobId = () =>
  `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const blankJob = (type) => ({
  id: newJobId(),
  type,
  status: "running",
  startedAt: Date.now(),
  finishedAt: null,
  lastLine: "",
  lastStream: "stdout",
  logLines: [],
  progress: { percent: 0, stage: "" },
  stagesDone: [],
  transferComplete: false,
  result: null,
  error: null,
  // Owner identity — used by `prune()` to detect abandoned jobs the moment
  // the parent process dies, instead of waiting STUCK_JOB_MS for log silence.
  ownerPid: process.pid,
  ownerHost: HOSTNAME,
});

/**
 * File-based JobStore — persists job state under `<backupDir>/.jobs/<jobId>.json`
 * via atomic rename. Multi-replica safe as long as the backup directory is on
 * a shared filesystem; replicas reading the disk see job state written by the
 * replica that spawned the CLI child. Writes are debounced per-job to avoid
 * thrashing under high CLI log throughput.
 */
class FileJobStore {
  constructor() {
    this.cache = new Map();
    this.flushTimers = new Map();
  }

  create(type) {
    const job = blankJob(type);
    this.cache.set(job.id, job);
    writeAtomic(jobPath(job.id), JSON.stringify(job));
    return job;
  }

  get(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    return readJson(jobPath(id));
  }

  list() {
    const dir = jobsRoot();
    let names;
    try {
      names = fs.readdirSync(dir).filter((n) => n.endsWith(".json") && !n.startsWith("."));
    } catch {
      names = [];
    }
    const seen = new Set();
    const jobs = [];
    for (const name of names) {
      const job = readJson(path.join(dir, name));
      if (!job || !job.id) continue;
      seen.add(job.id);
      jobs.push(job);
    }
    for (const [id, job] of this.cache) {
      if (!seen.has(id)) jobs.push(job);
    }
    return jobs;
  }

  update(id, mutator) {
    let job = this.cache.get(id);
    if (!job) {
      job = readJson(jobPath(id));
      if (!job) return null;
      this.cache.set(id, job);
    }
    mutator(job);
    this._scheduleWrite(id);
    return job;
  }

  _scheduleWrite(id) {
    if (this.flushTimers.has(id)) return;
    const timer = setTimeout(() => {
      this.flushTimers.delete(id);
      this._writeCached(id);
    }, FLUSH_DEBOUNCE_MS);
    this.flushTimers.set(id, timer);
  }

  _writeCached(id) {
    const job = this.cache.get(id);
    if (!job) return;
    try {
      writeAtomic(jobPath(id), JSON.stringify(job));
    } catch (err) {
      safeWarn(`[import-export] failed to flush job ${id}: ${err.message}`);
    }
  }

  flush(id) {
    if (this.flushTimers.has(id)) {
      clearTimeout(this.flushTimers.get(id));
      this.flushTimers.delete(id);
    }
    this._writeCached(id);
  }

  delete(id) {
    this.cache.delete(id);
    if (this.flushTimers.has(id)) {
      clearTimeout(this.flushTimers.get(id));
      this.flushTimers.delete(id);
    }
    try { fs.unlinkSync(jobPath(id)); } catch { /* ignore */ }
  }

  prune() {
    const now = Date.now();
    const ttlCutoff = now - JOB_TTL_MS;
    const stuckCutoff = now - STUCK_JOB_MS;
    const dir = jobsRoot();

    let names;
    try {
      names = fs.readdirSync(dir).filter((n) => n.endsWith(".json") && !n.startsWith("."));
    } catch {
      return;
    }

    for (const name of names) {
      const file = path.join(dir, name);
      const job = readJson(file);
      if (!job || !job.id) {
        try { fs.unlinkSync(file); } catch { /* ignore */ }
        continue;
      }
      if (job.finishedAt && job.finishedAt < ttlCutoff) {
        this.delete(job.id);
        continue;
      }
      if (job.status === "running" && !job.finishedAt) {
        const lastActivity = Array.isArray(job.logLines) && job.logLines.length
          ? job.logLines[job.logLines.length - 1].at
          : job.startedAt;
        const ageMs = now - lastActivity;

        // Fast path: same host, owner PID is dead — abandon immediately. Only
        // applies after a short grace period so we don't false-positive on a
        // job whose owner is still bootstrapping its first heartbeat.
        let abandoned = false;
        let reason = "";
        if (
          job.ownerPid
          && job.ownerHost === HOSTNAME
          && job.ownerPid !== process.pid
          && ageMs > PID_RECHECK_GRACE_MS
        ) {
          let alive = true;
          try { process.kill(job.ownerPid, 0); }
          catch (err) { if (err.code === "ESRCH") alive = false; }
          if (!alive) {
            abandoned = true;
            reason = `owner process pid=${job.ownerPid} is no longer running (likely a crashed parent on ${HOSTNAME})`;
          }
        }

        // Cross-replica fallback: if log silence exceeds STUCK_JOB_MS, mark
        // abandoned regardless of whether we can verify the owner.
        if (!abandoned && lastActivity < stuckCutoff) {
          abandoned = true;
          reason = `no progress for ${Math.round(STUCK_JOB_MS / 60000)} minutes (likely left over from a crashed process)`;
        }

        if (abandoned) {
          job.status = "error";
          job.error = `Job abandoned — ${reason}.`;
          job.finishedAt = now;
          try {
            writeAtomic(file, JSON.stringify(job));
          } catch (err) {
            safeWarn(`[import-export] failed to mark stuck job ${job.id}: ${err.message}`);
          }
        }
      }
    }
  }
}

/**
 * File-based distributed mutex — uses `fs.writeFileSync` with `flag: "wx"` for
 * atomic create-if-not-exists. Stores `{ label, jobId, acquiredAt, pid }` in
 * `<backupDir>/.jobs/.lock`. Stale locks older than `LOCK_TTL_MS` are
 * auto-reclaimed so a replica crash mid-job doesn't permanently block the
 * other replicas.
 */
class FileJobMutex {
  current() {
    const data = readJson(lockPath());
    if (!data) return null;
    if (Date.now() - (data.acquiredAt || 0) > LOCK_TTL_MS) {
      try { fs.unlinkSync(lockPath()); } catch { /* ignore */ }
      return null;
    }
    return data;
  }

  isBusy() {
    return this.current() !== null;
  }

  currentLabel() {
    const data = this.current();
    return data ? data.label : null;
  }

  acquire(label, jobId) {
    ensureDir(jobsRoot());
    const data = JSON.stringify({ label, jobId, acquiredAt: Date.now(), pid: process.pid });

    try {
      fs.writeFileSync(lockPath(), data, { flag: "wx" });
      return;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }

    const existing = this.current();
    if (!existing) {
      try {
        fs.writeFileSync(lockPath(), data, { flag: "wx" });
        return;
      } catch { /* fall through to busy error */ }
    }

    const existingLabel = (existing && existing.label) || "backup";
    const existingId = (existing && existing.jobId) || "?";
    const e = new Error(
      `Another ${existingLabel} job is already running (id=${existingId}) — wait for it to finish or cancel it before starting ${label}.`,
    );
    e.status = 409;
    throw e;
  }

  release(jobId) {
    const data = this.current();
    if (!data) return;
    if (jobId && data.jobId !== jobId) return;
    try { fs.unlinkSync(lockPath()); } catch { /* ignore */ }
  }
}

let _store = null;
let _mutex = null;

const getJobStore = () => {
  if (!_store) _store = new FileJobStore();
  return _store;
};

const getJobMutex = () => {
  if (!_mutex) _mutex = new FileJobMutex();
  return _mutex;
};

const setJobStore = (instance) => { _store = instance; };
const setJobMutex = (instance) => { _mutex = instance; };

module.exports = {
  FileJobStore,
  FileJobMutex,
  getJobStore,
  getJobMutex,
  setJobStore,
  setJobMutex,
};
