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

const streamChunk = (buf, stream, onLog, sink) => {
  const text = buf.toString();
  sink.append(stream, text);
  const lines = text.split(/[\r\n]+/).filter((l) => l.trim());
  for (const line of lines) emitLine(stream, line, onLog);
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

    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* noop */ }
      reject(new Error(`strapi ${args[0]} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stdout.on("data", (buf) => streamChunk(buf, "stdout", onLog, sink));
    child.stderr.on("data", (buf) => streamChunk(buf, "stderr", onLog, sink));

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ code, stdout: sink.stdout, stderr: sink.stderr });
        return;
      }
      const tail = (sink.stderr || sink.stdout).trim().split(/\r?\n/).slice(-10).join("\n");
      reject(new Error(`strapi ${args.join(" ")} exited with code ${code}.\n${tail}`));
    });
  });

module.exports = { resolveStrapiBin, runStrapiCli };
