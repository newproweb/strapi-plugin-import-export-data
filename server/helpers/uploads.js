"use strict";

const fs = require("fs");
const path = require("path");

const { appRoot } = require("../utils/fs");
const { recordPending, clearPending } = require("./pad-tracker");

const uploadCandidates = () => {
  const root = appRoot();
  return [path.join(root, "public", "uploads"), path.join(root, "uploads")];
};

const walkDir = (dir, acc) => {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, acc);
      continue;
    }

    if (!entry.isFile()) continue;
    acc.files += 1;

    try { acc.bytes += fs.statSync(full).size; } catch { /* ignore */ }
  }
};

const summarizeUploads = () => {
  const found = uploadCandidates().find((p) => fs.existsSync(p));
  if (!found) return { path: null, files: 0, bytes: 0 };
  const acc = { files: 0, bytes: 0 };
  walkDir(found, acc);
  return { path: found, ...acc };
};

const resolveLocalUploadPath = (urlPath) => {
  if (!urlPath || typeof urlPath !== "string") return null;
  if (/^https?:\/\//i.test(urlPath)) return null;
  if (!urlPath.startsWith("/uploads/")) return null;
  return path.join(appRoot(), "public", urlPath);
};

const UPLOAD_PAGE_SIZE = 500;

const readAllUploadRows = async () => {
  try {
    const all = [];
    let offset = 0;
    while (true) {
      const batch = await strapi.db.query("plugin::upload.file").findMany({
        limit: UPLOAD_PAGE_SIZE,
        offset,
        orderBy: { id: "asc" },
      });

      if (!batch || batch.length === 0) break;
      all.push(...batch);

      if (batch.length < UPLOAD_PAGE_SIZE) break;
      offset += UPLOAD_PAGE_SIZE;
    }
    return all;
  } catch (err) {
    strapi.log.warn(`[import-export] readAllUploadRows failed: ${err.message}`);
    return null;
  }
};

const canonicalLocalPath = (hash, ext) => {
  if (!hash || typeof hash !== "string") return null;
  const safeExt = typeof ext === "string" && ext.length > 0 ? ext : "";
  return path.join(appRoot(), "public", "uploads", `${hash}${safeExt}`);
};

const collectTargetPaths = (row) => {
  const targets = new Set();

  const addUrl = (url) => {
    const full = resolveLocalUploadPath(url);
    if (full) targets.add(full);
  };

  const addHashExt = (hash, ext) => {
    const full = canonicalLocalPath(hash, ext);
    if (full) targets.add(full);
  };

  if (row?.url) addUrl(row.url);
  addHashExt(row?.hash, row?.ext);

  if (row?.formats && typeof row.formats === "object") {
    for (const variant of Object.values(row.formats)) {
      if (!variant || typeof variant !== "object") continue;
      if (variant.url) addUrl(variant.url);
      addHashExt(variant.hash, variant.ext);
    }
  }

  return targets;
};

const writePlaceholder = (full) => {
  try {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "");
    return true;
  } catch (err) {
    strapi.log.warn(`[import-export] pad placeholder ${full} failed: ${err.message}`);
    return false;
  }
};

const padMissingUploadFiles = async (emit) => {
  const created = [];
  const rows = await readAllUploadRows();
  if (!rows) {
    if (emit) emit(`[pad] could not read plugin::upload.file — skipping placeholder pad`);
    return created;
  }

  for (const row of rows) {
    for (const full of collectTargetPaths(row)) {
      if (fs.existsSync(full)) continue;
      if (writePlaceholder(full)) created.push(full);
    }
  }

  if (created.length > 0) recordPending(created);

  if (!emit) return created;
  if (created.length === 0) {
    emit(`[pad] all ${rows.length} upload_file row(s) resolved to existing files — no placeholders needed`);
  } else {
    emit(`[pad] created ${created.length} empty placeholder file(s) for missing uploads (scanned ${rows.length} rows)`);
  }

  return created;
};

const cleanupPaddedFiles = (created, emit) => {
  if (!created || created.length === 0) return;
  let removed = 0;
  for (const p of created) {
    try { fs.unlinkSync(p); removed += 1; } catch { /* ignore */ }
  }
  clearPending(created);
  if (emit) emit(`[pad] removed ${removed} placeholder file(s)`);
};

module.exports = {
  summarizeUploads,
  resolveLocalUploadPath,
  padMissingUploadFiles,
  cleanupPaddedFiles,
};
