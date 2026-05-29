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
const PAD_WRITE_CONCURRENCY = 16;

/**
 * Yields plugin::upload.file rows page-by-page without buffering the full
 * table in RAM. A 200k-row DB was pulling ~400 queries' worth of rows into
 * memory before the export even started — now each batch is consumed and
 * dropped before the next is fetched.
 */
async function* streamUploadRows() {
  let offset = 0;
  while (true) {
    let batch;
    try {
      batch = await strapi.db.query("plugin::upload.file").findMany({
        limit: UPLOAD_PAGE_SIZE,
        offset,
        orderBy: { id: "asc" },
      });
    } catch (err) {
      strapi.log.warn(`[import-export] streamUploadRows failed: ${err.message}`);
      return;
    }
    if (!batch || batch.length === 0) return;
    for (const row of batch) yield row;
    if (batch.length < UPLOAD_PAGE_SIZE) return;
    offset += UPLOAD_PAGE_SIZE;
  }
}

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

const writePlaceholder = async (full) => {
  try {
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, "");
    return true;
  } catch (err) {
    strapi.log.warn(`[import-export] pad placeholder ${full} failed: ${err.message}`);
    return false;
  }
};

const pathExists = (full) => fs.promises.access(full).then(() => true).catch(() => false);

/**
 * Pads every missing upload file referenced by `plugin::upload.file` with an
 * empty placeholder. Rows are streamed from the DB to avoid loading the whole
 * table into RAM, and the placeholder writes run with a bounded concurrency
 * pool so a 10k-row pad does not block the event loop with sync IO.
 */
const padMissingUploadFiles = async (emit) => {
  const created = [];
  let scanned = 0;
  let active = 0;
  const queue = [];

  const drain = () => new Promise((resolve) => {
    const check = () => {
      if (active === 0 && queue.length === 0) resolve();
      else setTimeout(check, 50).unref();
    };
    check();
  });

  const tryWrite = async (full) => {
    if (await pathExists(full)) return;
    if (await writePlaceholder(full)) created.push(full);
  };

  const schedule = (full) => {
    queue.push(full);
    pump();
  };

  const pump = () => {
    while (active < PAD_WRITE_CONCURRENCY && queue.length > 0) {
      const full = queue.shift();
      active += 1;
      tryWrite(full).finally(() => { active -= 1; pump(); });
    }
  };

  for await (const row of streamUploadRows()) {
    scanned += 1;
    for (const full of collectTargetPaths(row)) schedule(full);
  }

  await drain();

  if (created.length > 0) recordPending(created);

  if (!emit) return created;
  if (scanned === 0) {
    emit("[pad] could not read plugin::upload.file — skipping placeholder pad");
  } else if (created.length === 0) {
    emit(`[pad] all ${scanned} upload_file row(s) resolved to existing files — no placeholders needed`);
  } else {
    emit(`[pad] created ${created.length} empty placeholder file(s) for missing uploads (scanned ${scanned} rows)`);
  }

  return created;
};

const cleanupPaddedFiles = async (created, emit) => {
  if (!created || created.length === 0) return;
  let removed = 0;
  await Promise.all(created.map(async (p) => {
    try { await fs.promises.unlink(p); removed += 1; } catch { /* ignore */ }
  }));
  clearPending(created);
  if (emit) emit(`[pad] removed ${removed} placeholder file(s)`);
};

module.exports = {
  summarizeUploads,
  resolveLocalUploadPath,
  padMissingUploadFiles,
  cleanupPaddedFiles,
};
