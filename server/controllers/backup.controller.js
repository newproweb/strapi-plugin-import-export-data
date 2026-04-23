"use strict";

const fs = require("fs");
const { PassThrough } = require("stream");

const { services } = require("../helpers/plugin-services");
const { errorBody, pickStatus } = require("../utils/errors");
const { pickMultipartFile, readableUploadPath, uploadOriginalName } = require("../helpers/multipart");
const { pickDownloadMime } = require("../helpers/mime");
const { buildSchedulePatch, toPublicConfig, toSavedConfig } = require("../helpers/config-shape");
const { buildBackupCreateOpts, buildRestoreOpts } = require("../helpers/query-opts");
const { readStrapiBodyLimit, formatBytes } = require("../helpers/body-limit");
const { isBusy, currentLabel, current } = require("../helpers/job-mutex");

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
      ctx.body = { data: { jobId } };
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
    try {
      const filePath = services().backup.getBackupPath(ctx.params.file);
      ctx.set("Content-Type", pickDownloadMime(ctx.params.file));
      ctx.set("Content-Disposition", `attachment; filename="${ctx.params.file}"`);
      const stream = new PassThrough();
      ctx.body = stream;
      fs.createReadStream(filePath).pipe(stream);
    } catch (error) {
      fail(ctx, 404, error, "Backup not found");
    }
  },

  async restore(ctx) {
    const { backup, store } = services();
    try {
      const cfg = await store.read();
      const jobId = backup.restoreBackupJob(
        ctx.params.file,
        buildRestoreOpts(ctx.request.body || {}, cfg),
      );
      ctx.body = { data: { jobId } };
    } catch (error) {
      strapi.log.error("[import-export:backup.restore]", error);
      fail(ctx, pickStatus(error, 500), error, "Restore failed to start");
    }
  },

  async jobStatus(ctx) {
    const job = services().backup.getJob(ctx.params.id);
    if (!job) {
      // Use a plain 404 response instead of `ctx.throw` — the job map is
      // in-memory, so a missing job just means the Strapi process was
      // restarted between the restore start and this poll. We don't want
      // Koa's error middleware to log a full stack trace for every poll;
      // the frontend already handles this status and stops polling.
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
});
