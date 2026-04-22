"use strict";

const { AUTO_BACKUP_JOB_KEY } = require("../constants/jobs");
const { service } = require("../helpers/plugin-services");

const backupSvc = () => service("backupService");
const storeSvc = () => service("storeService");

const runAutoBackup = async (cfg) =>
  backupSvc().createBackup({
    encrypt: Boolean(cfg.encryptionKey),
    key: cfg.encryptionKey || undefined,
    exclude: cfg.autoExcludeFiles ? "files" : undefined,
  });

const logAutoBackupResult = (result, pruned) => {
  const kib = Math.round(result.size / 1024);
  strapi.log.info(
    `[import-export] auto-backup ${result.file} ready (${kib} KiB, pruned ${pruned.removed.length} old)`,
  );
};

const runOnce = async () => {
  const store = storeSvc();
  const cfg = await store.read();

  strapi.log.info("[import-export] auto-backup starting");
  try {
    const result = await runAutoBackup(cfg);
    const pruned = backupSvc().pruneOldBackups(cfg.retention);
    await store.write({ lastBackupAt: new Date().toISOString() });
    logAutoBackupResult(result, pruned);
    return { ...result, pruned };
  } catch (err) {
    strapi.log.error(`[import-export] auto-backup failed: ${err.message}`);
    throw err;
  }
};

const unregister = () => {
  try { strapi.cron?.remove?.(AUTO_BACKUP_JOB_KEY); } catch { /* noop */ }
};

const isValidRule = (rule) => rule && String(rule).trim();

const registerCron = (rule) => {
  strapi.cron.add({
    [AUTO_BACKUP_JOB_KEY]: {
      task: () => runOnce().catch(() => { /* already logged */ }),
      options: { rule },
    },
  });
};

const register = async () => {
  const cfg = await storeSvc().read();
  unregister();

  if (!isValidRule(cfg.backupSchedule)) {
    strapi.log.debug("[import-export] no backup schedule configured");
    return { registered: false };
  }

  try {
    registerCron(cfg.backupSchedule);
    strapi.log.info(`[import-export] auto-backup scheduled: ${cfg.backupSchedule}`);
    return { registered: true, rule: cfg.backupSchedule };
  } catch (error) {
    strapi.log.error(`[import-export] failed to register cron: ${error.message}`);
    return { registered: false, error: error.message };
  }
};

const reschedule = () => register();

module.exports = () => ({ register, unregister, reschedule, runOnce });
