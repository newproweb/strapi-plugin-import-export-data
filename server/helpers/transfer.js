"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { backupDir } = require("../utils/fs");
const { getBackupPath } = require("./archives");
const { readConfig } = require("./store-io");
const { formatBytes } = require("./body-limit");
const { PLUGIN } = require("../constants/plugin");

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_RE = /^[a-f0-9]{48}$/;

const transfersRoot = () => {
  const dir = path.join(backupDir(), ".transfers");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const transferPath = (token) => path.join(transfersRoot(), `${token}.json`);

/**
 * Splits/validates a recipient list (array, comma/space-separated string, or
 * any nesting of those) into a deduped list of lowercase email addresses.
 */
const normalizeRecipients = (raw) => {
  const items = (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => String(value == null ? "" : value).split(/[,;\s]+/));
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const email = item.trim().toLowerCase();
    if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out;
};

/**
 * Issues a time-limited public download token for a backup archive. Throws if
 * the archive does not exist. The token maps to the file name on disk in
 * `<backupDir>/.transfers/<token>.json`.
 */
const createTransferLink = (fileName, ttlMs = DEFAULT_TTL_MS) => {
  getBackupPath(fileName);
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + ttlMs;
  fs.writeFileSync(
    transferPath(token),
    JSON.stringify({ file: fileName, createdAt: Date.now(), expiresAt }),
  );
  return { token, expiresAt };
};

/**
 * Resolves a transfer token to its backup file name, or null when the token
 * is malformed, unknown, or expired. Expired token files are removed on read.
 */
const resolveTransfer = (token) => {
  if (!TOKEN_RE.test(String(token || ""))) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(transferPath(token), "utf-8"));
  } catch {
    return null;
  }
  if (!data || !data.file) return null;
  if (Date.now() > (data.expiresAt || 0)) {
    try { fs.unlinkSync(transferPath(token)); } catch { /* ignore */ }
    return null;
  }
  return data;
};

const transferUrl = (baseUrl, token) =>
  `${String(baseUrl || "").replace(/\/+$/, "")}/${PLUGIN}/backup/transfer/${token}`;

const buildEmailHtml = ({ fileName, url, sizeLabel, expiresAt }) =>
  "<p>A database backup archive has been shared with you.</p>"
  + `<p><strong>${fileName}</strong>${sizeLabel ? ` &mdash; ${sizeLabel}` : ""}</p>`
  + `<p><a href="${url}">Download the archive</a></p>`
  + `<p style="color:#888;font-size:12px">This link expires on ${new Date(expiresAt).toUTCString()}. `
  + "Anyone with the link can download the archive &mdash; do not forward it.</p>";

const sendTransferEmails = async (recipients, payload) => {
  const emailService = strapi.plugin("email") && strapi.plugin("email").service("email");
  if (!emailService) throw new Error("the Strapi email plugin is not available");
  const subject = `Backup archive: ${payload.fileName}`;
  const html = buildEmailHtml(payload);
  const results = [];
  for (const to of recipients) {
    try {
      await emailService.send({ to, subject, html });
      results.push({ to, sent: true });
    } catch (err) {
      results.push({ to, sent: false, error: err.message });
    }
  }
  return results;
};

/**
 * Creates a download link for `fileName` and emails it to every recipient.
 * Throws when the recipient list is empty after normalization.
 */
const transferBackup = async ({ fileName, recipients, baseUrl, ttlMs }) => {
  const list = normalizeRecipients(recipients);
  if (list.length === 0) throw new Error("no valid recipient email addresses");

  const { token, expiresAt } = createTransferLink(fileName, ttlMs);
  const url = transferUrl(baseUrl, token);

  let sizeLabel = "";
  try { sizeLabel = formatBytes(fs.statSync(getBackupPath(fileName)).size); }
  catch { /* size is cosmetic */ }

  const results = await sendTransferEmails(list, { fileName, url, sizeLabel, expiresAt });
  return { token, url, expiresAt, recipients: list, results };
};

/**
 * Emails the freshly-created pre-restore snapshot to the recipients saved in
 * plugin settings. A logged no-op when no recipients are set or no server URL
 * is configured. Never throws — a failed email must not abort the restore it
 * is protecting.
 */
const autoSendPreRestore = async (fileName, emit) => {
  let recipients = [];
  try { recipients = normalizeRecipients(readConfig().transferRecipients); }
  catch { recipients = []; }

  if (recipients.length === 0) {
    emit?.("[transfer] no transfer recipients in settings — pre-restore snapshot not emailed");
    return;
  }

  const baseUrl = (typeof strapi !== "undefined" && strapi.config.get("server.url")) || "";
  if (!baseUrl) {
    emit?.("[transfer] server.url is not set — cannot build a download link; pre-restore snapshot not emailed");
    return;
  }

  try {
    const { results } = await transferBackup({ fileName, recipients, baseUrl });
    const ok = results.filter((r) => r.sent).length;
    emit?.(`[transfer] pre-restore snapshot link emailed to ${ok}/${recipients.length} recipient(s)`);
  } catch (err) {
    emit?.(`[transfer] pre-restore snapshot email failed: ${err.message}`);
  }
};

module.exports = {
  normalizeRecipients,
  createTransferLink,
  resolveTransfer,
  transferBackup,
  autoSendPreRestore,
  DEFAULT_TTL_MS,
};
