"use strict";

const path = require("path");
const { spawn } = require("child_process");

const isEncrypted = (file) => /\.enc$/i.test(file);
const isGzipped = (file) => /\.gz$/i.test(file);

// Runs `tar` with the archive referenced by basename + cwd so a Windows
// `C:\…` path is never handed to tar — a colon there means "remote host".
const tarExtract = (archivePath, member) =>
  new Promise((resolve) => {
    const flags = isGzipped(archivePath) ? "-xzOf" : "-xOf";
    const child = spawn("tar", [flags, path.basename(archivePath), member], {
      cwd: path.dirname(archivePath),
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.on("error", () => resolve(null));
    child.on("exit", (code) => resolve(code === 0 ? stdout : null));
  });

// Reads the full content-type/component schema objects from the `schemas/`
// JSONL bundled in a Strapi export archive. Each line is one schema object
// carrying its `uid`. Returns null when the archive can't be read.
const readArchiveSchemas = async (archivePath) => {
  const dump = await tarExtract(archivePath, "schemas");
  if (dump === null) return null;

  const schemas = [];
  for (const line of dump.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const schema = JSON.parse(trimmed);
      if (schema && schema.uid) schemas.push(schema);
    } catch { /* skip a non-JSON line */ }
  }
  return schemas;
};

const liveUids = (strapi) => new Set([
  ...Object.keys(strapi.contentTypes || {}),
  ...Object.keys(strapi.components || {}),
]);

/**
 * Compares the schema of an archive against the running Strapi instance so the
 * caller can ask the user to confirm before a destructive cross-schema import.
 * Never throws — an unreadable/encrypted archive resolves to `hasDifferences:
 * false` so the restore can still proceed.
 */
const diffArchiveSchema = async (archivePath, strapi) => {
  if (isEncrypted(archivePath)) return { hasDifferences: false, skipped: "encrypted" };

  const schemas = await readArchiveSchemas(archivePath);
  if (schemas === null) return { hasDifferences: false, skipped: "unreadable" };
  if (schemas.length === 0) return { hasDifferences: false, skipped: "no-schemas" };

  const live = liveUids(strapi);
  const archive = new Set(schemas.map((s) => s.uid));

  const onlyInArchive = [...archive].filter((uid) => !live.has(uid)).sort();
  const onlyInDestination = [...live].filter((uid) => !archive.has(uid)).sort();

  return {
    hasDifferences: onlyInArchive.length > 0 || onlyInDestination.length > 0,
    summary: { onlyInArchive, onlyInDestination },
  };
};

module.exports = { diffArchiveSchema, readArchiveSchemas };
