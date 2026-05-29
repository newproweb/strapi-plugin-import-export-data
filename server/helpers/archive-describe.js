"use strict";

const fs = require("fs");
const path = require("path");

const { invalidateListCache } = require("./archives");

const archiveCreatedAt = (stats) =>
  new Date(stats.birthtimeMs || stats.mtimeMs || Date.now()).toISOString();

const describeArchive = ({ archivePath, id, started, paddedCount, cliStdout }) => {
  const stats = fs.statSync(archivePath);
  invalidateListCache();
  return {
    id,
    file: path.basename(archivePath),
    path: archivePath,
    size: stats.size,
    createdAt: archiveCreatedAt(stats),
    durationMs: Date.now() - started,
    encrypted: archivePath.endsWith(".enc"),
    compressed: archivePath.includes(".tar.gz"),
    paddedMissingFiles: paddedCount,
    cliStdout: cliStdout.slice(-2000),
  };
};

module.exports = { describeArchive };
