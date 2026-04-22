"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { appRoot } = require("../utils/fs");
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
  const log = stream === "stdout" ? strapi.log.info : strapi.log.warn;
  log.call(strapi.log, `[strapi-cli] ${line}`);
  if (!onLog) return;
  try {
    onLog({ stream, line });
  } catch {
    // ignore sink errors
  }
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

const emitHeartbeat = (child, state, onLog) => {
  if (!child || child.killed || child.exitCode !== null) return;
  const idleMs = Date.now() - (state.lastAt || state.startedAt);
  if (idleMs < HEARTBEAT_MS) return;
  const idleSec = Math.round(idleMs / 1000);
  const msg = `[heartbeat] strapi CLI (pid ${child.pid}) still running — no new output for ${idleSec}s (last: "${state.last || "spawn"}")`;
  emitLine("stdout", msg, onLog);
};

const runStrapiCli = (args, { timeoutMs = CLI_TIMEOUT_MS, onLog } = {}) =>
  new Promise((resolve, reject) => {
    const { cmd, baseArgs } = resolveStrapiBin();
    const fullArgs = [...baseArgs, ...args];
    strapi.log.info(`[import-export] spawning: ${cmd} ${fullArgs.join(" ")}`);

    const child = spawn(cmd, fullArgs, {
      cwd: appRoot(),
      env: {
        ...process.env,
        STRAPI_TELEMETRY_DISABLED: "true",
        NODE_ENV: process.env.NODE_ENV || "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    const sink = {
      stdout: "",
      stderr: "",
      append(stream, text) { this[stream] += text; },
    };
    const state = { last: "", lastAt: Date.now(), startedAt: Date.now() };

    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* noop */ }
      reject(new Error(`strapi ${args[0]} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    const heartbeat = setInterval(() => emitHeartbeat(child, state, onLog), HEARTBEAT_MS);

    child.stdout.on("data", (buf) => streamChunk(buf, "stdout", onLog, sink, state));
    child.stderr.on("data", (buf) => streamChunk(buf, "stderr", onLog, sink, state));

    child.on("error", (err) => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      if (code === 0) {
        resolve({ code, stdout: sink.stdout, stderr: sink.stderr });
        return;
      }
      const tail = (sink.stderr || sink.stdout).trim().split(/\r?\n/).slice(-10).join("\n");
      reject(new Error(`strapi ${args.join(" ")} exited with code ${code}.\n${tail}`));
    });
  });

module.exports = { resolveStrapiBin, runStrapiCli };
