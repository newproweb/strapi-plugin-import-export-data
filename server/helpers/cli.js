"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { appRoot } = require("../utils/fs");
const { safeLog, safeInfo } = require("../utils/log");
const { CLI_TIMEOUT_MS } = require("../constants/backup");

const resolveStrapiBin = () => {
  const root = appRoot();
  const isWin = process.platform === "win32";

  const binShim = path.join(root, "node_modules", ".bin", isWin ? "strapi.cmd" : "strapi");
  if (fs.existsSync(binShim)) return { cmd: binShim, baseArgs: [] };

  const jsBin = path.join(root, "node_modules", "@strapi", "strapi", "bin", "strapi.js");
  if (fs.existsSync(jsBin)) return { cmd: process.execPath, baseArgs: [jsBin] };

  return { cmd: isWin ? "npx.cmd" : "npx", baseArgs: ["strapi"] };
};

const emitLine = (stream, line, onLog) => {
  safeLog(stream === "stdout" ? "info" : "warn", `[strapi-cli] ${line}`);
  if (!onLog) return;
  try {
    onLog({ stream, line });
  } catch { /* ignore sink errors */ }
};

const streamChunk = (buf, stream, onLog, sink, state) => {
  const text = buf.toString();
  sink.append(stream, text);
  const lines = text.split(/[\r\n]+/).filter((l) => l.trim());
  for (const line of lines) {
    if (state.last === line) continue; // skip spinner redraws of same line
    state.last = line;
    state.lastAt = Date.now();
    emitLine(stream, line, onLog);
  }
};

const HEARTBEAT_MS = 30 * 1000;
const ABORT_POLL_MS = 2 * 1000;
const SIGTERM_GRACE_MS = 8 * 1000;

const activeChildren = new Set();

/**
 * Politely terminates a child. Tries SIGTERM first so Postgres can roll back
 * any in-flight transaction cleanly, then escalates to SIGKILL after a
 * `SIGTERM_GRACE_MS` window if the child has not exited. No-op when the
 * child is already gone.
 */
const gracefulKill = (child) => {
  if (!child || child.killed || child.exitCode !== null) return;
  try { child.kill("SIGTERM"); } catch { /* noop */ }
  setTimeout(() => {
    if (!child.killed && child.exitCode === null) {
      try { child.kill("SIGKILL"); } catch { /* noop */ }
    }
  }, SIGTERM_GRACE_MS).unref();
};

/**
 * Returns the set of CLI child processes the plugin currently owns. Used by
 * the destroy lifecycle to terminate them on `strapi develop` reload so they
 * do not outlive their parent.
 */
const getActiveChildren = () => activeChildren;

const emitHeartbeat = (child, state, onLog) => {
  if (!child || child.killed || child.exitCode !== null) return;
  const idleMs = Date.now() - (state.lastAt || state.startedAt);
  if (idleMs < HEARTBEAT_MS) return;
  const idleSec = Math.round(idleMs / 1000);
  const msg = `[heartbeat] strapi CLI (pid ${child.pid}) still running — no new output for ${idleSec}s (last: "${state.last || "spawn"}")`;
  emitLine("stdout", msg, onLog);
};

const runStrapiCli = (args, { timeoutMs = CLI_TIMEOUT_MS, onLog, shouldAbort } = {}) =>
  new Promise((resolve, reject) => {
    const { cmd, baseArgs } = resolveStrapiBin();
    const fullArgs = [...baseArgs, ...args];
    safeInfo(`[import-export] spawning: ${cmd} ${fullArgs.join(" ")}`);

    // The child CLI re-bootstraps a full Strapi instance before running the
    // import/export. Two env overrides matter:
    //   - NODE_ENV: forced to "production" so the child skips chokidar file
    //     watcher, admin panel rebuild, and other develop-mode side effects
    //     (otherwise child can sit in "Spawning…" for 30-60s on dev hosts).
    //   - TESTING_MODE: forced off so user-defined bootstrap seeds (e.g.
    //     `if (TESTING_MODE) await seedHomePage(...)`) do NOT run inside the
    //     short-lived import/export process. Otherwise seeds insert rows
    //     that don't belong in the source archive — turning a clean restore
    //     into a partially polluted DB on cross-server imports.
    const existingNodeOptions = process.env.NODE_OPTIONS || "";
    const heapFlag = /--max-old-space-size/.test(existingNodeOptions) ? "" : "--max-old-space-size=4096";
    const childNodeOptions = [existingNodeOptions, heapFlag].filter(Boolean).join(" ");

    const child = spawn(cmd, fullArgs, {
      cwd: appRoot(),
      env: {
        ...process.env,
        STRAPI_TELEMETRY_DISABLED: "true",
        NODE_ENV: "production",
        TESTING_MODE: "false",
        NODE_OPTIONS: childNodeOptions,
      },
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    // `strapi import` is interactive: it confirms data deletion and — for an
    // archive exported from a different project — a schema-difference prompt.
    // The child has no TTY, so any unanswered prompt hangs it until the parent
    // times out the whole CLI run. `--force` covers some prompts but not the
    // schema one on every Strapi version, so feed explicit "y" answers down
    // stdin. Reaching this spawn already means the caller consented to the
    // destructive import.
    try {
      child.stdin.write("y\n".repeat(10));
      child.stdin.end();
    } catch { /* stdin already closed — nothing to confirm */ }

    const sink = {
      stdout: "",
      stderr: "",
      append(stream, text) { this[stream] += text; },
    };
    const state = { last: "", lastAt: Date.now(), startedAt: Date.now() };

    let aborted = false;
    activeChildren.add(child);

    const timer = setTimeout(() => {
      gracefulKill(child);
      reject(new Error(`strapi ${args[0]} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    const heartbeat = setInterval(() => emitHeartbeat(child, state, onLog), HEARTBEAT_MS);

    const abortPoll = shouldAbort
      ? setInterval(() => {
          let stop = false;
          try { stop = Boolean(shouldAbort()); } catch { stop = false; }
          if (!stop) return;
          aborted = true;
          emitLine("stdout", "[abort] abort requested — terminating the strapi CLI…", onLog);
          gracefulKill(child);
        }, ABORT_POLL_MS)
      : null;

    const clearTimers = () => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      if (abortPoll) clearInterval(abortPoll);
      activeChildren.delete(child);
    };

    child.stdout.on("data", (buf) => streamChunk(buf, "stdout", onLog, sink, state));
    child.stderr.on("data", (buf) => streamChunk(buf, "stderr", onLog, sink, state));

    child.on("error", (err) => {
      clearTimers();
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimers();
      if (aborted) {
        reject(new Error("Job aborted by user."));
        return;
      }
      if (code === 0) {
        resolve({ code, stdout: sink.stdout, stderr: sink.stderr });
        return;
      }
      const tail = (sink.stderr || sink.stdout).trim().split(/\r?\n/).slice(-10).join("\n");
      reject(new Error(`strapi ${args.join(" ")} exited with code ${code}.\n${tail}`));
    });
  });

module.exports = { resolveStrapiBin, runStrapiCli, getActiveChildren, gracefulKill };
