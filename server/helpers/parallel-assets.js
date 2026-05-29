"use strict";

const fs = require("fs");
const zlib = require("zlib");
const path = require("path");
const { pipeline } = require("stream/promises");
const tar = require("tar");

const { appRoot } = require("../utils/fs");

const DEFAULT_CONCURRENCY = 16;
const SMALL_FILE_BYTES = 64 * 1024;
const ASSETS_PREFIXES = ["assets/uploads/", "uploads/"];

const isEncryptedArchive = (filePath) => filePath.toLowerCase().endsWith(".enc");

const isGzipped = (filePath) => /\.t?gz$/i.test(filePath) || filePath.toLowerCase().endsWith(".tar.gz");

const matchesAssetEntry = (entryPath) => ASSETS_PREFIXES.some((prefix) => entryPath.startsWith(prefix));

const publicUploadsDir = () => path.join(appRoot(), "public", "uploads");

const ensureUploadsDir = async () => {
  const dir = publicUploadsDir();
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
};

/**
 * Streams each matching tar entry directly to disk via pipeline(), never
 * buffering a full file in memory. Backpressure is applied by pausing the
 * upstream Readable (the gunzip output, or the raw file when not gzipped)
 * once `concurrency` writes are in flight — node-tar's Parser is itself a
 * Writable, so it has no pause/resume of its own. Resumed as writes finish.
 *
 * Returns stats: `{ skipped, extracted, bytes, errors, durationMs }`.
 */
const extractAssetsFromArchive = async (archivePath, { concurrency = DEFAULT_CONCURRENCY, onLog } = {}) => {
  if (isEncryptedArchive(archivePath)) {
    return { skipped: true, reason: "encrypted archive — CLI will handle assets", extracted: 0, bytes: 0, errors: 0, durationMs: 0 };
  }

  const uploadsDir = await ensureUploadsDir();
  const started = Date.now();

  let extracted = 0;
  let bytes = 0;
  const errors = [];

  await new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(archivePath);
    const source = isGzipped(archivePath) ? fileStream.pipe(zlib.createGunzip()) : fileStream;
    const tarStream = tar.t({});
    source.pipe(tarStream);

    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    fileStream.on("error", fail);
    source.on("error", fail);
    tarStream.on("error", fail);

    let active = 0;
    let sourcePaused = false;
    let ended = false;
    let firstEntryPath = null;

    const maybePause = () => {
      if (active >= concurrency && !sourcePaused) {
        source.pause();
        sourcePaused = true;
      }
    };

    const maybeResume = () => {
      if (active < concurrency && sourcePaused) {
        source.resume();
        sourcePaused = false;
      }
    };

    const tryFinish = () => {
      if (settled) return;
      if (ended && active === 0) {
        settled = true;
        resolve();
      }
    };

    tarStream.on("entry", (entry) => {
      if (!firstEntryPath) firstEntryPath = entry.path;

      if (entry.type !== "File" || !matchesAssetEntry(entry.path)) {
        entry.resume();
        return;
      }

      const dest = path.join(uploadsDir, path.basename(entry.path));
      active += 1;
      maybePause();

      let written = 0;
      entry.on("data", (chunk) => { written += chunk.length; });

      pipeline(entry, fs.createWriteStream(dest))
        .then(() => {
          extracted += 1;
          bytes += written;
        })
        .catch((err) => {
          errors.push({ file: path.basename(dest), message: err.message });
          onLog?.({ stream: "stderr", line: `[parallel-assets] write failed: ${path.basename(dest)} — ${err.message}` });
        })
        .finally(() => {
          active -= 1;
          maybeResume();
          tryFinish();
        });
    });

    tarStream.on("end", () => {
      if (firstEntryPath) onLog?.({ stream: "stdout", line: `[parallel-assets] first archive entry: ${firstEntryPath}` });
      ended = true;
      tryFinish();
    });
  });

  return {
    skipped: false,
    extracted,
    bytes,
    errors: errors.length,
    durationMs: Date.now() - started,
  };
};

module.exports = { extractAssetsFromArchive, publicUploadsDir };
