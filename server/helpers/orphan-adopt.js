"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { appRoot } = require("../utils/fs");

const VARIANT_PREFIXES = ["thumbnail_", "small_", "medium_", "large_"];
const PAGE_SIZE = 500;
const INSERT_CHUNK = 200;
const PROGRESS_EVERY = 1000;

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".zip": "application/zip",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

const uploadsDir = () => path.join(appRoot(), "public", "uploads");

const isVariantName = (name) => VARIANT_PREFIXES.some((p) => name.startsWith(p));

const mimeFor = (ext) => MIME_BY_EXT[ext.toLowerCase()] || "application/octet-stream";

const listUploadedFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name);
  } catch {
    return [];
  }
};

const collectKnownBasenames = (rows) => {
  const known = new Set();
  for (const row of rows) {
    if (row?.url) known.add(path.basename(row.url));
    if (!row?.formats || typeof row.formats !== "object") continue;
    for (const variant of Object.values(row.formats)) {
      if (variant?.url) known.add(path.basename(variant.url));
    }
  }
  return known;
};

const sanitizeHashBase = (base) =>
  base.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "file";

const randomSuffix = () => crypto.randomBytes(5).toString("hex");

const buildUploadRow = (filename, fullPath) => {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const hash = `${sanitizeHashBase(base)}_${randomSuffix()}`;
  const stat = fs.statSync(fullPath);
  const sizeKb = Number((stat.size / 1024).toFixed(2));

  return {
    name: filename,
    alternativeText: null,
    caption: null,
    width: null,
    height: null,
    formats: null,
    hash,
    ext,
    mime: mimeFor(ext),
    size: sizeKb,
    url: `/uploads/${filename}`,
    previewUrl: null,
    provider: "local",
    provider_metadata: null,
    folderPath: "/",
  };
};

const adoptOrphanUploads = async (emit) => {
  const dir = uploadsDir();
  if (!fs.existsSync(dir)) {
    if (emit) emit(`[adopt] no public/uploads directory — nothing to adopt`);
    return 0;
  }

  const rows = [];
  try {
    let offset = 0;
    while (true) {
      const batch = await strapi.db.query("plugin::upload.file").findMany({
        limit: PAGE_SIZE,
        offset,
        orderBy: { id: "asc" },
      });

      if (!batch || batch.length === 0) break;
      rows.push(...batch);

      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  } catch (err) {
    if (emit) emit(`[adopt] could not read plugin::upload.file (${err.message}) — skipping`);
    return 0;
  }

  const known = collectKnownBasenames(rows || []);
  const files = listUploadedFiles(dir);
  const candidates = files.filter((name) => !isVariantName(name) && !known.has(name));

  if (candidates.length === 0) {
    if (emit) emit(`[adopt] every file on disk already has a plugin::upload.file row — nothing to adopt`);
    return 0;
  }

  if (emit) emit(`[adopt] found ${candidates.length} orphan file(s) — inserting rows in batches of ${INSERT_CHUNK}…`);

  let adopted = 0;
  for (let i = 0; i < candidates.length; i += INSERT_CHUNK) {
    const chunk = candidates.slice(i, i + INSERT_CHUNK);
    const data = chunk.map((f) => buildUploadRow(f, path.join(dir, f)));

    try {
      await strapi.db.query("plugin::upload.file").createMany({ data });
      adopted += chunk.length;
    } catch (err) {
      strapi.log.warn(`[import-export] adopt batch failed (${err.message}) — falling back to per-row inserts`);

      for (const row of data) {
        try {
          await strapi.db.query("plugin::upload.file").create({ data: row });
          adopted += 1;
        } catch (e) {
          strapi.log.warn(`[import-export] adopt ${row.name} failed: ${e.message}`);
        }
      }

    }

    if (emit && (i + chunk.length) % PROGRESS_EVERY < INSERT_CHUNK) {
      emit(`[adopt] progress: ${Math.min(i + INSERT_CHUNK, candidates.length)}/${candidates.length}`);
    }

  }

  if (emit) {
    const skipped = files.length - candidates.length;
    emit(`[adopt] adopted ${adopted} orphan file(s) into plugin::upload.file (skipped ${skipped} variant/known file(s))`);
  }
  return adopted;
};

module.exports = { adoptOrphanUploads };
