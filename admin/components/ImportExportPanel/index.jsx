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
import FullSeedCard from "./FullSeedCard";
import ConfirmDialog from "./ConfirmDialog";
import SchemaConfirmDialog from "./SchemaConfirmDialog";
import TransferDialog from "./TransferDialog";
import { deleteAction, restoreAction, downloadAction, stageUpload, importUpload } from "./handlers";

const ImportExportPanel = () => {
  const { toggleNotification } = useNotification();
  const { runningJobs, refresh: refreshRunningJobs } = useRunningJobs();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [restoreScope, setRestoreScope] = useState("full");
  const [progressJob, setProgressJob] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [schemaConfirm, setSchemaConfirm] = useState(null);
  const [transferFile, setTransferFile] = useState(null);

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

  // Routes a restore response: a schema mismatch opens the confirm dialog,
  // otherwise the import job's live progress opens. Returns true when a
  // confirmation is pending so callers skip their success cleanup.
  const applyRestoreResponse = (res, file, options) => {
    if (res?.needsSchemaConfirm) {
      setSchemaConfirm({ file, diff: res.schemaDiff, options });
      return true;
    }
    if (!res?.jobId) {
      throw new Error(
        `Server did not return a jobId. Raw response: ${JSON.stringify(res)}. `
        + "Make sure Strapi has been restarted so the new routes are registered.",
      );
    }
    setProgressJob({ jobId: res.jobId, type: "import", token: res.token });
    refreshRunningJobs();
    return false;
  };

  // Maps the restore scope to CLI options: "db" excludes the assets group
  // (fast DB-only restore), "files" imports only the assets group.
  const scopeToOptions = (scope) => {
    if (scope === "db") return { exclude: "files" };
    if (scope === "files") return { only: "files" };
    return {};
  };

  const onRestore = async (file) => {
    setWorking(true);
    const options = scopeToOptions(restoreScope);
    try {
      const res = await restoreAction(file, options);
      const pending = applyRestoreResponse(res, file, options);
      setConfirm(null);
      if (!pending) setRestoreScope("full");
    } catch (e) {
      notify({ type: "danger", message: readServerError(e) });
    } finally {
      setWorking(false);
    }
  };

  const onSchemaConfirm = async () => {
    if (!schemaConfirm) return;
    const { file, options } = schemaConfirm;
    setWorking(true);
    try {
      const res = await restoreAction(file, { ...options, confirmSchemaChange: true });
      applyRestoreResponse(res, file, options);
      setSchemaConfirm(null);
      setRestoreScope("full");
      resetUpload();
    } catch (e) {
      notify({ type: "danger", message: readServerError(e) });
    } finally {
      setWorking(false);
    }
  };

  const onDownload = useCallback((file) => {
    if (downloading) return undefined;
    setDownloading({ file, percent: 0 });
    return downloadAction(file, {
      notify,
      onProgress: (received, total) => {
        const percent = total ? Math.round((received / total) * 100) : 0;
        setDownloading((prev) => (prev && prev.percent === percent ? prev : { file, percent }));
      },
    }).finally(() => setDownloading(null));
  }, [downloading, notify]);

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

  // Step 1 — validate the chosen file, then open the scope dialog. The actual
  // upload + import runs in onImportConfirmed once the user picks a scope.
  const onImport = () => {
    if (!uploadFile) return warnMissingFile();
    if (uploadFile.name.endsWith(".enc") && !uploadKey.trim()) return warnMissingKey();
    if (!assertUploadable(uploadFile)) return undefined;
    return setConfirm({ type: "upload-import", file: uploadFile.name });
  };

  const onImportConfirmed = async () => {
    setWorking(true);
    const scopeOpts = scopeToOptions(restoreScope);
    const options = { key: uploadKey || undefined, ...scopeOpts };
    try {
      const res = await importUpload(uploadFile, uploadKey, scopeOpts, { notify, reload });
      const pending = applyRestoreResponse(res, res.stagedFile, options);
      setConfirm(null);
      if (!pending) {
        setRestoreScope("full");
        resetUpload();
      }
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

  const handleConfirm = (c) => {
    if (c.type === "upload-import") return onImportConfirmed();
    if (c.type === "restore") return onRestore(c.file);
    return onDelete(c.file);
  };

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

      <Box paddingBottom={5}>
        <FullSeedCard
          notify={notify}
          onStartJob={(jobId) => {
            setProgressJob({ jobId, type: "import" });
            refreshRunningJobs();
          }}
        />
      </Box>

      <BackupTable
        rows={rows}
        loading={loading}
        working={working}
        downloading={downloading}
        onReload={reload}
        onDownload={onDownload}
        onTransfer={setTransferFile}
        onRestore={(file) => setConfirm({ type: "restore", file })}
        onDelete={(file) => setConfirm({ type: "delete", file })}
      />

      {exportOpen && (
        <DbExportModal
          onClose={() => setExportOpen(false)}
          onStartJob={(jobId) => {
            setExportOpen(false);
            setProgressJob({ jobId, type: "export" });
            refreshRunningJobs();
          }}
        />
      )}

      {progressJob && (
        <JobProgressModal
          jobId={progressJob.jobId}
          type={progressJob.type}
          token={progressJob.token}
          onDone={() => reload()}
          onClose={() => setProgressJob(null)}
        />
      )}

      <ConfirmDialog
        confirm={confirm}
        working={working}
        restoreScope={restoreScope}
        onClose={() => setConfirm(null)}
        onScope={setRestoreScope}
        onConfirm={handleConfirm}
      />

      <SchemaConfirmDialog
        confirm={schemaConfirm}
        working={working}
        onClose={() => setSchemaConfirm(null)}
        onConfirm={onSchemaConfirm}
      />

      <TransferDialog
        file={transferFile}
        onClose={() => setTransferFile(null)}
        notify={notify}
      />
    </Box>
  );
};

export default ImportExportPanel;
