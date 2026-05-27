"use strict";

const fs = require("fs");

const { services } = require("../helpers/plugin-services");
const { errorBody, pickStatus } = require("../utils/errors");
const { pickMultipartFile, readableUploadPath, uploadOriginalName } = require("../helpers/multipart");
const { pickDownloadMime } = require("../helpers/mime");
const { buildSchedulePatch, toPublicConfig, toSavedConfig } = require("../helpers/config-shape");
const { buildBackupCreateOpts, buildRestoreOpts } = require("../helpers/query-opts");
const { diffArchiveSchema, readArchiveSchemas } = require("../helpers/schema-diff");
const {
  planFullSeed, writeSchemaFiles, writePendingSeed, readPendingSeed, clearPendingSeed,
} = require("../helpers/schema-writer");
const { readStrapiBodyLimit, formatBytes } = require("../helpers/body-limit");
const { isBusy, currentLabel, current } = require("../helpers/job-mutex");
const { resolveTransfer, transferBackup } = require("../helpers/transfer");

const fail = (ctx, status, error, fallback) => {
  ctx.status = status;
  ctx.body = errorBody(error, fallback);
};

module.exports = ({ strapi }) => ({
  async list(ctx) {
    ctx.body = { data: services().backup.listBackups() };
  },

  async create(ctx) {
    const { backup, store } = services();
    try {
      const cfg = await store.read();
      const jobId = backup.createBackupJob(buildBackupCreateOpts(ctx.request.body || {}, cfg));
      ctx.body = { data: { jobId, token: backup.getJobToken(jobId) } };
    } catch (error) {
      strapi.log.error("[import-export:backup.create]", error);
      fail(ctx, pickStatus(error, 500), error, "Backup failed to start");
    }
  },

  async remove(ctx) {
    try {
      ctx.body = { data: services().backup.deleteBackup(ctx.params.file) };
    } catch (error) {
      fail(ctx, 404, error, "Backup not found");
    }
  },

  async download(ctx) {
    let filePath;
    let stats;
    try {
      filePath = services().backup.getBackupPath(ctx.params.file);
      stats = fs.statSync(filePath);
    } catch (error) {
      ctx.status = 404;
      ctx.body = {
        error: {
          status: 404,
          name: "BackupNotFound",
          message:
            `Backup not found: ${ctx.params.file}. `
            + "It may have been removed since the list was loaded "
            + "(retention prune, manual delete, or — when running multiple Strapi replicas — "
            + "the file lives only on another replica's disk because the backup directory is not on a shared volume; see plugin README). "
            + "Refresh the page to see the current state.",
          code: "BACKUP_NOT_FOUND",
        },
      };
      return;
    }


    const safeName = String(ctx.params.file).replace(/"/g, "");
    ctx.set("Content-Type", pickDownloadMime(ctx.params.file));
    ctx.set("Content-Disposition", `attachment; filename="${safeName}"`);
    ctx.set("Content-Length", String(stats.size));
    ctx.set("Cache-Control", "no-store");
    ctx.set("Accept-Ranges", "none");
    ctx.status = 200;

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (err) => {
      strapi.log.error(`[import-export:backup.download] read failed: ${err.message}`);
      ctx.res.destroy(err);
    });
    ctx.body = fileStream;
  },


  async transferDownload(ctx) {
    const resolved = resolveTransfer(ctx.params.token);
    if (!resolved) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: "TransferLinkInvalid", message: "This download link is invalid or has expired." } };
      return;
    }

    let filePath;
    let stats;
    try {
      filePath = services().backup.getBackupPath(resolved.file);
      stats = fs.statSync(filePath);
    } catch {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: "BackupNotFound", message: "The shared archive is no longer available." } };
      return;
    }

    const safeName = String(resolved.file).replace(/"/g, "");
    ctx.set("Content-Type", pickDownloadMime(resolved.file));
    ctx.set("Content-Disposition", `attachment; filename="${safeName}"`);
    ctx.set("Content-Length", String(stats.size));
    ctx.set("Cache-Control", "no-store");
    ctx.status = 200;

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (err) => {
      strapi.log.error(`[import-export:transfer.download] read failed: ${err.message}`);
      ctx.res.destroy(err);
    });
    ctx.body = fileStream;
  },



  async transfer(ctx) {
    try {
      const body = ctx.request.body || {};
      const cfg = await services().store.read();
      const recipients = [];
      if (body.emails) recipients.push(body.emails);
      if (body.useSettingsRecipients && Array.isArray(cfg.transferRecipients)) {
        recipients.push(...cfg.transferRecipients);
      }
      const baseUrl = ctx.request.origin || strapi.config.get("server.url") || "";
      const result = await transferBackup({ fileName: ctx.params.file, recipients, baseUrl });
      ctx.body = { data: result };
    } catch (error) {
      strapi.log.error("[import-export:backup.transfer]", error);
      fail(ctx, pickStatus(error, 500), error, "Transfer failed");
    }
  },

  async restore(ctx) {
    const { backup, store } = services();
    try {
      const cfg = await store.read();
      const opts = buildRestoreOpts(ctx.request.body || {}, cfg);

      if (!opts.confirmSchemaChange) {
        const diff = await diffArchiveSchema(backup.getBackupPath(ctx.params.file), strapi);
        if (diff.hasDifferences) {
          ctx.body = { data: { needsSchemaConfirm: true, schemaDiff: diff.summary } };
          return;
        }
      }

      const jobId = backup.restoreBackupJob(ctx.params.file, opts);
      ctx.body = { data: { jobId, token: backup.getJobToken(jobId) } };
    } catch (error) {
      strapi.log.error("[import-export:backup.restore]", error);
      fail(ctx, pickStatus(error, 500), error, "Restore failed to start");
    }
  },

  async jobStatus(ctx) {
    const job = services().backup.getJob(ctx.params.id);
    if (!job) {
      ctx.status = 404;
      ctx.body = {
        error: {
          status: 404,
          name: "JobNotFound",
          message:
            "Job not found — the Strapi process was likely restarted since the job started. "
            + "The import/export CLI child process was killed with the parent; "
            + "check the backup list to see the final state.",
          code: "JOB_NOT_FOUND",
        },
      };
      return;
    }
    ctx.body = { data: job };
  },

  async jobProgress(ctx) {
    const { backup } = services();
    const expected = backup.getJobToken(ctx.params.id);
    if (!expected) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: "JobNotFound", message: "Job not found." } };
      return;
    }
    const token = ctx.query.token || ctx.request.headers["x-job-token"];
    if (!token || token !== expected) {
      ctx.status = 403;
      ctx.body = { error: { status: 403, name: "InvalidJobToken", message: "Invalid or missing job token." } };
      return;
    }
    ctx.body = { data: backup.getJob(ctx.params.id) };
  },


  async jobAbort(ctx) {
    const { backup } = services();
    const expected = backup.getJobToken(ctx.params.id);
    if (!expected) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: "JobNotFound", message: "Job not found." } };
      return;
    }
    const token = ctx.query.token || (ctx.request.body && ctx.request.body.token) || ctx.request.headers["x-job-token"];
    if (!token || token !== expected) {
      ctx.status = 403;
      ctx.body = { error: { status: 403, name: "InvalidJobToken", message: "Invalid or missing job token." } };
      return;
    }
    const job = backup.getJob(ctx.params.id);
    if (!job || job.status !== "running") {
      ctx.body = { data: { aborted: false, status: job ? job.status : "missing", message: "Job is not running." } };
      return;
    }
    backup.requestJobAbort(ctx.params.id);
    ctx.body = { data: { aborted: true, message: "Abort requested — the job will stop shortly." } };
  },

  async jobList(ctx) {
    ctx.body = { data: services().backup.listJobs() };
  },

  async upload(ctx) {
    const file = pickMultipartFile(ctx);
    if (!file) return ctx.throw(400, "file is required (multipart)");

    const tmpPath = readableUploadPath(file);
    if (!tmpPath) return ctx.throw(400, "uploaded file not readable");

    const fileSize = Number(file.size) || 0;
    const max = readStrapiBodyLimit();
    if (fileSize > max) {
      ctx.status = 413;
      ctx.body = {
        error: {
          status: 413,
          name: "PayloadTooLarge",
          message:
            `Archive size ${formatBytes(fileSize)} exceeds the configured Strapi body limit of ${formatBytes(max)}. `
            + "Raise `strapi::body` formidable.maxFileSize in admin/config/middlewares.js (and the reverse-proxy client_max_body_size) and restart Strapi.",
        },
      };
      return;
    }

    try {
      const staged = services().backup.stageUploadedArchive(tmpPath, uploadOriginalName(file));
      strapi.log.info(`[import-export] staged uploaded archive: ${staged.file}`);
      ctx.body = { data: { ...staged, restored: false } };
    } catch (error) {
      strapi.log.error("[import-export:backup.upload]", error);
      fail(ctx, 500, error, "Upload failed");
    }
  },

  async limits(ctx) {
    const max = readStrapiBodyLimit();
    ctx.body = {
      data: {
        maxFileSize: max,
        maxFileSizeLabel: formatBytes(max),
        busy: isBusy(),
        busyLabel: currentLabel(),
        busyJob: current(),
      },
    };
  },

  async getSchedule(ctx) {
    const cfg = await services().store.read();
    ctx.body = { data: toPublicConfig(cfg) };
  },

  async saveSchedule(ctx) {
    const { store, schedule } = services();
    const saved = await store.write(buildSchedulePatch(ctx.request.body || {}));
    const registered = await schedule.reschedule();
    ctx.body = {
      data: { ok: true, ...registered, config: toSavedConfig(saved) },
    };
  },

  async runNow(ctx) {
    try {
      ctx.body = { data: await services().schedule.runOnce() };
    } catch (error) {
      strapi.log.error("[import-export:backup.runNow]", error);
      fail(ctx, 500, error, "Scheduled backup run failed");
    }
  },

  // Full-seed step 1 — reports which content-types/components an archive
  // would create in src/ and which plugin types it cannot recreate.
  async fullSeedPlan(ctx) {
    try {
      const schemas = await readArchiveSchemas(services().backup.getBackupPath(ctx.params.file));
      if (!schemas || schemas.length === 0) {
        ctx.status = 422;
        ctx.body = { error: { status: 422, name: "NoSchemas", message: "Could not read content-type schemas from the archive." } };
        return;
      }
      ctx.body = { data: planFullSeed(schemas, strapi) };
    } catch (error) {
      strapi.log.error("[import-export:full-seed.plan]", error);
      fail(ctx, pickStatus(error, 500), error, "Could not analyze archive");
    }
  },

  // Full-seed step 2 — writes the missing api/component schema files into
  // src/. The src/ change makes `strapi develop` restart and create the
  // tables; a marker file lets the UI resume with the data import after.
  async fullSeedSync(ctx) {
    try {
      const schemas = await readArchiveSchemas(services().backup.getBackupPath(ctx.params.file));
      if (!schemas || schemas.length === 0) {
        ctx.status = 422;
        ctx.body = { error: { status: 422, name: "NoSchemas", message: "Could not read content-type schemas from the archive." } };
        return;
      }
      const created = writeSchemaFiles(schemas, strapi);
      writePendingSeed({ archive: ctx.params.file, createdAt: Date.now(), created });
      strapi.log.info(
        `[import-export] [full-seed] created ${created.contentTypes.length} content-type(s) + ${created.components.length} component(s) in src/ — Strapi will restart to pick them up`,
      );
      ctx.body = { data: { created, willRestart: true } };
    } catch (error) {
      strapi.log.error("[import-export:full-seed.sync]", error);
      fail(ctx, pickStatus(error, 500), error, "Schema sync failed");
    }
  },

  async fullSeedPending(ctx) {
    ctx.body = { data: readPendingSeed() };
  },

  async clearFullSeed(ctx) {
    clearPendingSeed();
    ctx.body = { data: { ok: true } };
  },
});
