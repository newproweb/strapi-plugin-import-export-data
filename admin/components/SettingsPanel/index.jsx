import React, { useCallback, useEffect, useState } from "react";

import { useNotification } from "@strapi/strapi/admin";
import { Box, Flex, Button, Loader } from "@strapi/design-system";
import { Play } from "@strapi/icons";

import { getSchedule, saveSchedule, runScheduledBackup } from "../../utils/api";
import { readServerError } from "../../utils/format";

import ScheduleSection from "./ScheduleSection";
import EncryptionSection from "./EncryptionSection";
import LastRunBox from "./LastRunBox";

const buildPayload = (cfg) => {
  const payload = {
    backupSchedule: cfg.backupSchedule || "",
    retention: cfg.retention,
    autoExcludeFiles: cfg.autoExcludeFiles,
    adoptOrphans: Boolean(cfg.adoptOrphans),
    preRestoreSnapshot: cfg.preRestoreSnapshot !== false,
  };

  if (typeof cfg.encryptionKey === "string" && !cfg.encryptionKey.startsWith("••")) {
    payload.encryptionKey = cfg.encryptionKey;
  }
  return payload;
};

const savedMessage = (res) =>
  res.registered
    ? `Settings saved. Cron registered: ${res.rule}`
    : "Settings saved (auto-backup disabled).";

const SettingsPanel = () => {
  const { toggleNotification } = useNotification();
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setCfg(await getSchedule());
    } catch (e) {
      toggleNotification({ type: "danger", message: readServerError(e) });
    } finally {
      setLoading(false);
    }
  }, [toggleNotification]);

  useEffect(() => { reload(); }, [reload]);

  const onField = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await saveSchedule(buildPayload(cfg));
      toggleNotification({ type: "success", message: savedMessage(res) });
      await reload();
    } catch (e) {
      toggleNotification({ type: "danger", message: readServerError(e) });
    } finally {
      setSaving(false);
    }
  };

  const onRunNow = async () => {
    setRunning(true);
    toggleNotification({ type: "info", message: "Running scheduled backup now…" });
    try {
      const result = await runScheduledBackup();
      toggleNotification({ type: "success", message: `Backup ${result.file} ready.` });
      await reload();
    } catch (e) {
      toggleNotification({ type: "danger", message: readServerError(e) });
    } finally {
      setRunning(false);
    }
  };

  if (loading || !cfg) {
    return (
      <Flex justifyContent="center" padding={6}>
        <Loader>Loading settings…</Loader>
      </Flex>
    );
  }

  return (
    <Box>
      <ScheduleSection cfg={cfg} onField={onField} />
      <EncryptionSection cfg={cfg} onField={onField} />
      <Flex gap={2} justifyContent="flex-end" paddingBottom={4}>
        <Button variant="secondary" onClick={onRunNow} loading={running} startIcon={<Play />}>
          Run now
        </Button>
        <Button onClick={onSave} loading={saving}>Save settings</Button>
      </Flex>
      <LastRunBox lastBackupAt={cfg.lastBackupAt} />
    </Box>
  );
};

export default SettingsPanel;
