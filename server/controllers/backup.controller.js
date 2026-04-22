"use strict";

const fs = require("fs");
const { PassThrough } = require("stream");

const { services } = require("../helpers/plugin-services");
const { errorBody } = require("../utils/errors");
const { pickMultipartFile, readableUploadPath, uploadOriginalName } = require("../helpers/multipart");
const { pickDownloadMime } = require("../helpers/mime");
const { buildSchedulePatch, toPublicConfig, toSavedConfig } = require("../helpers/config-shape");
const { buildBackupCreateOpts, buildRestoreOpts } = require("../helpers/query-opts");

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
      fail(ctx, 500, error, "Backup failed to start");
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
      fail(ctx, 500, error, "Restore failed to start");
    }
  },

  async jobStatus(ctx) {
    const job = services().backup.getJob(ctx.params.id);
    if (!job) return ctx.throw(404, "Job not found");
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

    try {
      const staged = services().backup.stageUploadedArchive(tmpPath, uploadOriginalName(file));
      strapi.log.info(`[import-export] staged uploaded archive: ${staged.file}`);
      ctx.body = { data: { ...staged, restored: false } };
    } catch (error) {
      strapi.log.error("[import-export:backup.upload]", error);
      fail(ctx, 500, error, "Upload failed");
    }
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
