"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const MIN_ARCHIVE_BYTES = 1024;

const isEncrypted = (file) => /\.enc$/i.test(file);
const isGzipped = (file) => /\.tar\.gz(\.enc)?$/i.test(file);
const isPlainTar = (file) => /\.tar(\.enc)?$/i.test(file) && !/\.tar\.gz/i.test(file);

const extname = (file) => {
  if (/\.tar\.gz\.enc$/i.test(file)) return ".tar.gz.enc";
  if (/\.tar\.gz$/i.test(file)) return ".tar.gz";
  if (/\.tar\.enc$/i.test(file)) return ".tar.enc";
  if (/\.tar$/i.test(file)) return ".tar";
  return path.extname(file);
};

const assertFileExists = (filePath) => {
  if (!fs.existsSync(filePath)) {
    const err = new Error(`archive not found: ${path.basename(filePath)}`);
    err.status = 404;
    throw err;
  }
};

const assertMinSize = (filePath) => {
  const stat = fs.statSync(filePath);
  if (stat.size < MIN_ARCHIVE_BYTES) {
    throw new Error(
      `archive is suspiciously small (${stat.size} B < ${MIN_ARCHIVE_BYTES} B) — it may be truncated or empty.`,
    );
  }
  return stat.size;
};

const assertExtensionSafe = (filePath) => {
  const ext = extname(filePath);
  if (![".tar", ".tar.gz", ".tar.enc", ".tar.gz.enc"].includes(ext)) {
    throw new Error(`unsupported archive extension "${ext}" — expected .tar, .tar.gz, .tar.enc, or .tar.gz.enc`);
  }
};

const assertTarIntegrity = (filePath) => {
  if (isEncrypted(filePath)) return { skipped: "encrypted" };

  const flags = isGzipped(filePath) ? "-tzf" : "-tf";
  const result = spawnSync("tar", [flags, filePath], { encoding: "utf8" });
  if (result.error) {
    strapi.log.warn(`[import-export] tar integrity check skipped (${result.error.message}) — falling back to size-only check`);
    return { skipped: "tar-not-available" };
  }

  if (result.status !== 0) {
    const tail = (result.stderr || result.stdout || "").trim().split(/\r?\n/).slice(-3).join(" | ");
    throw new Error(`archive failed tar integrity check: ${tail || "unknown error"}`);
  }

  const entries = (result.stdout || "").split(/\r?\n/).filter(Boolean).length;
  return { entries };
};

const validateArchive = (filePath, emit) => {
  assertFileExists(filePath);
  assertExtensionSafe(filePath);
  const size = assertMinSize(filePath);
  const integrity = assertTarIntegrity(filePath);

  if (!emit) return { size, ...integrity };

  if (integrity.skipped === "encrypted") {
    emit(`[validate] archive OK (encrypted — integrity check skipped, size=${size} B)`);
  } else if (integrity.skipped === "tar-not-available") {
    emit(`[validate] archive OK (size=${size} B — tar binary unavailable, integrity not verified)`);
  } else {
    emit(`[validate] archive OK (size=${size} B, ${integrity.entries} entries)`);
  }

  return { size, ...integrity };
};

module.exports = { validateArchive, MIN_ARCHIVE_BYTES };
