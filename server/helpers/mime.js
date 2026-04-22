"use strict";

const pickDownloadMime = (fileName) => {
  const ext = fileName.split(".").pop();
  return ext === "enc" ? "application/octet-stream" : "application/gzip";
};

module.exports = { pickDownloadMime };
