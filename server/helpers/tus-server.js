"use strict";

const fs = require("fs");
const path = require("path");

const { Server } = require("@tus/server");
const { FileStore } = require("@tus/file-store");

const { backupDir } = require("../utils/fs");
const { TUS_PATH, TUS_DIR_NAME } = require("../constants/upload");

let _server = null;
let _tusDir = null;

const ensureTusDir = () => {
  if (_tusDir) return _tusDir;
  _tusDir = path.join(backupDir(), TUS_DIR_NAME);
  fs.mkdirSync(_tusDir, { recursive: true });
  return _tusDir;
};

const tusFilePath = (uploadId) => path.join(ensureTusDir(), uploadId);

const tusInfoPath = (uploadId) => `${tusFilePath(uploadId)}.json`;

const removeTusInfo = (uploadId) => fs.promises.unlink(tusInfoPath(uploadId)).catch(() => { });

const getTusServer = () => {
  if (_server) return _server;
  _server = new Server({
    path: TUS_PATH,
    datastore: new FileStore({ directory: ensureTusDir() }),
    relativeLocation: true,
    respectForwardedHeaders: true,
  });
  return _server;
};

/**
 * Drops the singleton instances so a `strapi develop` reload reinitializes
 * cleanly. Called from the plugin's `destroy` lifecycle. Idempotent.
 */
const resetTusServer = () => {
  _server = null;
  _tusDir = null;
};

module.exports = {
  getTusServer,
  ensureTusDir,
  tusFilePath,
  removeTusInfo,
  resetTusServer,
};
