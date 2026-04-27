import { deleteBackup, restoreBackup, downloadBackup, uploadBackup } from "../../utils/api";
import { downloadBlob } from "../../utils/download";
import { readServerError } from "../../utils/format";

export const deleteAction = async (file, { notify, reload }) => {
  await deleteBackup(file);
  notify({ type: "success", message: `Deleted ${file}` });
  await reload();
};

export const restoreAction = async (file, { exclude }) => {
  const { jobId } = await restoreBackup(file, { exclude });
  return jobId;
};

export const downloadAction = async (file, { notify }) => {
  try {
    const response = await downloadBackup(file);
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    if (!blob.size) {
      // Belt-and-braces guard: if the response somehow arrives empty,
      // surface a clear error instead of silently saving a 0 KB archive.
      throw new Error(
        "Server returned an empty response — the download stream was truncated. "
        + "Check the Strapi logs for [import-export:backup.download] errors and retry.",
      );
    }
    downloadBlob(blob, file);
  } catch (e) {
    notify({ type: "danger", message: readServerError(e) });
  }
};

export const stageUpload = async (file, key, { notify, reload, reset }) => {
  const staged = await uploadBackup(file, { key: key || undefined });
  notify({
    type: "success",
    message: `Staged ${staged.file}. Use Restore from the list to apply it.`,
  });
  reset();
  await reload();
  return staged;
};

export const importUpload = async (file, key, { notify, reload }) => {
  const staged = await uploadBackup(file, { key: key || undefined });
  await reload();
  notify({
    type: "info",
    message: "File uploaded. Starting `strapi import --force` now — opening live progress…",
  });
  const response = await restoreBackup(staged.file, { key: key || undefined });
  const jobId = response?.jobId;
  if (!jobId) {
    throw new Error(
      `Server did not return a jobId. Raw response: ${JSON.stringify(response)}. `
      + "Make sure Strapi has been restarted so the new routes are registered."
    );
  }
  return jobId;
};
