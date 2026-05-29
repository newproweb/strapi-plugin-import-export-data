"use strict";

module.exports = {
  TUS_PATH: "/import-export-data/backup/upload/tus",
  TUS_DIR_NAME: ".tus",
  TUS_THRESHOLD_BYTES: 16 * 1024 * 1024,
  TUS_CHUNK_SIZE_BYTES: 8 * 1024 * 1024,
  TUS_PARALLEL_UPLOADS: 4,
};
