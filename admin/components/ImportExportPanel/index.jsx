import React, { useCallback, useEffect, useState } from "react";

import { useNotification } from "@strapi/strapi/admin";
import { Box, Flex } from "@strapi/design-system";

import { listBackups, getBackupLimits } from "../../utils/api";
import { readServerError, formatBytes } from "../../utils/format";
import { useRunningJobs } from "../../hooks/useRunningJobs";

import DbExportModal from "../DbExportModal";
import JobProgressModal from "../JobProgressModal";
import RunningJobsBanner from "./RunningJobsBanner";
import ExportCard from "./ExportCard";
import UploadDropzone from "./UploadDropzone";
import BackupTable from "./BackupTable";
import ConfirmDialog from "./ConfirmDialog";
import { deleteAction, restoreAction, downloadAction, stageUpload, importUpload } from "./handlers";

const ImportExportPanel = () => {
  const { toggleNotification } = useNotification();
  const runningJobs = useRunningJobs();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [restoreExcludeFiles, setRestoreExcludeFiles] = useState(false);
  const [progressJob, setProgressJob] = useState(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadKey, setUploadKey] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [limits, setLimits] = useState({ maxFileSize: 0, busy: false, maxFileSizeLabel: "" });

  const notify = toggleNotification;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [backups, lim] = await Promise.all([listBackups(), getBackupLimits().catch(() => null)]);
      setRows(backups);
      if (lim) setLimits(lim);
    } catch (e) {
      notify({ type: "danger", message: readServerError(e) });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { reload(); }, [reload]);

  const assertUploadable = (file) => {
    if (!file) return false;
    if (limits.maxFileSize && file.size > limits.maxFileSize) {
      notify({
        type: "danger",
        message:
          `Archive is ${formatBytes(file.size)} — exceeds configured Strapi body limit of ${limits.maxFileSizeLabel || formatBytes(limits.maxFileSize)}. `
          + "Raise strapi::body formidable.maxFileSize in admin/config/middlewares.js (and reverse-proxy client_max_body_size) and restart Strapi.",
      });
      return false;
    }
    if (limits.busy) {
      notify({
        type: "warning",
        message: `Another ${limits.busyLabel || "backup"} job is running — wait for it to finish before starting a new import.`,
      });
      return false;
    }
    return true;
  };

  const resetUpload = () => {
    setUploadFile(null);
    setUploadKey("");
  };

  const onDelete = async (file) => {
    setWorking(true);
    try {
      await deleteAction(file, { notify, reload });
    } catch (e) {
      notify({ type: "danger", message: readServerError(e) });
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  const onRestore = async (file) => {
    setWorking(true);
    try {
      const jobId = await restoreAction(file, {
        exclude: restoreExcludeFiles ? "files" : undefined,
      });
      setProgressJob({ jobId, type: "import" });
      setConfirm(null);
      setRestoreExcludeFiles(false);
    } catch (e) {
      notify({ type: "danger", message: readServerError(e) });
    } finally {
      setWorking(false);
    }
  };

  const onDownload = (file) => downloadAction(file, { notify });

  const warnMissingFile = () => {
    notify({
      type: "warning",
      message: "Choose a .tar, .tar.gz, .tar.enc or .tar.gz.enc file first.",
    });
  };

  const warnMissingKey = () => {
    notify({ type: "warning", message: "Encryption key is required for .enc archives." });
  };

  const onStage = async () => {
    if (!uploadFile) return warnMissingFile();
    if (!assertUploadable(uploadFile)) return;
    setWorking(true);
    try {
      await stageUpload(uploadFile, uploadKey, { notify, reload, reset: resetUpload });
    } catch (e) {
      notify({ type: "danger", message: readServerError(e) });
    } finally {
      setWorking(false);
    }
  };

  const onImport = async () => {
    if (!uploadFile) return warnMissingFile();
    if (uploadFile.name.endsWith(".enc") && !uploadKey.trim()) return warnMissingKey();
    if (!assertUploadable(uploadFile)) return;
    setWorking(true);
    try {
      const jobId = await importUpload(uploadFile, uploadKey, { notify, reload });
      setProgressJob({ jobId, type: "import" });
      resetUpload();
    } catch (e) {
      notify({ type: "danger", message: readServerError(e) });
    } finally {
      setWorking(false);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setUploadFile(file);
  };

  const handleConfirm = (c) =>
    c.type === "restore" ? onRestore(c.file) : onDelete(c.file);

  return (
    <Box>
      <RunningJobsBanner jobs={runningJobs} onSelect={setProgressJob} />

      <Flex gap={4} alignItems="stretch" wrap="wrap" paddingBottom={5}>
        <ExportCard onOpen={() => setExportOpen(true)} />
        <UploadDropzone
          file={uploadFile}
          encryptionKey={uploadKey}
          dragOver={dragOver}
          working={working}
          limits={limits}
          onFile={setUploadFile}
          onKey={setUploadKey}
          onDragOver={onDragOver}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onStage={onStage}
          onImport={onImport}
        />
      </Flex>

      <BackupTable
        rows={rows}
        loading={loading}
        working={working}
        onReload={reload}
        onDownload={onDownload}
        onRestore={(file) => setConfirm({ type: "restore", file })}
        onDelete={(file) => setConfirm({ type: "delete", file })}
      />

      {exportOpen && (
        <DbExportModal
          onClose={() => setExportOpen(false)}
          onStartJob={(jobId) => {
            setExportOpen(false);
            setProgressJob({ jobId, type: "export" });
          }}
        />
      )}

      {progressJob && (
        <JobProgressModal
          jobId={progressJob.jobId}
          type={progressJob.type}
          onDone={() => reload()}
          onClose={() => setProgressJob(null)}
        />
      )}

      <ConfirmDialog
        confirm={confirm}
        working={working}
        restoreExcludeFiles={restoreExcludeFiles}
        onClose={() => setConfirm(null)}
        onToggleExclude={setRestoreExcludeFiles}
        onConfirm={handleConfirm}
      />
    </Box>
  );
};

export default ImportExportPanel;
